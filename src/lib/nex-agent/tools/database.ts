// src/lib/nex-agent/tools/database.ts
//
// NEX Agent v1.3 · Database Engineer tools.
// Three primitives:
//   1. postgres_schema_introspect · READ-ONLY · full shape of a table
//   2. postgres_dry_run_migration · runs SQL in SAVEPOINT · always rolls back · returns diagnostics
//   3. postgres_apply_migration · REAL apply · gated by typed confirmation phrase + destructive-op detection
//
// The apply tool is the ONLY tool in nex-agent that writes to the production DB.
// It refuses without confirm_phrase='APPLY MIGRATION'. It refuses DESTRUCTIVE ops
// (DROP TABLE · TRUNCATE · DELETE without WHERE) unless confirm_phrase='APPLY DESTRUCTIVE MIGRATION'.
// Everything runs inside an outer transaction · single-statement failure rolls back all.

import { Client } from "pg";
import type { ToolResult } from "./index";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000, statement_timeout: 20_000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

// ═══════════════════════════════════════════════════════════════════
// 1. Schema introspection · READ-ONLY
// ═══════════════════════════════════════════════════════════════════

export interface ColumnInfo { column_name: string; data_type: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null; }
export interface ConstraintInfo { constraint_name: string; constraint_type: string; definition: string; }
export interface IndexInfo { index_name: string; is_unique: boolean; is_primary: boolean; definition: string; }
export interface ForeignKeyInfo { constraint_name: string; from_column: string; to_schema: string; to_table: string; to_column: string; on_delete: string; on_update: string; }

export async function postgresSchemaIntrospect(schema: string, table: string): Promise<ToolResult<{
  schema: string; table: string; exists: boolean;
  row_count_estimate: number | null;
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  indexes: IndexInfo[];
  foreign_keys: ForeignKeyInfo[];
}>> {
  const t0 = Date.now();
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema) || !/^[a-z_][a-z0-9_]*$/i.test(table)) {
    return { ok: false, tool: "postgres_schema_introspect", duration_ms: Date.now() - t0, reason: "invalid_identifier" };
  }
  try {
    return await withClient(async (c) => {
      const exists = (await c.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2 LIMIT 1`,
        [schema, table],
      )).rowCount === 1;
      if (!exists) {
        return { ok: true, tool: "postgres_schema_introspect", duration_ms: Date.now() - t0, data: { schema, table, exists: false, row_count_estimate: null, columns: [], constraints: [], indexes: [], foreign_keys: [] } };
      }
      const cols = await c.query<ColumnInfo>(
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
         FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
        [schema, table],
      );
      const cons = await c.query<ConstraintInfo>(
        `SELECT conname AS constraint_name,
                CASE contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY' ELSE contype::text END AS constraint_type,
                pg_get_constraintdef(oid) AS definition
         FROM pg_constraint WHERE conrelid = ($1||'.'||$2)::regclass`,
        [schema, table],
      );
      const idx = await c.query<IndexInfo>(
        `SELECT indexname AS index_name,
                (indexdef LIKE 'CREATE UNIQUE%') AS is_unique,
                (indexname LIKE '%_pkey') AS is_primary,
                indexdef AS definition
         FROM pg_indexes WHERE schemaname=$1 AND tablename=$2`,
        [schema, table],
      );
      const fks = await c.query<ForeignKeyInfo>(
        `SELECT c.conname AS constraint_name,
                (SELECT attname FROM pg_attribute WHERE attrelid=c.conrelid AND attnum=c.conkey[1]) AS from_column,
                nf.nspname AS to_schema,
                rf.relname AS to_table,
                (SELECT attname FROM pg_attribute WHERE attrelid=c.confrelid AND attnum=c.confkey[1]) AS to_column,
                CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE c.confdeltype::text END AS on_delete,
                CASE c.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE c.confupdtype::text END AS on_update
         FROM pg_constraint c
         JOIN pg_class rf ON rf.oid = c.confrelid
         JOIN pg_namespace nf ON nf.oid = rf.relnamespace
         WHERE c.conrelid = ($1||'.'||$2)::regclass AND c.contype='f'`,
        [schema, table],
      );
      const est = await c.query<{ reltuples: number }>(
        `SELECT reltuples::bigint AS reltuples FROM pg_class WHERE oid=($1||'.'||$2)::regclass`,
        [schema, table],
      );
      return {
        ok: true, tool: "postgres_schema_introspect", duration_ms: Date.now() - t0,
        data: {
          schema, table, exists: true,
          row_count_estimate: Number(est.rows[0]?.reltuples ?? 0),
          columns: cols.rows, constraints: cons.rows, indexes: idx.rows, foreign_keys: fks.rows,
        },
      };
    });
  } catch (err) { return { ok: false, tool: "postgres_schema_introspect", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) }; }
}

// ═══════════════════════════════════════════════════════════════════
// 2. Dry-run migration · SAVEPOINT + immediate ROLLBACK
// ═══════════════════════════════════════════════════════════════════

export interface DryRunResult {
  ok: boolean;
  statements_executed: number;
  statement_results: Array<{ ordinal: number; sql_snippet: string; status: "ok" | "error"; rowCount?: number | null; error?: string }>;
  destructive_ops_detected: Array<{ kind: string; snippet: string }>;
  first_error?: string;
  total_duration_ms: number;
}

const DESTRUCTIVE_PATTERNS = [
  { pattern: /\bDROP\s+TABLE\b/i, kind: "DROP TABLE" },
  { pattern: /\bDROP\s+SCHEMA\b/i, kind: "DROP SCHEMA" },
  { pattern: /\bTRUNCATE\b/i, kind: "TRUNCATE" },
  { pattern: /\bDELETE\s+FROM\s+[^\s;]+\s*(--[^\n]*)?\s*(?!WHERE)/i, kind: "DELETE without WHERE" },
  { pattern: /\bDROP\s+COLUMN\b/i, kind: "DROP COLUMN" },
  { pattern: /\bDROP\s+CONSTRAINT\b/i, kind: "DROP CONSTRAINT" },
];

// Split SQL into statements · naive but works for typical migration files.
// Strips SQL line-comments · treats semicolon as terminator.
function splitStatements(sql: string): string[] {
  const stripped = sql.replace(/--[^\n]*\n/g, "\n");
  const out: string[] = [];
  let buf = "";
  let inString: false | "'" | '"' | "$$" = false;
  let i = 0;
  while (i < stripped.length) {
    const ch = stripped[i];
    if (!inString) {
      if (ch === "'" || ch === '"') { inString = ch; buf += ch; i++; continue; }
      if (stripped.slice(i, i + 2) === "$$") { inString = "$$"; buf += "$$"; i += 2; continue; }
      if (ch === ";") {
        const s = buf.trim();
        if (s) out.push(s);
        buf = "";
        i++;
        continue;
      }
    } else {
      if (inString === "$$" && stripped.slice(i, i + 2) === "$$") { inString = false; buf += "$$"; i += 2; continue; }
      if (inString === ch) { inString = false; }
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

function detectDestructive(sql: string): DryRunResult["destructive_ops_detected"] {
  const out: DryRunResult["destructive_ops_detected"] = [];
  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.pattern.test(sql)) out.push({ kind: p.kind, snippet: sql.slice(0, 160) });
  }
  return out;
}

export async function postgresDryRunMigration(sql: string): Promise<ToolResult<DryRunResult>> {
  const t0 = Date.now();
  if (!sql || sql.length < 3) return { ok: false, tool: "postgres_dry_run_migration", duration_ms: Date.now() - t0, reason: "sql_empty" };
  const statements = splitStatements(sql);
  if (statements.length === 0) return { ok: false, tool: "postgres_dry_run_migration", duration_ms: Date.now() - t0, reason: "no_statements_parsed" };
  const destructive = detectDestructive(sql);
  try {
    return await withClient(async (c) => {
      const results: DryRunResult["statement_results"] = [];
      let firstError: string | undefined;
      let statementsExecuted = 0;
      await c.query("BEGIN");
      await c.query("SAVEPOINT nex_agent_dryrun");
      let hardFail = false;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          const r = await c.query(stmt);
          results.push({ ordinal: i + 1, sql_snippet: stmt.slice(0, 200), status: "ok", rowCount: r.rowCount });
          statementsExecuted++;
        } catch (err) {
          const msg = (err as Error).message.slice(0, 300);
          results.push({ ordinal: i + 1, sql_snippet: stmt.slice(0, 200), status: "error", error: msg });
          if (!firstError) firstError = msg;
          hardFail = true;
          break;
        }
      }
      // ALWAYS rollback · dry-run leaves DB untouched
      try { await c.query("ROLLBACK TO SAVEPOINT nex_agent_dryrun"); } catch { /* ignore */ }
      try { await c.query("ROLLBACK"); } catch { /* ignore */ }
      const total_duration_ms = Date.now() - t0;
      const ok = !hardFail;
      return {
        ok, tool: "postgres_dry_run_migration", duration_ms: total_duration_ms,
        reason: firstError,
        data: { ok, statements_executed: statementsExecuted, statement_results: results, destructive_ops_detected: destructive, first_error: firstError, total_duration_ms },
      };
    });
  } catch (err) {
    return { ok: false, tool: "postgres_dry_run_migration", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. Apply migration · REAL write · typed confirmation gate
// ═══════════════════════════════════════════════════════════════════

export interface ApplyMigrationInput {
  sql: string;
  confirm_phrase: string;                   // must be 'APPLY MIGRATION' (or 'APPLY DESTRUCTIVE MIGRATION' for DROP/TRUNCATE)
  applied_by: string;                       // founder identifier
  task_id?: string;                         // audit trail
  allow_destructive?: boolean;              // must be explicitly set to true if destructive ops present
  known_hash?: string;                      // client passes hash of the SQL it saw · must match what we execute (prevents TOCTOU)
}

import { createHash } from "node:crypto";
function sha256(input: string): string { return createHash("sha256").update(input).digest("hex"); }

export interface ApplyMigrationResult {
  applied: boolean;
  statements_executed: number;
  applied_at: string;
  applied_by: string;
  sql_hash: string;
  destructive_ops_detected: DryRunResult["destructive_ops_detected"];
  results: DryRunResult["statement_results"];
  error?: string;
}

export async function postgresApplyMigration(input: ApplyMigrationInput): Promise<ToolResult<ApplyMigrationResult>> {
  const t0 = Date.now();
  const { sql, confirm_phrase, applied_by, task_id } = input;

  // Safety gate 1: SQL not empty
  if (!sql || sql.length < 3) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: "sql_empty" };

  // Safety gate 2: SHA-256 hash matches what caller sent (defence against mid-flight tampering)
  const hash = sha256(sql);
  if (input.known_hash && input.known_hash !== hash) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: "sql_hash_mismatch" };

  // Safety gate 3: destructive ops require explicit phrase + allow_destructive flag
  const destructive = detectDestructive(sql);
  const isDestructive = destructive.length > 0;
  const requiredPhrase = isDestructive ? "APPLY DESTRUCTIVE MIGRATION" : "APPLY MIGRATION";
  if (confirm_phrase !== requiredPhrase) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: `confirm_phrase_must_be_${requiredPhrase.replace(/ /g, "_")}` };
  if (isDestructive && !input.allow_destructive) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: "allow_destructive_flag_required" };

  // Safety gate 4: applied_by must be a real founder identifier
  if (!applied_by || applied_by.length < 3) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: "applied_by_required" };

  // Safety gate 5: only run against nex_dev · never touch prod
  const url = pgUrl();
  if (!/\/nex_dev\b/.test(url)) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: "refused_non_dev_database" };

  const statements = splitStatements(sql);
  if (statements.length === 0) return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: "no_statements_parsed" };

  try {
    return await withClient(async (c) => {
      const results: DryRunResult["statement_results"] = [];
      let statementsExecuted = 0;
      let hardFail = false;
      let errorMsg: string | undefined;
      await c.query("BEGIN");
      try {
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          try {
            const r = await c.query(stmt);
            results.push({ ordinal: i + 1, sql_snippet: stmt.slice(0, 200), status: "ok", rowCount: r.rowCount });
            statementsExecuted++;
          } catch (err) {
            const msg = (err as Error).message.slice(0, 300);
            results.push({ ordinal: i + 1, sql_snippet: stmt.slice(0, 200), status: "error", error: msg });
            errorMsg = msg;
            hardFail = true;
            break;
          }
        }
        if (hardFail) {
          await c.query("ROLLBACK");
        } else {
          await c.query("COMMIT");
        }
      } catch (err) {
        try { await c.query("ROLLBACK"); } catch { /* ignore */ }
        errorMsg = (err as Error).message.slice(0, 300);
        hardFail = true;
      }
      // Audit trail · always write to nex_agent.decisions (best-effort · doesn't block)
      try {
        await c.query(
          `INSERT INTO nex_agent.decisions (task_id, decision_kind, subject, rationale)
           VALUES ($1::uuid, $2, $3, $4)`,
          [task_id ?? null, "migration_apply", `sql_hash=${hash.slice(0, 12)}`, `applied_by=${applied_by} destructive=${isDestructive} statements=${statementsExecuted} success=${!hardFail} ${errorMsg ? "err="+errorMsg.slice(0,100) : ""}`],
        );
      } catch { /* audit is best-effort */ }
      const applied = !hardFail;
      return {
        ok: applied,
        tool: "postgres_apply_migration",
        duration_ms: Date.now() - t0,
        reason: errorMsg,
        data: {
          applied, statements_executed: statementsExecuted, applied_at: new Date().toISOString(),
          applied_by, sql_hash: hash, destructive_ops_detected: destructive, results, error: errorMsg,
        },
      };
    });
  } catch (err) { return { ok: false, tool: "postgres_apply_migration", duration_ms: Date.now() - t0, reason: (err as Error).message.slice(0, 200) }; }
}

// Export for the tools/index.ts registry
export const DATABASE_TOOLS = {
  postgres_schema_introspect: postgresSchemaIntrospect,
  postgres_dry_run_migration: postgresDryRunMigration,
  postgres_apply_migration: postgresApplyMigration,
};

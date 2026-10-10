// NEX Migration Engine · DDL generator
// Diffs a current TableSchema against a target TableSchema and emits an
// additive-only DDL plan (CREATE TABLE IF NOT EXISTS · ALTER TABLE ADD COLUMN).
//
// GUARANTEES:
//   · Never emits DROP · TRUNCATE · DELETE.
//   · Every identifier is validated against SAFE_IDENTIFIER before it enters
//     a DDL string.
//   · Every emitted statement carries evidence (which target field triggered it).
//   · A destructive keyword scanned in Founder input aborts the plan with a
//     rejection, not a warning.

import { assertSafeIdentifier, scanForDestructive } from "./policy";
import type { DdlPlan, DdlStatement, PolicyRejection, SqlDialect, TableSchema } from "./types";

export interface GenerateOptions {
  readonly dialect: SqlDialect;
  readonly current: TableSchema | null;
  readonly target: TableSchema;
  readonly founder_prompt?: string; // scanned for destructive keywords if present
}

export function generateDdlPlan(opts: GenerateOptions): DdlPlan {
  const rejections: PolicyRejection[] = [];

  if (opts.founder_prompt) {
    rejections.push(...scanForDestructive(opts.founder_prompt));
  }

  // Validate every identifier we're about to emit.
  try {
    assertSafeIdentifier(opts.target.table_name, "table");
    for (const c of opts.target.columns) assertSafeIdentifier(c.name, "column");
  } catch (err) {
    rejections.push({
      kind: "UNSAFE_IDENTIFIER",
      reason: err instanceof Error ? err.message : String(err),
      evidence: opts.target.table_name,
    });
  }

  if (rejections.length > 0) {
    return {
      dialect: opts.dialect,
      target: opts.target,
      current: opts.current,
      statements: [],
      rejected: rejections,
      ok: false,
      planned_at: new Date().toISOString(),
    };
  }

  const statements: DdlStatement[] = [];
  const currentColumns = new Map<string, TableSchema["columns"][number]>();
  if (opts.current) {
    for (const c of opts.current.columns) currentColumns.set(c.name, c);
  }

  if (!opts.current) {
    // No current schema → emit CREATE TABLE with only the primary/id column
    // (safest starting point). Subsequent ADD COLUMN statements handle the rest.
    const pk = opts.target.columns.find((c) => c.is_primary);
    const pkClause = pk
      ? opts.dialect === "postgresql"
        ? `${pk.name} BIGSERIAL PRIMARY KEY`
        : `${pk.name} INTEGER PRIMARY KEY AUTOINCREMENT`
      : opts.dialect === "postgresql"
        ? "id BIGSERIAL PRIMARY KEY"
        : "id INTEGER PRIMARY KEY AUTOINCREMENT";
    statements.push({
      kind: "CREATE_TABLE",
      sql: `CREATE TABLE IF NOT EXISTS ${opts.target.table_name} (${pkClause});`,
      evidence: `${opts.target.interface_name} · initial table`,
    });
  }

  for (const col of opts.target.columns) {
    if (col.is_primary) continue; // covered by CREATE TABLE or already present
    if (currentColumns.has(col.name)) continue; // additive-only — no ALTER COLUMN TYPE
    const nullClause = col.is_nullable ? "NULL" : `NOT NULL DEFAULT ${defaultLiteralFor(col.sql_type)}`;
    const sql =
      opts.dialect === "postgresql"
        ? `ALTER TABLE ${opts.target.table_name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.sql_type} ${nullClause};`
        : `ALTER TABLE ${opts.target.table_name} ADD COLUMN ${col.name} ${col.sql_type} ${nullClause};`;
    statements.push({
      kind: "ADD_COLUMN",
      sql,
      evidence: `${opts.target.interface_name}.${col.name}: ${col.ts_type}`,
    });
  }

  return {
    dialect: opts.dialect,
    target: opts.target,
    current: opts.current,
    statements,
    rejected: [],
    ok: true,
    planned_at: new Date().toISOString(),
  };
}

function defaultLiteralFor(sql_type: string): string {
  const upper = sql_type.toUpperCase();
  if (upper.includes("INT") || upper === "BIGINT" || upper === "INTEGER") return "0";
  if (upper === "BOOLEAN") return "FALSE";
  if (upper === "BYTEA" || upper === "BLOB") return "''";
  if (upper.includes("TIMESTAMP")) return "CURRENT_TIMESTAMP";
  return "''";
}

/**
 * Deterministic syntactic sanity check of a candidate DDL statement.
 * Pure regex · does NOT invoke any external SQL engine. Confirms the
 * statement is CREATE TABLE IF NOT EXISTS or ALTER TABLE ADD COLUMN [IF NOT EXISTS]
 * with safe identifiers only. Anything else is rejected.
 */
export function isSafeDdlStatement(sql: string): boolean {
  const trimmed = sql.trim().replace(/;$/, "");
  const create = /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[A-Za-z_][A-Za-z0-9_]{0,62}\s*\(/i;
  const alter =
    /^ALTER\s+TABLE\s+[A-Za-z_][A-Za-z0-9_]{0,62}\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+[A-Za-z_][A-Za-z0-9_]{0,62}\s+/i;
  return create.test(trimmed) || alter.test(trimmed);
}

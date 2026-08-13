#!/usr/bin/env node
// scripts/verify-migration-state.mjs
//
// Wave 3 · H1.b · Read-only NEX Postgres migration-state audit.
// Governed by: docs/headquarters-production-readiness/WAVE-3-H1-MIGRATION-HYGIENE.md
//
// PURPOSE
//   Closes gap #1 from the WORLD-CLASS-OPS gap register: there is no in-repo
//   audit surface for "which deploy/postgres/init/*.sql files are actually
//   applied on the NEX Postgres this URL points at."
//
// WHAT IT DOES
//   For every deploy/postgres/init/*.sql file it parses out representative
//   objects the migration should have created (CREATE TABLE, CREATE INDEX /
//   CREATE UNIQUE INDEX, CREATE FUNCTION) and probes the target DB via
//   information_schema.tables · pg_indexes · pg_proc. Reports per-migration
//   applied / not-applied / partial and per-object presence.
//
// SAFETY
//   READ-ONLY. Never writes. Never begins a transaction that mutates.
//
// USAGE
//   NEX_POSTGRES_URL=postgresql://... node scripts/verify-migration-state.mjs
//     or   npm run nex:verify-migration-state
//   --json         emit machine-readable output on stdout
//   --file <name>  restrict to a single migration file
//
// EXIT CODES
//   0 · every migration file's representative objects are present
//   1 · at least one migration file has missing objects
//   2 · env / connection error
//
// LIMITATIONS
//   · This is a REPRESENTATIVE check, not a full DDL diff. It confirms the
//     highest-value objects each migration ships (tables, indexes, functions).
//     Column-level ADD COLUMN completeness is out of scope for the first cut.
//   · Migrations without any CREATE statement (e.g. GRANT-only migrations) are
//     reported as `probe-not-applicable` and don't affect exit code.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const INIT_DIR = "deploy/postgres/init";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const fileFlagIdx = args.indexOf("--file");
const onlyFile = fileFlagIdx >= 0 ? args[fileFlagIdx + 1] : null;

const url = process.env.NEX_POSTGRES_URL;
if (!url) {
  console.error("[verify-migration-state] NEX_POSTGRES_URL not set · aborting");
  process.exit(2);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("[verify-migration-state] `pg` package not installed · run: npm install pg");
  process.exit(2);
}

const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.default.Pool({
  connectionString: url,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

function normalize(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

// ── Parse a migration file for representative objects ─────────────────
function parseMigrationObjects(sql) {
  const objects = [];

  // CREATE TABLE [IF NOT EXISTS] [schema.]name
  const tblRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/gi;
  for (const m of sql.matchAll(tblRe)) {
    const [schema, table] = m[1].includes(".") ? m[1].split(".") : ["public", m[1]];
    objects.push({ kind: "table", schema: schema.toLowerCase(), name: table.toLowerCase() });
  }

  // CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] name ON [schema.]table
  const idxRe = /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+ON\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/gi;
  for (const m of sql.matchAll(idxRe)) {
    const [schema, table] = m[2].includes(".") ? m[2].split(".") : ["public", m[2]];
    objects.push({ kind: "index", schema: schema.toLowerCase(), name: m[1].toLowerCase(), table: table.toLowerCase() });
  }

  // CREATE [OR REPLACE] FUNCTION [schema.]name(
  const fnRe = /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\s*\(/gi;
  for (const m of sql.matchAll(fnRe)) {
    const [schema, name] = m[1].includes(".") ? m[1].split(".") : ["public", m[1]];
    objects.push({ kind: "function", schema: schema.toLowerCase(), name: name.toLowerCase() });
  }

  return objects;
}

// ── Probe DB for each object ──────────────────────────────────────────
async function tableExists(schema, name) {
  const rows = await q(
    `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
    [schema, name],
  );
  return rows.length > 0;
}
async function indexExists(schema, name) {
  const rows = await q(
    `SELECT 1 FROM pg_indexes WHERE schemaname=$1 AND indexname=$2`,
    [schema, name],
  );
  return rows.length > 0;
}
async function functionExists(schema, name) {
  const rows = await q(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname=$1 AND p.proname=$2 LIMIT 1`,
    [schema, name],
  );
  return rows.length > 0;
}

async function probe(obj) {
  if (obj.kind === "table") return tableExists(obj.schema, obj.name);
  if (obj.kind === "index") return indexExists(obj.schema, obj.name);
  if (obj.kind === "function") return functionExists(obj.schema, obj.name);
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────
try {
  const allFiles = readdirSync(INIT_DIR).filter((f) => f.endsWith(".sql")).sort();
  const files = onlyFile ? allFiles.filter((f) => f === onlyFile) : allFiles;
  if (files.length === 0) {
    console.error(`no migration files matched (dir=${INIT_DIR} · onlyFile=${onlyFile ?? "(none)"})`);
    process.exit(2);
  }

  const report = [];
  let failed = 0;

  for (const file of files) {
    const sql = readFileSync(join(INIT_DIR, file), "utf8");
    const objects = parseMigrationObjects(sql);
    const rows = [];
    for (const obj of objects) {
      const present = await probe(obj);
      rows.push({ ...obj, present });
    }
    const total = rows.length;
    const missing = rows.filter((r) => !r.present);
    let verdict;
    if (total === 0) verdict = "probe-not-applicable";
    else if (missing.length === 0) verdict = "applied";
    else if (missing.length < total) verdict = "partial";
    else verdict = "not-applied";
    if (verdict === "partial" || verdict === "not-applied") failed++;
    report.push({ file, verdict, total, missing_count: missing.length, objects: rows });
  }

  if (asJson) {
    console.log(JSON.stringify({ target: url.replace(/:[^:@]+@/, ":***@"), report }, null, 2));
  } else {
    console.log("── NEX Postgres migration state ──");
    console.log(`  target : ${url.replace(/:[^:@]+@/, ":***@")}`);
    console.log(`  files  : ${files.length}${onlyFile ? " (filtered)" : ""}`);
    console.log("");
    for (const r of report) {
      const badge = r.verdict === "applied" ? "✓"
                  : r.verdict === "partial" ? "△"
                  : r.verdict === "not-applied" ? "✗"
                  : "·";
      console.log(`  ${badge} ${r.file}  [${r.verdict}]  ${r.total - r.missing_count}/${r.total} objects present`);
      if (r.verdict === "partial" || r.verdict === "not-applied") {
        for (const o of r.objects.filter((x) => !x.present)) {
          console.log(`      missing ${o.kind} ${o.schema}.${o.name}${o.kind === "index" ? ` (on ${o.table})` : ""}`);
        }
      }
    }
    console.log("");
    console.log(`Summary · ${report.length - failed}/${report.length} migrations fully applied · ${failed} with missing objects`);
  }

  // Wave 3 · H4.c · env-parity check for the Migration 049 activation gate.
  // If NEX_ANALYTICS_ROLLUP_ASYNC=1 in the current shell AND migration 049
  // is not fully applied, surface a distinct WARNING pointing operators at
  // WAVE-3-H4-MIGRATION-049-GATE.md · this is non-blocking here · deploy-
  // branch CI wiring may treat it as blocking (H1.c open item · same track).
  const asyncFlagOn = process.env.NEX_ANALYTICS_ROLLUP_ASYNC === "1";
  const m049 = report.find((r) => r.file === "049_analytics_rollup_queue.sql");
  const m049Ready = m049 && m049.verdict === "applied";
  if (asyncFlagOn && !m049Ready) {
    const detail = m049
      ? `${m049.verdict} · ${m049.missing_count}/${m049.total} objects missing`
      : "not in the current inventory (use a wider --file filter or omit --file to include it)";
    const banner = `H4 env-parity WARNING · NEX_ANALYTICS_ROLLUP_ASYNC=1 but migration 049 is ${detail} · the runtime gate at src/lib/nex/analytics/rollup-gate.ts will refuse activation · apply 049 via npm run nex:apply-storage-schema before enabling this flag in production`;
    if (asJson) {
      // Attach the warning to a well-known key so tooling can pick it up.
      console.log(JSON.stringify({ h4_env_parity_warning: banner }));
    } else {
      console.log("");
      console.log(`⚠ ${banner}`);
    }
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
} catch (e) {
  console.error("[verify-migration-state] error:", e instanceof Error ? e.message : String(e));
  try { await pool.end(); } catch { /* swallow */ }
  process.exit(2);
}

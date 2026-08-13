#!/usr/bin/env node
// scripts/schema-diff-supabase-vs-postgres.mjs
//
// Wave 5 prereq · P1 schema-diff pre-flight for brain-backfill.
//
// Compares the shape of every brain table on NEX Supabase against the
// same-named table on our local nex.* Postgres. Highlights:
//   · tables present on one side, missing on the other
//   · columns present on one side, missing on the other
//   · index presence (Postgres side only · Supabase side reported as
//     UNKNOWN because PostgREST does not expose pg_indexes without an
//     RPC)
//   · foreign keys / primary keys (Postgres side only)
//   · RLS policies (Postgres side only)
//   · migrations known to be un-applied on Supabase (Migration 004
//     `worker_audit_events` is the audit-flagged known miss)
//
// Read-only. Zero writes. Complements brain-parity-report.mjs which
// counts ROWS · this script compares SHAPE.
//
// USAGE
//   node scripts/schema-diff-supabase-vs-postgres.mjs
//   node scripts/schema-diff-supabase-vs-postgres.mjs --json
//
// EXIT CODES
//   0 · schemas structurally aligned (no missing tables, no missing
//     columns present in either direction) · safe to execute backfill
//   2 · drift present · backfill will fail or drop data · MUST fix
//     first via a migration or a column add
//   1 · runner fatal (env vars, network, etc.)
//
// GUARDRAILS
//   · Uses PostgREST for Supabase introspection: one sample row per
//     table with `select=*&limit=1` · column names are read from the
//     JSON response. If a table has zero rows, columns are inferred
//     from an OPTIONS request to the endpoint (PostgREST returns the
//     column list in the response headers).
//   · No mutations against either side. `Prefer: return=headers-only`
//     used where possible to keep payloads minimal.

import { readFileSync } from "node:fs";
import pg from "pg";
const { Pool } = pg;

const args = process.argv.slice(2);
const AS_JSON = args.includes("--json");

const ENV = readFileSync(".env.local", "utf8");
const NEX_URL = (ENV.match(/^NEXT_PUBLIC_NEX_SUPABASE_URL=(\S+)/m) || [])[1];
const NEX_KEY = (ENV.match(/^NEX_SUPABASE_SERVICE_ROLE_KEY=(\S+)/m) || [])[1];
const PG_URL  = (ENV.match(/^NEX_POSTGRES_URL=(\S+)/m) || [])[1]
              || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

if (!NEX_URL || !NEX_KEY) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: PG_URL, max: 2 });

// The 14 brain tables · same set as brain-parity-report.mjs
const TABLES = [
  "knowledge_records",
  "record_versions",
  "graph_edges",
  "worker_jobs",
  "worker_results",
  "sources",
  "confidence_scores",
  "contradictions",
  "deprecations",
  "knowledge_feedback",
  "audit_log",
  "llm_retry_queue",
  "worker_heartbeats",
  "worker_audit_events", // Migration 004 · known miss on Supabase per audit
];

// ── Supabase introspection · sample-based ────────────────────────────

async function supaColumns(table) {
  // 1) Try to read a sample row · fastest path when the table has rows
  const url = `${NEX_URL}/rest/v1/${table}?select=*&limit=1`;
  const r = await fetch(url, {
    headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
  });
  if (r.status === 404 || r.status === 400) {
    // Table missing on Supabase
    return { present: false, columns: null, error: `HTTP ${r.status}` };
  }
  if (!r.ok) {
    return { present: false, columns: null, error: `HTTP ${r.status}` };
  }
  const rows = await r.json();
  if (Array.isArray(rows) && rows.length > 0) {
    return { present: true, columns: Object.keys(rows[0]).sort(), source: "sample-row" };
  }
  // 2) Empty table · fall back to OPTIONS request · PostgREST returns
  //    a description that includes columns in the response body.
  const opt = await fetch(url, {
    method: "OPTIONS",
    headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
  });
  if (!opt.ok) {
    return { present: true, columns: [], source: "empty-no-options", note: `OPTIONS returned ${opt.status}` };
  }
  const text = await opt.text().catch(() => "");
  // PostgREST OPTIONS returns a plain text/OpenAPI body · try JSON first
  let cols = [];
  try {
    const j = JSON.parse(text);
    if (j?.definitions?.[table]?.properties) {
      cols = Object.keys(j.definitions[table].properties).sort();
    }
  } catch { /* body wasn't JSON · leave cols empty */ }
  return { present: true, columns: cols, source: cols.length ? "options-openapi" : "empty-unknown" };
}

// ── Postgres introspection · full ────────────────────────────────────

async function pgColumns(table) {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='nex' AND table_name=$1 ORDER BY column_name`, [table],
  );
  return r.rows.length ? r.rows.map((x) => x.column_name) : null;
}
async function pgIndexes(table) {
  const r = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname='nex' AND tablename=$1 ORDER BY indexname`, [table],
  );
  return r.rows;
}
async function pgConstraints(table) {
  const r = await pool.query(
    `SELECT conname, contype, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class      t ON t.oid = c.conrelid
       JOIN pg_namespace  n ON n.oid = t.relnamespace
      WHERE n.nspname='nex' AND t.relname=$1 ORDER BY conname`, [table],
  );
  return r.rows;
}
async function pgPolicies(table) {
  const r = await pool.query(
    `SELECT policyname, cmd, qual, with_check FROM pg_policies
      WHERE schemaname='nex' AND tablename=$1 ORDER BY policyname`, [table],
  );
  return r.rows;
}

// ── Diff logic ───────────────────────────────────────────────────────

function diffColumns(supaCols, pgCols) {
  if (!supaCols) return { onlySupa: [], onlyPg: pgCols ?? [] };
  if (!pgCols)   return { onlySupa: supaCols, onlyPg: [] };
  const supa = new Set(supaCols);
  const pg   = new Set(pgCols);
  return {
    onlySupa: supaCols.filter((c) => !pg.has(c)),
    onlyPg:   pgCols.filter((c) => !supa.has(c)),
  };
}

// ── Reporter ─────────────────────────────────────────────────────────

function line(marker, table, note = "") {
  return `  ${marker}  ${table.padEnd(24)}  ${note}`;
}

async function main() {
  const perTable = [];
  let drift = 0;

  for (const t of TABLES) {
    const supa = await supaColumns(t).catch((e) => ({ present: false, error: e.message }));
    const pg   = await pgColumns(t);
    const idx  = pg ? await pgIndexes(t) : [];
    const cons = pg ? await pgConstraints(t) : [];
    const pol  = pg ? await pgPolicies(t) : [];
    const cdiff = diffColumns(supa.columns, pg);

    // Empty table + no OpenAPI response = we cannot judge column
    // shape from PostgREST alone. Report as inconclusive rather than
    // labelling every Postgres column as a drift finding.
    const supaColsUnknown =
      supa.present && (!supa.columns || supa.columns.length === 0) &&
      (supa.source === "empty-no-options" || supa.source === "empty-unknown");

    const state =
      !supa.present && !pg                              ? "missing-both"           :
      !supa.present &&  pg                              ? "missing-supa"           :
       supa.present && !pg                              ? "missing-pg"             :
       supaColsUnknown                                  ? "supa-empty-unknown"     :
      (cdiff.onlySupa.length + cdiff.onlyPg.length) > 0 ? "column-drift"           :
                                                          "aligned";
    // Only real drift counts against exit code · empty-unknown is
    // inconclusive and requires operator confirmation.
    if (state === "missing-supa" || state === "missing-pg" || state === "column-drift") drift += 1;

    perTable.push({
      table: t,
      supa: { present: supa.present, columns: supa.columns ?? [], source: supa.source ?? null, error: supa.error ?? null },
      pg:   { present: !!pg,          columns: pg ?? [],           indexes: idx, constraints: cons, policies: pol },
      diff: cdiff,
      state,
    });
  }

  if (AS_JSON) {
    process.stdout.write(JSON.stringify({ generated_at: new Date().toISOString(), drift_tables: drift, tables: perTable }, null, 2) + "\n");
    await pool.end();
    process.exit(drift === 0 ? 0 : 2);
  }

  // Pretty text report
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BRAIN SCHEMA DIFF · Supabase vs NEX Postgres · read-only");
  console.log(`  supa: ${NEX_URL.replace(/https:\/\//, "").slice(0, 40)}`);
  console.log(`  pg:   ${PG_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const row of perTable) {
    let marker, label;
    switch (row.state) {
      case "aligned":            marker = "✓"; label = "aligned (same columns)"; break;
      case "missing-both":       marker = "░"; label = "missing on BOTH sides"; break;
      case "missing-supa":       marker = "!"; label = "MISSING on Supabase (Postgres has it)"; break;
      case "missing-pg":         marker = "*"; label = "MISSING on Postgres (Supabase has it)"; break;
      case "column-drift":       marker = "≠"; label = `column drift · supa-only=${row.diff.onlySupa.length} pg-only=${row.diff.onlyPg.length}`; break;
      case "supa-empty-unknown": marker = "?"; label = "supa table is empty · column shape not visible via REST · confirm via SQL editor"; break;
      default:                   marker = "?"; label = row.state;
    }
    console.log(line(marker, row.table, label));
    if (row.state === "column-drift") {
      if (row.diff.onlySupa.length) console.log(`      supa-only cols: ${row.diff.onlySupa.join(", ")}`);
      if (row.diff.onlyPg.length)   console.log(`      pg-only cols:   ${row.diff.onlyPg.join(", ")}`);
    }
    if (row.state === "missing-supa") {
      // Note the known miss explicitly if we recognise it
      if (row.table === "worker_audit_events") {
        console.log(`      known miss · Migration 004 not applied to Supabase (audit Section 4)`);
      }
      console.log(`      pg columns: ${row.pg.columns.join(", ")}`);
    }
    if (row.state === "missing-pg" && row.supa.columns.length) {
      console.log(`      supa columns: ${row.supa.columns.join(", ")}`);
    }
  }

  // Postgres-side extra findings (indexes · constraints · policies)
  console.log("\n───────────────────────────────────────────────────────────────");
  console.log("  POSTGRES-SIDE INDEX + POLICY SUMMARY (Supabase side UNKNOWN)");
  console.log("───────────────────────────────────────────────────────────────");
  for (const row of perTable.filter((r) => r.pg.present)) {
    const idxN = row.pg.indexes.length;
    const conN = row.pg.constraints.length;
    const polN = row.pg.policies.length;
    console.log(`  · ${row.table.padEnd(24)}  indexes=${String(idxN).padStart(2)} · constraints=${String(conN).padStart(2)} · RLS policies=${String(polN).padStart(2)}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  DRIFT TABLES: ${drift}  ${drift === 0 ? "· schemas structurally aligned" : "· fix required BEFORE brain-backfill --execute"}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n  Notes:");
  console.log("  · This tool infers Supabase columns from a sample row OR an OPTIONS request.");
  console.log("    Empty tables with no OpenAPI response yield an empty column list.");
  console.log("  · Supabase-side indexes + RLS are UNKNOWN via REST · run a Supabase SQL");
  console.log("    editor snippet to confirm pg_indexes + pg_policies match Postgres.");
  console.log("  · Migration 004 (worker_audit_events) is the known miss on Supabase per audit.");

  await pool.end();
  process.exit(drift === 0 ? 0 : 2);
}

main().catch(async (err) => {
  console.error("schema-diff fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});

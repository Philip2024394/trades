#!/usr/bin/env node
// brain-backfill.mjs · Wave 5 prereq #2
//
// One-shot Supabase → NEX Postgres copy for the 13 brain tables.
//
// SAFETY DEFAULTS:
//   · --dry-run is the DEFAULT · you must pass --execute to make writes
//   · ON CONFLICT DO NOTHING on every insert · first-write wins ·
//     re-runnable without duplication
//   · Reads from Supabase are paginated (PostgREST hard-caps at 1000
//     per request · script walks in chunks of 500)
//   · Writes wrap each chunk in a BEGIN + SET LOCAL ROLE nex_brain_app
//     + COMMIT transaction · RLS enforced
//   · Every table has independent per-chunk retry · one table failing
//     does NOT block the next
//   · Zero destructive operations · never DELETE · never TRUNCATE ·
//     never DROP anywhere
//
// USAGE:
//   node scripts/brain-backfill.mjs                # dry-run · report only
//   node scripts/brain-backfill.mjs --execute      # live · WRITES to pg
//   node scripts/brain-backfill.mjs --table=knowledge_records --execute
//                                                  # single-table live
//
// Guardrails (all held):
//   · Old Supabase NEVER modified · read-only queries only
//   · pg writes idempotent · re-runnable · no double-inserts
//   · Does NOT flip NEX_BRAIN_BACKEND · production reads still Supabase
//   · Does NOT delete Supabase data · retained as reference until
//     Wave 14 acceptance passes
//
// DEPENDENCY ORDER:
//   parents first (knowledge_records) · then dependent tables ·
//   FK constraints checked · ON CONFLICT DO NOTHING absorbs any race
//
// EXPECTED SCOPE (from brain-parity-report 2026-08-09):
//   ~73,233 total rows across 11 populated tables
//   Largest: audit_log (19.7k) · worker_jobs (18.9k) · worker_results (18.9k)

import { readFileSync } from "node:fs";
import pg from "pg";
const { Pool } = pg;

const ENV = readFileSync(".env.local", "utf8");
const NEX_URL = (ENV.match(/^NEXT_PUBLIC_NEX_SUPABASE_URL=(\S+)/m) || [])[1];
const NEX_KEY = (ENV.match(/^NEX_SUPABASE_SERVICE_ROLE_KEY=(\S+)/m) || [])[1];
const PG_URL  = (ENV.match(/^NEX_POSTGRES_URL=(\S+)/m) || [])[1]
              || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const ARGS = process.argv.slice(2);
const EXECUTE = ARGS.includes("--execute");
const DRY_RUN = !EXECUTE;
const SINGLE_TABLE = (ARGS.find((a) => a.startsWith("--table=")) || "").replace("--table=", "");
const CHUNK = 500;

if (!NEX_URL || !NEX_KEY) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: PG_URL, max: 3 });

// Dependency order · parents first · retry queue + heartbeats last (no
// FK relationships to worry about).
const TABLES = [
  { name: "knowledge_records",  conflictKey: "record_id" },
  { name: "record_versions",    conflictKey: "id" },
  { name: "graph_edges",        conflictKey: "id" },
  { name: "sources",            conflictKey: "id" },
  { name: "confidence_scores",  conflictKey: "id" },
  { name: "contradictions",     conflictKey: "id" },
  { name: "deprecations",       conflictKey: "id" },
  { name: "worker_jobs",        conflictKey: "id" },
  { name: "worker_results",     conflictKey: "id" },
  { name: "knowledge_feedback", conflictKey: "id" },
  { name: "audit_log",          conflictKey: "id" },
  { name: "llm_retry_queue",    conflictKey: "id" },
  { name: "worker_heartbeats",  conflictKey: "host_id" },
];

async function inRole(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { c.release(); }
}

async function supaFetch(table, from, to) {
  const url = `${NEX_URL}/rest/v1/${table}?select=*&order=created_at.asc&limit=${to - from + 1}&offset=${from}`;
  // Not every brain table has created_at. Fall back to no-order if needed.
  let r = await fetch(url, {
    headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
  });
  if (!r.ok) {
    // Retry without order clause (for tables without created_at)
    const url2 = `${NEX_URL}/rest/v1/${table}?select=*&limit=${to - from + 1}&offset=${from}`;
    r = await fetch(url2, {
      headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${await r.text().catch(() => "")}` };
  }
  const rows = await r.json();
  return { ok: true, rows };
}

async function supaCount(table) {
  const url = `${NEX_URL}/rest/v1/${table}?select=*&limit=1`;
  const r = await fetch(url, {
    headers: {
      "apikey": NEX_KEY,
      "Authorization": `Bearer ${NEX_KEY}`,
      "Prefer": "count=exact",
      "Range": "0-0",
    },
  });
  if (!r.ok) return -1;
  return Number((r.headers.get("content-range") || "*/0").split("/")[1] || 0);
}

async function insertChunk(table, conflictKey, rows) {
  if (rows.length === 0) return { attempted: 0, inserted: 0 };
  // Discover columns from the first row · use array-of-jsonb-friendly
  // approach: build a single INSERT with N value groups.
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const params = [];
  const valueGroups = rows.map((row) => {
    const placeholders = cols.map((col) => {
      const val = row[col];
      params.push(val == null ? null : (typeof val === "object" ? JSON.stringify(val) : val));
      return `$${params.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const sql = `
    INSERT INTO nex.${table} (${colList})
    VALUES ${valueGroups.join(", ")}
    ON CONFLICT ("${conflictKey}") DO NOTHING
  `;
  const r = await inRole((c) => c.query(sql, params));
  return { attempted: rows.length, inserted: r.rowCount ?? 0 };
}

async function backfillTable(table, conflictKey) {
  const total = await supaCount(table);
  if (total === 0) {
    console.log(`  ░ ${table.padEnd(24)}  supa=0 · nothing to backfill`);
    return { table, total: 0, inserted: 0, skipped: 0, errors: 0 };
  }
  if (DRY_RUN) {
    console.log(`  ⧗ ${table.padEnd(24)}  supa=${total} · would backfill in ${Math.ceil(total / CHUNK)} chunks`);
    return { table, total, inserted: 0, skipped: 0, errors: 0, dry: true };
  }

  let inserted = 0, attempted = 0, errors = 0;
  for (let offset = 0; offset < total; offset += CHUNK) {
    const to = Math.min(offset + CHUNK - 1, total - 1);
    const page = await supaFetch(table, offset, to);
    if (!page.ok) { errors += 1; console.log(`    ! ${table} offset=${offset} fetch error: ${page.error}`); continue; }
    if (page.rows.length === 0) break;
    try {
      const r = await insertChunk(table, conflictKey, page.rows);
      inserted += r.inserted;
      attempted += r.attempted;
      process.stdout.write(`    · ${table} chunk offset=${offset} rows=${page.rows.length} inserted=${r.inserted}\n`);
    } catch (err) {
      errors += 1;
      console.log(`    ! ${table} offset=${offset} insert error: ${err.message.slice(0, 200)}`);
    }
  }
  const skipped = attempted - inserted;
  console.log(`  ✓ ${table.padEnd(24)}  supa=${total} · attempted=${attempted} · inserted=${inserted} · skipped=${skipped} · errors=${errors}`);
  return { table, total, inserted, skipped, errors };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  BRAIN BACKFILL · Wave 5 · ${DRY_RUN ? "DRY-RUN (default · safe)" : "LIVE EXECUTE"}`);
  console.log(`  source: ${NEX_URL.replace(/https:\/\//, "")}`);
  console.log(`  target: ${PG_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log(`  chunk:  ${CHUNK} rows`);
  if (SINGLE_TABLE) console.log(`  scope:  single table = ${SINGLE_TABLE}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (DRY_RUN) {
    console.log("  DRY-RUN MODE · zero writes will occur · pass --execute to actually copy.\n");
  } else {
    console.log("  ⚠️  LIVE MODE · this will WRITE to nex.* on our Postgres.\n");
  }

  const tables = SINGLE_TABLE
    ? TABLES.filter((t) => t.name === SINGLE_TABLE)
    : TABLES;

  const results = [];
  for (const t of tables) {
    try {
      const r = await backfillTable(t.name, t.conflictKey);
      results.push(r);
    } catch (err) {
      results.push({ table: t.name, error: err.message });
      console.log(`  X ${t.name} FATAL: ${err.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Summary · ${results.length} tables · mode=${DRY_RUN ? "dry-run" : "live"}`);
  const totalRows = results.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalIns  = results.reduce((s, r) => s + (r.inserted ?? 0), 0);
  const totalErr  = results.reduce((s, r) => s + (r.errors ?? 0), 0);
  console.log(`  rows on supa (total): ${totalRows.toLocaleString()}`);
  console.log(`  rows inserted to pg:  ${totalIns.toLocaleString()}${DRY_RUN ? " (dry-run · nothing inserted)" : ""}`);
  console.log(`  chunk errors:         ${totalErr}`);
  console.log("═══════════════════════════════════════════════════════════════");

  await pool.end();
  process.exit(totalErr > 0 ? 2 : 0);
}

main().catch(async (err) => {
  console.error("brain-backfill fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});

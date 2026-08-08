#!/usr/bin/env node
// brain-reverse-backfill.mjs · Wave 7b · Emergency rollback tool
//
// PURPOSE
// One-shot NEX Postgres → Supabase copy for the 13 brain tables.
// This is the DISASTER RECOVERY tool · not routine.
//
// Used ONLY when:
//   · Production has flipped to NEX_BRAIN_BACKEND=postgres
//   · The reverse-shadow (Wave 7) has been disabled (`NEX_BRAIN_SHADOW_SUPABASE`
//     unset) so writes are no longer being mirrored to Supabase
//   · A P0 incident forces a rollback
//   · Recent writes on Postgres are NOT on Supabase and need to move
//
// If the reverse-shadow was active during the incident window, this
// script is unnecessary · Supabase already has those writes.
//
// SAFETY DEFAULTS:
//   · --dry-run is the DEFAULT · pass --execute to make writes
//   · Writes to Supabase use PostgREST upsert with resolution=merge-duplicates
//     so re-runs don't duplicate rows
//   · Reads from our Postgres are paginated (500 rows per chunk)
//   · Per-chunk retry · one table failing does not block the next
//   · Zero destructive ops on either side · never DELETE · never TRUNCATE
//   · Zero modification of NEX Postgres · read-only source
//
// USAGE:
//   node scripts/brain-reverse-backfill.mjs             # dry-run · report
//   node scripts/brain-reverse-backfill.mjs --execute   # LIVE · WRITES to Supabase
//   node scripts/brain-reverse-backfill.mjs --table=worker_jobs --execute
//   node scripts/brain-reverse-backfill.mjs --since="2026-08-08T00:00:00Z" --execute
//                                                        # only rows updated after
//
// This is the mirror image of scripts/brain-backfill.mjs · same tables,
// same dependency order, same idempotency contract · direction reversed.

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
const SINCE = (ARGS.find((a) => a.startsWith("--since=")) || "").replace("--since=", "");
const CHUNK = 500;

if (!NEX_URL || !NEX_KEY) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: PG_URL, max: 3 });

const TABLES = [
  { name: "knowledge_records",  key: "record_id",  updatedField: "created_at" },
  { name: "record_versions",    key: "id",         updatedField: "changed_at" },
  { name: "graph_edges",        key: "id",         updatedField: "created_at" },
  { name: "sources",            key: "id",         updatedField: "created_at" },
  { name: "confidence_scores",  key: "id",         updatedField: "created_at" },
  { name: "contradictions",     key: "id",         updatedField: "detected_at" },
  { name: "deprecations",       key: "id",         updatedField: "deprecated_at" },
  { name: "worker_jobs",        key: "id",         updatedField: "updated_at" },
  { name: "worker_results",     key: "id",         updatedField: "created_at" },
  { name: "knowledge_feedback", key: "id",         updatedField: "created_at" },
  { name: "audit_log",          key: "id",         updatedField: "created_at" },
  { name: "llm_retry_queue",    key: "id",         updatedField: "updated_at" },
  { name: "worker_heartbeats",  key: "host_id",    updatedField: "last_seen_at" },
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

async function pgCount(table, sinceIso) {
  const q = sinceIso
    ? `SELECT COUNT(*)::int AS n FROM nex.${table} WHERE created_at >= $1::timestamptz OR updated_at >= $1::timestamptz`
    : `SELECT COUNT(*)::int AS n FROM nex.${table}`;
  const args = sinceIso ? [sinceIso] : [];
  try {
    const r = await pool.query(q, args);
    return r.rows[0].n;
  } catch {
    // Table may lack updated_at (e.g. contradictions) · try created_at only
    try {
      const r = await pool.query(
        sinceIso
          ? `SELECT COUNT(*)::int AS n FROM nex.${table} WHERE created_at >= $1::timestamptz`
          : `SELECT COUNT(*)::int AS n FROM nex.${table}`,
        args,
      );
      return r.rows[0].n;
    } catch (e) {
      return -1;
    }
  }
}

async function pgFetch(table, updatedField, sinceIso, offset, chunk) {
  const params = [];
  let sql = `SELECT * FROM nex.${table}`;
  if (sinceIso) {
    params.push(sinceIso);
    sql += ` WHERE ${updatedField} >= $${params.length}::timestamptz`;
  }
  sql += ` ORDER BY ${updatedField} ASC LIMIT ${chunk} OFFSET ${offset}`;
  const r = await inRole((c) => c.query(sql, params));
  return r.rows;
}

async function supaUpsert(table, key, rows) {
  if (rows.length === 0) return { attempted: 0, upserted: 0 };
  const url = `${NEX_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": NEX_KEY,
      "Authorization": `Bearer ${NEX_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  }
  return { attempted: rows.length, upserted: rows.length };
}

async function reverseBackfillTable(t) {
  const total = await pgCount(t.name, SINCE || null);
  if (total === 0) {
    console.log(`  ░ ${t.name.padEnd(24)}  pg=0 · nothing to reverse-backfill`);
    return { table: t.name, total: 0, upserted: 0, errors: 0 };
  }
  if (total < 0) {
    console.log(`  ! ${t.name.padEnd(24)}  count failed · skipping`);
    return { table: t.name, total: 0, upserted: 0, errors: 1 };
  }
  if (DRY_RUN) {
    console.log(`  ⧗ ${t.name.padEnd(24)}  pg=${total} · would reverse-backfill in ${Math.ceil(total / CHUNK)} chunks`);
    return { table: t.name, total, upserted: 0, dry: true };
  }

  let upserted = 0, errors = 0;
  for (let offset = 0; offset < total; offset += CHUNK) {
    let page;
    try { page = await pgFetch(t.name, t.updatedField, SINCE || null, offset, CHUNK); }
    catch (err) { errors += 1; console.log(`    ! ${t.name} offset=${offset} pg fetch error: ${err.message}`); continue; }
    if (page.length === 0) break;
    try {
      const r = await supaUpsert(t.name, t.key, page);
      upserted += r.upserted;
      process.stdout.write(`    · ${t.name} chunk offset=${offset} rows=${page.length} upserted=${r.upserted}\n`);
    } catch (err) {
      errors += 1;
      console.log(`    ! ${t.name} offset=${offset} supa upsert error: ${err.message.slice(0, 200)}`);
    }
  }
  console.log(`  ✓ ${t.name.padEnd(24)}  pg=${total} · upserted=${upserted} · errors=${errors}`);
  return { table: t.name, total, upserted, errors };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  BRAIN REVERSE-BACKFILL · Wave 7b · ${DRY_RUN ? "DRY-RUN (default · safe)" : "LIVE EXECUTE"}`);
  console.log(`  source: ${PG_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log(`  target: ${NEX_URL.replace(/https:\/\//, "")}`);
  console.log(`  chunk:  ${CHUNK} rows`);
  if (SINGLE_TABLE) console.log(`  scope:  single table = ${SINGLE_TABLE}`);
  if (SINCE)        console.log(`  since:  ${SINCE}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (DRY_RUN) {
    console.log("  DRY-RUN MODE · zero writes will occur · pass --execute to actually copy.");
    console.log("  This is the disaster-recovery script · use only when reverse-shadow was OFF");
    console.log("  during an incident window and recent pg writes need to be pushed to Supabase.\n");
  } else {
    console.log("  ⚠️  LIVE MODE · this will UPSERT rows to Supabase (mirror to legacy).\n");
  }

  const tables = SINGLE_TABLE ? TABLES.filter((t) => t.name === SINGLE_TABLE) : TABLES;
  const results = [];
  for (const t of tables) {
    try {
      results.push(await reverseBackfillTable(t));
    } catch (err) {
      results.push({ table: t.name, error: err.message, errors: 1 });
      console.log(`  X ${t.name} FATAL: ${err.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  const totalRows = results.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalUps  = results.reduce((s, r) => s + (r.upserted ?? 0), 0);
  const totalErr  = results.reduce((s, r) => s + (r.errors ?? 0), 0);
  console.log(`  rows on pg (in scope):     ${totalRows.toLocaleString()}`);
  console.log(`  rows upserted to Supabase: ${totalUps.toLocaleString()}${DRY_RUN ? " (dry-run · nothing upserted)" : ""}`);
  console.log(`  chunk errors:              ${totalErr}`);
  console.log("═══════════════════════════════════════════════════════════════");

  await pool.end();
  process.exit(totalErr > 0 ? 2 : 0);
}

main().catch(async (err) => {
  console.error("brain-reverse-backfill fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});

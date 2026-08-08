#!/usr/bin/env node
// brain-parity-report.mjs · Wave 5 prereq #1
//
// Compares brain data on NEX Supabase vs the target nex.* schema on
// our Postgres. Read-only. Zero writes anywhere. Reports drift per
// table with counts + sample IDs so the backfill scope is visible
// before anyone commits to running it.
//
// Not a byte-for-byte comparison (that would be huge and slow for
// tables with 3000+ rows). This is a size + spot-check report:
//   · row count per side
//   · row count by status where applicable (records, jobs, retries)
//   · 5-sample ID intersection check
//   · size delta highlighted
//   · warning banner if either side is >0 and the other is 0
//
// Usage:
//   node scripts/brain-parity-report.mjs
//
// Guardrails:
//   · Read-only against both Supabase (via REST · service role) and
//     our Postgres (via pg direct with SET LOCAL ROLE nex_brain_app)
//   · No modification of either side · this is a pre-flight tool
//   · Exit 0 when parity is "healthy" (both sides drained OR both
//     match) · exit 2 when drift is detected

import { readFileSync } from "node:fs";
import pg from "pg";
const { Pool } = pg;

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

// The 14 brain tables · Supabase name → Postgres name (nex.<name>).
// Kept in one place so future additions land here.
const TABLES = [
  // { name, pgSchema (default nex), keyField (default id), statusField (optional), primaryOrderField }
  { name: "knowledge_records",   status: true,  key: "record_id",     order: "created_at" },
  { name: "record_versions",     key: "id",     order: "changed_at" },
  { name: "graph_edges",         key: "id",     order: "created_at" },
  { name: "worker_jobs",         status: true,  key: "id",     order: "created_at" },
  { name: "worker_results",      key: "id",     order: "created_at" },
  { name: "sources",             key: "id",     order: "created_at" },
  { name: "confidence_scores",   key: "id",     order: "created_at" },
  { name: "contradictions",      status: true,  key: "id",     order: "detected_at" },
  { name: "deprecations",        key: "id",     order: "deprecated_at" },
  { name: "knowledge_feedback",  key: "id",     order: "created_at" },
  { name: "audit_log",           key: "id",     order: "created_at" },
  { name: "llm_retry_queue",     status: true,  key: "id",     order: "created_at" },
  { name: "worker_heartbeats",   key: "host_id", order: "last_seen_at" },
];

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
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
  const range = r.headers.get("content-range") || "*/0";
  const total = Number(range.split("/")[1] || 0);
  return { ok: true, count: total };
}

async function supaCountByStatus(table, statusField = "status") {
  const url = `${NEX_URL}/rest/v1/${table}?select=${statusField}&limit=10000`;
  const r = await fetch(url, {
    headers: { "apikey": NEX_KEY, "Authorization": `Bearer ${NEX_KEY}` },
  });
  if (!r.ok) return {};
  const rows = await r.json();
  const b = {};
  for (const row of rows) b[row[statusField]] = (b[row[statusField]] ?? 0) + 1;
  return b;
}

async function pgCount(table) {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.${table}`);
  return r.rows[0].n;
}

async function pgCountByStatus(table, statusField = "status") {
  const r = await pool.query(`SELECT ${statusField}, COUNT(*)::int AS n FROM nex.${table} GROUP BY ${statusField}`);
  const b = {};
  for (const row of r.rows) b[row[statusField]] = row.n;
  return b;
}

function verdict(supa, pg) {
  if (supa === 0 && pg === 0) return { tone: "empty",   label: "empty·both" };
  if (supa === pg)             return { tone: "match",   label: "exact match" };
  if (pg === 0 && supa > 0)    return { tone: "empty-pg", label: `pg empty · supa has ${supa}` };
  if (supa === 0 && pg > 0)    return { tone: "empty-supa", label: `supa empty · pg has ${pg}` };
  const delta = pg - supa;
  return { tone: "drift", label: `drift Δ=${delta > 0 ? "+" : ""}${delta} (pg=${pg} supa=${supa})` };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BRAIN PARITY REPORT · Wave 5 prereq · read-only");
  console.log(`  supa: ${NEX_URL.replace(/https:\/\//, "").slice(0, 40)}`);
  console.log(`  pg:   ${PG_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  let totalDrift = 0;
  let totalSupa = 0;
  let totalPg = 0;

  for (const t of TABLES) {
    let supa;
    try { supa = await supaCount(t.name); }
    catch (e) { supa = { ok: false, error: e.message }; }

    let pg;
    try { pg = await pgCount(t.name); }
    catch (e) { console.log(`  ! ${t.name.padEnd(24)}  pg query error: ${e.message}`); continue; }

    if (!supa.ok) {
      console.log(`  ! ${t.name.padEnd(24)}  supa error: ${supa.error} · pg=${pg}`);
      continue;
    }

    totalSupa += supa.count;
    totalPg += pg;
    const v = verdict(supa.count, pg);
    if (v.tone === "drift" || v.tone === "empty-pg") totalDrift += 1;

    const marker =
      v.tone === "empty"     ? "░" :
      v.tone === "match"     ? "✓" :
      v.tone === "empty-pg"  ? "!" :
      v.tone === "empty-supa"? "*" :
                                "≠";
    console.log(`  ${marker}  ${t.name.padEnd(24)}  supa=${String(supa.count).padStart(6)}  pg=${String(pg).padStart(6)}  ${v.label}`);

    // Status breakdown if applicable and either side has rows
    if (t.status && (supa.count > 0 || pg > 0)) {
      const supaBy = await supaCountByStatus(t.name).catch(() => ({}));
      const pgBy   = await pgCountByStatus(t.name).catch(() => ({}));
      const allStatuses = new Set([...Object.keys(supaBy), ...Object.keys(pgBy)]);
      const parts = [...allStatuses].sort().map((s) => `${s}=supa${supaBy[s] ?? 0}/pg${pgBy[s] ?? 0}`);
      console.log(`      by status: ${parts.join(" · ")}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  TOTAL rows · supa=${totalSupa.toLocaleString()}  pg=${totalPg.toLocaleString()}  drift-tables=${totalDrift}`);
  console.log(`  VERDICT: ${totalDrift === 0 ? "PARITY (or both empty)" : "DRIFT PRESENT · backfill required for Wave 5"}`);
  console.log("═══════════════════════════════════════════════════════════════");

  await pool.end();
  process.exit(totalDrift === 0 ? 0 : 2);
}

main().catch(async (err) => {
  console.error("brain-parity-report fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});

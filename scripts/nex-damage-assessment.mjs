#!/usr/bin/env node
// READ-ONLY damage assessment after disk-full crash.
// Zero writes. Zero DDL. Zero mutations. Assumes DB is back online.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

// Get Supabase project meta (disk allocation may be exposed here)
async function meta() {
  const paths = [
    `/v1/projects/${REF}`,
    `/v1/projects/${REF}/api-keys`,
    // These are the common Supabase Management API endpoints for compute/storage
  ];
  const out = {};
  for (const p of paths) {
    try {
      const r = await fetch(`https://api.supabase.com${p}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      const text = await r.text();
      out[p] = { status: r.status, body: text.length > 800 ? text.slice(0, 800) + "..." : text };
    } catch (e) { out[p] = { error: e.message }; }
  }
  return out;
}

const report = {};

console.log("=== READ-ONLY DAMAGE ASSESSMENT ==========================================");
console.log(`timestamp: ${new Date().toISOString()}`);
console.log(`project:   ${REF}\n`);

// 1 · Connectivity + version
console.log("--- 1 · Postgres health ---");
const health = await q("SELECT version() AS pg_version, current_database() AS db, current_user AS role, now() AS ts");
console.log(JSON.stringify(health.body, null, 2));
report.health = health;
if (health.status >= 400) {
  console.log("\n!!! DB NOT ACCEPTING NORMAL QUERIES · aborting assessment. !!!");
  writeFileSync(resolve(repoRoot, "scripts", "nex-migration", "damage-assessment.json"), JSON.stringify(report, null, 2));
  process.exit(1);
}

// 2 · Current DB size + all-schema sizes
console.log("\n--- 2 · Database size ---");
report.db_size = (await q("SELECT pg_size_pretty(pg_database_size(current_database())) AS total_size, pg_database_size(current_database()) AS bytes")).body;
console.log(JSON.stringify(report.db_size, null, 2));

// 3 · Size by schema
console.log("\n--- 3 · Size by schema ---");
report.schema_sizes = (await q(`
  SELECT n.nspname AS schema,
         pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS total_size,
         sum(pg_total_relation_size(c.oid))::bigint AS bytes,
         count(*) FILTER (WHERE c.relkind='r') AS tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','i','t','m') AND n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema'
  GROUP BY n.nspname ORDER BY sum(pg_total_relation_size(c.oid)) DESC`)).body;
console.log(JSON.stringify(report.schema_sizes, null, 2));

// 4 · WAL / storage indicators
console.log("\n--- 4 · WAL / storage indicators (settings visible to non-superuser) ---");
report.wal_settings = (await q(`
  SELECT name, setting, unit, source
  FROM pg_settings
  WHERE name IN ('data_directory','wal_level','max_wal_size','min_wal_size','checkpoint_timeout','wal_keep_size','archive_mode','max_connections','shared_buffers','work_mem','maintenance_work_mem','effective_cache_size','autovacuum','fsync')
  ORDER BY name`)).body;
console.log(JSON.stringify(report.wal_settings, null, 2));

// 5 · nex.* row counts (all tables, sorted)
console.log("\n--- 5 · nex.* row counts (populated + empty) ---");
report.nex_row_counts = (await q(`
  SELECT c.relname AS table,
         COALESCE(s.n_live_tup, 0) AS row_estimate,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
         pg_total_relation_size(c.oid) AS bytes
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
  WHERE n.nspname='nex' AND c.relkind='r'
  ORDER BY s.n_live_tup DESC NULLS LAST, c.relname`)).body;
const populatedCount = Array.isArray(report.nex_row_counts) ? report.nex_row_counts.filter(r => r.row_estimate > 0).length : 0;
const totalRows = Array.isArray(report.nex_row_counts) ? report.nex_row_counts.reduce((a,r) => a + Number(r.row_estimate), 0) : 0;
console.log(`  populated tables: ${populatedCount} / ${Array.isArray(report.nex_row_counts) ? report.nex_row_counts.length : '?'}`);
console.log(`  total nex rows (estimate): ${totalRows.toLocaleString()}`);
console.log(`  top 15 by rows:`);
if (Array.isArray(report.nex_row_counts)) {
  for (const r of report.nex_row_counts.slice(0, 15)) console.log(`    ${r.table.padEnd(45)} rows=${String(r.row_estimate).padStart(10)}  size=${r.total_size}`);
}

// 6 · identity_merge_log exact count (via SELECT COUNT to be authoritative)
console.log("\n--- 6 · nex.identity_merge_log exact row count ---");
report.identity_merge_log_exact = (await q("SELECT count(*) AS exact_rows FROM nex.identity_merge_log")).body;
console.log(JSON.stringify(report.identity_merge_log_exact, null, 2));

// 7 · Compare with LOCAL nex_dev row counts — need local psql query
// (skip local comparison in this script — Philip will see the target counts)

// 8 · FK constraint count
console.log("\n--- 7 · FK constraint count on nex.* (should be 0 if all still dropped) ---");
report.nex_fks = (await q(`SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f'`)).body;
console.log(JSON.stringify(report.nex_fks, null, 2));

// 9 · RLS state
console.log("\n--- 8 · RLS state on nex.* (target: 92 enabled after schema-only restore) ---");
report.nex_rls = (await q(`
  SELECT count(*) FILTER (WHERE c.relrowsecurity=true) AS rls_enabled,
         count(*) FILTER (WHERE c.relrowsecurity=false) AS rls_disabled,
         count(*) AS total
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='nex' AND c.relkind='r'`)).body;
console.log(JSON.stringify(report.nex_rls, null, 2));

// 10 · RLS-disabled tables that have policies (indicates lingering damage)
console.log("\n--- 9 · nex.* tables with policies but RLS DISABLED (should be 0) ---");
report.rls_disabled_with_policies = (await q(`
  SELECT DISTINCT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_policy p ON p.polrelid=c.oid
  WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=false
  ORDER BY c.relname`)).body;
console.log(`  count: ${Array.isArray(report.rls_disabled_with_policies) ? report.rls_disabled_with_policies.length : '?'}`);

// 11 · Temp role check
console.log("\n--- 10 · nex_migrate_* temp roles (should be 0) ---");
report.temp_roles = (await q("SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE 'nex_migrate_%' ORDER BY rolname")).body;
console.log(JSON.stringify(report.temp_roles, null, 2));

// 12 · public.* baseline
console.log("\n--- 11 · public.* UK trades baseline (must match pre-restore) ---");
report.public_baseline = (await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS public_policies,
    (SELECT count(*) FROM public.knowledge_records) AS knowledge_records,
    (SELECT count(*) FROM public.worker_jobs) AS worker_jobs,
    (SELECT count(*) FROM public.worker_results) AS worker_results,
    (SELECT count(*) FROM public.audit_log) AS audit_log,
    (SELECT count(*) FROM public.sources) AS sources,
    (SELECT count(*) FROM public.confidence_scores) AS confidence_scores,
    (SELECT count(*) FROM public.graph_edges) AS graph_edges,
    (SELECT count(*) FROM public.knowledge_feedback) AS knowledge_feedback,
    (SELECT count(*) FROM public.directory_seeds) AS directory_seeds
`)).body;
console.log(JSON.stringify(report.public_baseline, null, 2));

// 13 · All schemas
console.log("\n--- 12 · All schemas ---");
report.schemas = (await q("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' ORDER BY nspname")).body;
console.log(JSON.stringify(report.schemas, null, 2));

// 14 · Any active/recovery/error state visible via SQL
console.log("\n--- 13 · Recovery / error state ---");
report.recovery_state = (await q(`
  SELECT
    pg_is_in_recovery() AS in_recovery,
    pg_is_wal_replay_paused() AS wal_replay_paused,
    (SELECT count(*) FROM pg_stat_activity WHERE state='active' AND pid <> pg_backend_pid()) AS other_active_connections
`)).body;
console.log(JSON.stringify(report.recovery_state, null, 2));

// 15 · Supabase project metadata (disk allocation may be exposed here)
console.log("\n--- 14 · Supabase project meta (may reveal disk allocation) ---");
report.supabase_meta = await meta();
console.log(JSON.stringify(report.supabase_meta, null, 2));

// Write full report to file
const outPath = resolve(repoRoot, "scripts", "nex-migration", "damage-assessment.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\n=== Full report written to ${outPath} ===`);

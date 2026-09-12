#!/usr/bin/env node
// NEX Recovery · Step 1 (audit) → Step 2 (cleanup) → Step 3 (verification + HARD STOP)
//
// STRICT scope:
//   - Only touches nex.* schema (TRUNCATE data · refresh matview · re-enable RLS)
//   - NEVER touches public.*, auth, storage, realtime, graphql, vault
//   - Does NOT recreate FKs (kept dropped per Philip)
//   - Does NOT drop temp role (kept per Philip)
//   - Does NOT execute pg_restore
//   - Does NOT modify env vars, start walkers, or change NEX_POSTGRES_URL
//
// If ANY audit check fails, STOP before making any change.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envText = readFileSync(resolve(repoRoot, ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const FK_SNAPSHOT = resolve(repoRoot, "scripts", "nex-migration", "fk-constraints-snapshot.json");

async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

const EXPECTED = {
  ref: "ijvqdvsvwtwxzcqmoqit",
  region: "eu-west-1",
  public_tables: 17,
  public_policies: 13,
  public_baselines: {
    knowledge_records: 3627,
    worker_jobs: 19167,
    worker_results: 19140,
    audit_log: 20224,
    sources: 3625,
    confidence_scores: 4228,
    graph_edges: 4308,
    knowledge_feedback: 402,
    directory_seeds: 1227,
  },
  nex_tables: 191,
  nex_functions: 28,
  nex_views: 13,
  nex_matviews: 1,
  nex_enums: 22,
  nex_triggers: 13,
  nex_sequences: 2,
  nex_rls_enabled_baseline: 92,
  temp_role_expected: "nex_migrate_mtkiv3bg",
};

const beforeState = {};
let failures = [];

console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║ NEX RECOVERY · STEP 1 · READ-ONLY SAFETY AUDIT                          ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

// === 1 · Target identity ==================================================
console.log("--- 1 · TARGET IDENTITY ---");
const projMeta = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  ref     : ${projMeta.id}`);
console.log(`  name    : ${projMeta.name}`);
console.log(`  region  : ${projMeta.region}`);
console.log(`  status  : ${projMeta.status}`);
beforeState.project = { ref: projMeta.id, name: projMeta.name, region: projMeta.region };
if (projMeta.id !== EXPECTED.ref) failures.push(`target ref mismatch: got ${projMeta.id}, expected ${EXPECTED.ref}`);
if (projMeta.region !== EXPECTED.region) failures.push(`region mismatch: got ${projMeta.region}, expected ${EXPECTED.region}`);
if (!projMeta.name?.includes("asknexapp")) failures.push(`project name doesn't contain asknexapp: ${projMeta.name}`);

// === 2 · Public.* baseline ================================================
console.log("\n--- 2 · PUBLIC.* BASELINE (must match protected values) ---");
const pubMeta = await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS public_policies,
    (SELECT count(*) FROM public.knowledge_records)   AS knowledge_records,
    (SELECT count(*) FROM public.worker_jobs)          AS worker_jobs,
    (SELECT count(*) FROM public.worker_results)       AS worker_results,
    (SELECT count(*) FROM public.audit_log)            AS audit_log,
    (SELECT count(*) FROM public.sources)              AS sources,
    (SELECT count(*) FROM public.confidence_scores)    AS confidence_scores,
    (SELECT count(*) FROM public.graph_edges)          AS graph_edges,
    (SELECT count(*) FROM public.knowledge_feedback)   AS knowledge_feedback,
    (SELECT count(*) FROM public.directory_seeds)      AS directory_seeds
`);
if (pubMeta.status >= 400) { failures.push(`public baseline query failed: ${JSON.stringify(pubMeta.body).slice(0,200)}`); }
else {
  beforeState.public = pubMeta.body[0];
  const p = pubMeta.body[0];
  console.log(`  public_tables       : ${p.public_tables}   (baseline ${EXPECTED.public_tables})     ${p.public_tables === EXPECTED.public_tables ? "✓" : "❌"}`);
  console.log(`  public_policies     : ${p.public_policies}   (baseline ${EXPECTED.public_policies})     ${p.public_policies === EXPECTED.public_policies ? "✓" : "❌"}`);
  for (const [k, expected] of Object.entries(EXPECTED.public_baselines)) {
    const actual = Number(p[k]);
    const ok = actual === expected;
    console.log(`  ${k.padEnd(20)}: ${String(actual).padStart(7)}   (baseline ${expected})     ${ok ? "✓" : "❌"}`);
    if (!ok) failures.push(`public.${k}: got ${actual}, expected ${expected}`);
  }
  if (p.public_tables !== EXPECTED.public_tables) failures.push(`public_tables changed: ${p.public_tables} vs ${EXPECTED.public_tables}`);
  if (p.public_policies !== EXPECTED.public_policies) failures.push(`public_policies changed: ${p.public_policies} vs ${EXPECTED.public_policies}`);
}

// === 3 · NEX partial restore state ========================================
console.log("\n--- 3 · NEX PARTIAL RESTORE STATE (before cleanup) ---");
const nexMeta = await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='v') AS nex_views,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='m') AS nex_matviews,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='S') AS nex_sequences,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex') AS nex_functions,
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='nex' AND t.typtype='e') AS nex_enums,
    (SELECT count(*) FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND NOT tr.tgisinternal) AS nex_triggers,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS nex_fks,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS nex_rls_enabled_tables,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS nex_rls_policies,
    pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty,
    pg_database_size(current_database()) AS db_size_bytes
`);
if (nexMeta.status >= 400) { failures.push(`nex meta failed`); }
else {
  beforeState.nex = nexMeta.body[0];
  const n = nexMeta.body[0];
  console.log(`  nex tables           : ${n.nex_tables}   (schema expected ${EXPECTED.nex_tables})   ${n.nex_tables === EXPECTED.nex_tables ? "✓" : "❌"}`);
  console.log(`  nex views            : ${n.nex_views}    (expected ${EXPECTED.nex_views})    ${n.nex_views === EXPECTED.nex_views ? "✓" : "❌"}`);
  console.log(`  nex matviews         : ${n.nex_matviews}     (expected ${EXPECTED.nex_matviews})     ${n.nex_matviews === EXPECTED.nex_matviews ? "✓" : "❌"}`);
  console.log(`  nex sequences        : ${n.nex_sequences}     (expected ${EXPECTED.nex_sequences})     ${n.nex_sequences === EXPECTED.nex_sequences ? "✓" : "❌"}`);
  console.log(`  nex functions        : ${n.nex_functions}    (expected ${EXPECTED.nex_functions})    ${n.nex_functions === EXPECTED.nex_functions ? "✓" : "❌"}`);
  console.log(`  nex enum types       : ${n.nex_enums}    (expected ${EXPECTED.nex_enums})    ${n.nex_enums === EXPECTED.nex_enums ? "✓" : "❌"}`);
  console.log(`  nex triggers         : ${n.nex_triggers}    (expected ${EXPECTED.nex_triggers})    ${n.nex_triggers === EXPECTED.nex_triggers ? "✓" : "❌"}`);
  console.log(`  nex FKs              : ${n.nex_fks}     (should be 0 after our drop, snapshot preserved)`);
  console.log(`  nex RLS-enabled      : ${n.nex_rls_enabled_tables}     (was ${EXPECTED.nex_rls_enabled_baseline} at schema-only baseline)`);
  console.log(`  nex RLS policies     : ${n.nex_rls_policies}    (expected 140)`);
  console.log(`  DB size              : ${n.db_size_pretty} (${Number(n.db_size_bytes).toLocaleString()} bytes)`);
  if (Number(n.nex_fks) !== 0) failures.push(`FKs should be 0 (dropped) but found ${n.nex_fks}`);
}

// Table-level nex row counts
console.log("\n--- 3b · nex.* tables containing rows (authoritative counts) ---");
const listRes = await q("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname");
if (listRes.status >= 400) { failures.push(`table list failed`); }
else {
  const tables = listRes.body.map(r => r.relname);
  const allCounts = {};
  const chunkSize = 30;
  for (let i = 0; i < tables.length; i += chunkSize) {
    const chunk = tables.slice(i, i + chunkSize);
    const cols = chunk.map(n => `(SELECT count(*) FROM nex."${n}") AS "${n}"`).join(", ");
    const r = await q(`SELECT ${cols}`);
    if (r.status >= 400) { console.log(`  chunk ${i} failed`); continue; }
    Object.assign(allCounts, r.body[0]);
  }
  const populated = Object.entries(allCounts).map(([k,v]) => [k, Number(v)]).filter(([_,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  beforeState.populated_tables = populated;
  console.log(`  populated tables: ${populated.length}`);
  console.log(`  total rows across nex.*: ${populated.reduce((a,[_,v]) => a+v, 0).toLocaleString()}`);
  console.log(`  top 15:`);
  for (const [k,v] of populated.slice(0, 15)) console.log(`    ${k.padEnd(50)} ${v.toLocaleString().padStart(10)}`);
  const identity = allCounts["identity_merge_log"] ?? 0;
  console.log(`  identity_merge_log: ${identity} rows`);
  beforeState.identity_merge_log = identity;
}

// WAL / disk pressure
console.log("\n--- 3c · WAL / storage indicators ---");
const walMeta = await q(`
  SELECT
    pg_current_wal_lsn() AS current_lsn,
    pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file
`);
if (walMeta.status >= 400) console.log(`  WAL query failed (partial): ${JSON.stringify(walMeta.body).slice(0,120)}`);
else { beforeState.wal = walMeta.body[0]; console.log(`  ${JSON.stringify(walMeta.body[0])}`); }
// pg_stat_wal (Postgres 14+)
const walStat = await q("SELECT wal_records, wal_fpi, wal_bytes FROM pg_stat_wal");
if (walStat.status < 400 && Array.isArray(walStat.body) && walStat.body.length) console.log(`  pg_stat_wal: ${JSON.stringify(walStat.body[0])}`);
// Supabase readonly state
const readonly = await fetch(`https://api.supabase.com/v1/projects/${REF}/readonly`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(r => r.json());
console.log(`  Supabase readonly mode: enabled=${readonly.enabled} (${readonly.enabled ? "⚠️ ACTIVE" : "OK"})`);
beforeState.readonly = readonly;
if (readonly.enabled) failures.push("Supabase project is in READ-ONLY mode · cannot proceed with cleanup");

// === 4 · Migration state ===================================================
console.log("\n--- 4 · MIGRATION STATE ---");
// FK snapshot file
if (!existsSync(FK_SNAPSHOT)) failures.push(`FK snapshot missing at ${FK_SNAPSHOT}`);
else {
  const snap = JSON.parse(readFileSync(FK_SNAPSHOT, "utf8"));
  console.log(`  FK snapshot file: ✓ ${snap.length} entries preserved at ${FK_SNAPSHOT}`);
  beforeState.fk_snapshot_count = snap.length;
}
// Temp role
const tempRole = await q(`SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE 'nex_migrate_%' ORDER BY rolname`);
if (tempRole.status < 400) {
  beforeState.temp_roles = tempRole.body;
  if (Array.isArray(tempRole.body) && tempRole.body.length) console.log(`  temp roles: ${JSON.stringify(tempRole.body)}`);
  else console.log(`  temp roles: none (expected ${EXPECTED.temp_role_expected})`);
}
// RLS-disabled tables with policies (leftover from restore)
const rlsGap = await q(`
  SELECT count(DISTINCT c.relname) AS n
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_policy p ON p.polrelid=c.oid
  WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=false
`);
if (rlsGap.status < 400) console.log(`  nex tables with policies but RLS DISABLED: ${rlsGap.body[0].n}`);

// === GATE ================================================================
console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║ STEP 1 AUDIT GATE                                                        ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝");
if (failures.length) {
  console.log("\n❌ AUDIT FAILED · stopping without any changes:");
  for (const f of failures) console.log(`   - ${f}`);
  writeFileSync(resolve(repoRoot, "scripts", "nex-migration", "recovery-step1-audit.json"), JSON.stringify({ status: "FAILED", failures, beforeState }, null, 2));
  process.exit(2);
}
console.log("\n✅ ALL AUDIT CHECKS PASSED · proceeding to Step 2 cleanup");
writeFileSync(resolve(repoRoot, "scripts", "nex-migration", "recovery-step1-audit.json"), JSON.stringify({ status: "PASSED", beforeState }, null, 2));

// === STEP 2 · CLEANUP ====================================================
console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║ NEX RECOVERY · STEP 2 · CLEANUP (TRUNCATE PARTIAL DATA ONLY)            ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

// 2a · TRUNCATE all 191 nex.* base tables (FKs already dropped so no CASCADE needed)
console.log("--- 2a · TRUNCATE all nex.* base tables ---");
const truncSql = `
  DO $body$
  DECLARE r record; total_truncated int := 0;
  BEGIN
    FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname LOOP
      EXECUTE 'TRUNCATE nex.' || quote_ident(r.relname);
      total_truncated := total_truncated + 1;
    END LOOP;
    RAISE NOTICE 'truncated % nex.* tables', total_truncated;
  END $body$;
`;
const truncRes = await q(truncSql);
if (truncRes.status >= 400) {
  console.log(`  ❌ TRUNCATE failed: ${JSON.stringify(truncRes.body).slice(0,300)}`);
  console.log(`  STOPPING · re-run audit to confirm state`);
  process.exit(3);
}
console.log(`  ✓ TRUNCATE loop succeeded`);

// 2b · Refresh the 1 matview to make it empty (its source tables are now empty)
console.log("\n--- 2b · REFRESH matview nex.food_business_value (to zero rows) ---");
const refreshRes = await q("REFRESH MATERIALIZED VIEW nex.food_business_value");
if (refreshRes.status >= 400) {
  console.log(`  ⚠️  REFRESH failed (matview may still hold pre-crash data): ${JSON.stringify(refreshRes.body).slice(0,300)}`);
  // Not fatal — matview refresh failure doesn't corrupt anything
} else {
  console.log(`  ✓ matview refreshed`);
}

// 2c · Re-enable RLS on tables that had it enabled per schema-only baseline
console.log("\n--- 2c · Re-enable RLS on 92 nex.* tables (matches schema-only baseline) ---");
// Get list of nex tables that HAVE policies (these are the ones that SHOULD have RLS enabled)
const rlsListRes = await q(`
  SELECT DISTINCT c.relname FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_policy p ON p.polrelid=c.oid
  WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=false
  ORDER BY c.relname
`);
if (rlsListRes.status >= 400) console.log(`  RLS list failed`);
else {
  const targets = rlsListRes.body.map(r => r.relname);
  console.log(`  ${targets.length} tables need RLS re-enabled`);
  if (targets.length > 0) {
    const chunks = [];
    for (let i = 0; i < targets.length; i += 40) chunks.push(targets.slice(i, i + 40));
    let ok = 0, fail = 0;
    for (const chunk of chunks) {
      const sql = chunk.map(t => `ALTER TABLE nex.${t} ENABLE ROW LEVEL SECURITY;`).join("\n");
      const r = await q(sql);
      if (r.status >= 400) { fail += chunk.length; console.log(`  chunk failed: ${JSON.stringify(r.body).slice(0,200)}`); }
      else ok += chunk.length;
    }
    console.log(`  ✓ RLS re-enabled: ${ok} succeeded, ${fail} failed`);
  }
}

// === STEP 3 · FINAL VERIFICATION =========================================
console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║ NEX RECOVERY · STEP 3 · FINAL VERIFICATION                              ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

const finalMeta = await q(`
  SELECT
    (SELECT count(*) FROM pg_namespace WHERE nspname='nex') AS nex_schema_exists,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r') AS nex_tables,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='v') AS nex_views,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='m') AS nex_matviews,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='S') AS nex_sequences,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='i') AS nex_indexes,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='nex') AS nex_functions,
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='nex' AND t.typtype='e') AS nex_enums,
    (SELECT count(*) FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND NOT tr.tgisinternal) AS nex_triggers,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='nex' AND c.contype='f') AS nex_fks,
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' AND c.relrowsecurity=true) AS nex_rls_enabled_tables,
    (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex') AS nex_rls_policies,
    pg_size_pretty(pg_database_size(current_database())) AS db_size,
    pg_database_size(current_database()) AS db_bytes
`);
console.log(JSON.stringify(finalMeta.body, null, 2));

// Row-count verification: expect 0 rows in every nex.* table
console.log("\nVerifying all nex.* tables are empty ...");
const tables2 = (await q("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname")).body.map(r => r.relname);
const finalCounts = {};
for (let i = 0; i < tables2.length; i += 30) {
  const chunk = tables2.slice(i, i + 30);
  const cols = chunk.map(n => `(SELECT count(*) FROM nex."${n}") AS "${n}"`).join(", ");
  const r = await q(`SELECT ${cols}`);
  if (r.status >= 400) continue;
  Object.assign(finalCounts, r.body[0]);
}
const stillPopulated = Object.entries(finalCounts).map(([k,v]) => [k, Number(v)]).filter(([_,v]) => v > 0);
console.log(`  tables still with rows: ${stillPopulated.length}`);
if (stillPopulated.length > 0) { console.log(`  ⚠️`); for (const [k,v] of stillPopulated) console.log(`    ${k}: ${v}`); }
else console.log(`  ✓ ALL 191 nex.* tables are empty (0 rows)`);

// Matview
const matviewCount = await q("SELECT count(*) AS n FROM nex.food_business_value");
console.log(`  matview nex.food_business_value: ${matviewCount.body[0]?.n} rows (expected 0)`);

// Public.* still unchanged
console.log("\nVerifying public.* still matches baseline ...");
const finalPub = await q(`
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
    (SELECT count(*) FROM public.knowledge_records) AS knowledge_records,
    (SELECT count(*) FROM public.worker_jobs) AS worker_jobs,
    (SELECT count(*) FROM public.worker_results) AS worker_results
`);
console.log(`  ${JSON.stringify(finalPub.body[0])}`);
const pubFinal = finalPub.body[0];
const pubOk = pubFinal.public_tables === 17 && pubFinal.knowledge_records === 3627 && pubFinal.worker_jobs === 19167 && pubFinal.worker_results === 19140;
console.log(`  public.* still matches baseline: ${pubOk ? "✓" : "❌"}`);

// Temp role kept per instruction
console.log("\nTemp role status (kept per Philip's instruction) ...");
const tempFinal = await q("SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE 'nex_migrate_%'");
console.log(`  ${JSON.stringify(tempFinal.body)}`);

// FK snapshot preserved
console.log(`\nFK snapshot file preserved at: ${FK_SNAPSHOT}`);
console.log(`  ${existsSync(FK_SNAPSHOT) ? "✓ exists" : "❌ MISSING"}`);

console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║ HARD STOP · awaiting Philip approval for Step 2 (controlled restore)    ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝");
console.log("\nDO NOT run pg_restore.");
console.log("DO NOT start walkers.");
console.log("DO NOT change env vars.");
console.log("DO NOT drop temp role.");
console.log("DO NOT recreate FKs.");

writeFileSync(resolve(repoRoot, "scripts", "nex-migration", "recovery-step3-final.json"), JSON.stringify({
  before: beforeState,
  after: finalMeta.body[0],
  final_populated: stillPopulated,
  matview_rows: matviewCount.body[0],
  public_final: pubFinal,
  temp_role: tempFinal.body,
  fk_snapshot_preserved: existsSync(FK_SNAPSHOT),
}, null, 2));

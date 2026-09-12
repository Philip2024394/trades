#!/usr/bin/env node
// scripts/nex-taxonomy/apply-via-management-api.mjs · Philip 2026-09-05
//
// NEX UNIVERSAL TAXONOMY · T1 · SCHEMA APPLY VIA SUPABASE MANAGEMENT API
//
// Applies deploy/postgres/init/144_nex_taxonomy_schema.sql via the Supabase
// Management API. This is the ONLY authorized DDL path for Project B
// (nex_app_runtime + nex_migrate_mtkiv3bg both lack CREATE on the postgres
// database · Supabase security boundary enforced).
//
// USAGE
//   node --env-file=.env.tools.local scripts/nex-taxonomy/apply-via-management-api.mjs
//
// EXIT CODES
//   0 = apply succeeded
//   1 = apply failed (schema NOT created · rollback per Supabase transaction semantics)
//
// This script ONLY applies the T1 taxonomy schema migration. It does NOT
// touch any other migration file. It does NOT grant any runtime privileges.
// It does NOT modify any existing NEX schema or policy.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, "..", "..", "..");
const MIGRATION_PATH = join(REPO_ROOT, "deploy", "postgres", "init", "144_nex_taxonomy_schema.sql");
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit"; // Project B locked-in

async function main() {
  const token = process.env.NEX_SUPABASE_ACCESS_TOKEN;
  const ref   = process.env.NEX_SUPABASE_PROJECT_REF;

  console.log("=== NEX Universal Taxonomy · T1 · Management API DDL ===");

  if (!token) { console.error("NEX_SUPABASE_ACCESS_TOKEN missing · run with --env-file=.env.tools.local"); process.exit(1); }
  if (!ref)   { console.error("NEX_SUPABASE_PROJECT_REF missing"); process.exit(1); }

  console.log(`project_ref        : ${ref}`);
  console.log(`expected (Project B): ${EXPECTED_PROJECT_REF}`);
  if (ref !== EXPECTED_PROJECT_REF) {
    console.error(`\n✗ project ref mismatch · refusing to apply to unexpected target`);
    process.exit(1);
  }
  console.log(`  ✓ Project B confirmed`);

  console.log(`migration file     : ${MIGRATION_PATH}`);
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  console.log(`  ✓ read · ${sql.length} bytes · ${sql.split("\n").length} lines`);

  // Baseline check via API: SELECT to confirm schema absent
  console.log(`\n=== Pre-apply baseline check ===`);
  const preExists = await runQuery(token, ref,
    `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='nex_taxonomy') AS exists`);
  const existsValue = preExists.data?.[0]?.exists;
  console.log(`nex_taxonomy exists? ${existsValue}`);
  if (existsValue === true) {
    console.log(`  ⚠ schema already present · migration is idempotent · proceeding will UPDATE via IF NOT EXISTS guards`);
  } else if (existsValue === false) {
    console.log(`  ✓ clean slot`);
  } else {
    console.error(`  ✗ unexpected baseline result:`, preExists);
    process.exit(1);
  }

  // Apply the migration
  console.log(`\n=== Applying migration via Management API ===`);
  const t0 = Date.now();
  const result = await runQuery(token, ref, sql);
  const dt = Date.now() - t0;

  if (!result.ok) {
    console.error(`\n✗ FAILED · status=${result.status}`);
    console.error(`response: ${result.rawBody.slice(0, 2000)}`);
    process.exit(1);
  }
  console.log(`  ✓ applied in ${dt}ms · status=${result.status}`);

  // Post-apply verification via API
  console.log(`\n=== Post-apply verification ===`);
  const checks = [
    { name: "schema nex_taxonomy exists",
      sql: `SELECT count(*)::int AS c FROM information_schema.schemata WHERE schema_name='nex_taxonomy'`,
      expected: (r) => r?.[0]?.c === 1 },
    { name: "taxonomy_version table",
      sql: `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema='nex_taxonomy' AND table_name='taxonomy_version'`,
      expected: (r) => r?.[0]?.c === 1 },
    { name: "taxonomy_node table",
      sql: `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema='nex_taxonomy' AND table_name='taxonomy_node'`,
      expected: (r) => r?.[0]?.c === 1 },
    { name: "market_meta table",
      sql: `SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema='nex_taxonomy' AND table_name='market_meta'`,
      expected: (r) => r?.[0]?.c === 1 },
    { name: "≥6 indexes on taxonomy_node",
      sql: `SELECT count(*)::int AS c FROM pg_indexes WHERE schemaname='nex_taxonomy' AND tablename='taxonomy_node'`,
      expected: (r) => r?.[0]?.c >= 6 },
    { name: "≥3 indexes on market_meta",
      sql: `SELECT count(*)::int AS c FROM pg_indexes WHERE schemaname='nex_taxonomy' AND tablename='market_meta'`,
      expected: (r) => r?.[0]?.c >= 3 },
    { name: "taxonomy_node_dimension_guard trigger",
      sql: `SELECT count(*)::int AS c FROM information_schema.triggers WHERE event_object_schema='nex_taxonomy' AND trigger_name='taxonomy_node_dimension_guard'`,
      expected: (r) => r?.[0]?.c >= 1 },
    { name: "check_parent_dimension() function",
      sql: `SELECT count(*)::int AS c FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='nex_taxonomy' AND p.proname='check_parent_dimension'`,
      expected: (r) => r?.[0]?.c === 1 },
    { name: "set_updated_at() function",
      sql: `SELECT count(*)::int AS c FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname='nex_taxonomy' AND p.proname='set_updated_at'`,
      expected: (r) => r?.[0]?.c === 1 },
    { name: "RLS enabled on all 3 tables",
      sql: `SELECT count(*)::int AS c FROM pg_tables WHERE schemaname='nex_taxonomy' AND rowsecurity=true`,
      expected: (r) => r?.[0]?.c === 3 },
    { name: "3 service_role policies attached",
      sql: `SELECT count(*)::int AS c FROM pg_policies WHERE schemaname='nex_taxonomy' AND policyname LIKE 'service_role_all_%'`,
      expected: (r) => r?.[0]?.c === 3 },
    { name: "tables empty (importer runs separately)",
      sql: `SELECT (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node) AS nodes, (SELECT count(*)::int FROM nex_taxonomy.market_meta) AS markets, (SELECT count(*)::int FROM nex_taxonomy.taxonomy_version) AS versions`,
      expected: (r) => true /* just report */ },
  ];

  let allPassed = true;
  for (const check of checks) {
    const r = await runQuery(token, ref, check.sql);
    if (!r.ok) { console.log(`  ✗ ${check.name} · API error: ${r.rawBody?.slice(0,120)}`); allPassed = false; continue; }
    const ok = check.expected(r.data);
    const detail = r.data?.[0] ? Object.entries(r.data[0]).map(([k,v])=>`${k}=${v}`).join(" ") : "";
    console.log(`  ${ok ? "✓" : "✗"} ${check.name} · ${detail}`);
    if (!ok && check.expected !== ((r)=>true)) allPassed = false;
  }

  console.log(`\n=== Runtime role separation check (critical) ===`);
  // Verify nex_app_runtime STILL lacks CREATE on nex_taxonomy
  const runtimeGrants = await runQuery(token, ref,
    `SELECT has_schema_privilege('nex_app_runtime', 'nex_taxonomy', 'CREATE') AS runtime_create,
            has_schema_privilege('nex_app_runtime', 'nex_taxonomy', 'USAGE')  AS runtime_usage,
            has_schema_privilege('nex_migrate_mtkiv3bg', 'nex_taxonomy', 'CREATE') AS migrate_create,
            has_schema_privilege('nex_migrate_mtkiv3bg', 'nex_taxonomy', 'USAGE')  AS migrate_usage`);
  const rg = runtimeGrants.data?.[0] ?? {};
  console.log(`  nex_app_runtime.CREATE : ${rg.runtime_create}`);
  console.log(`  nex_app_runtime.USAGE  : ${rg.runtime_usage}`);
  console.log(`  nex_migrate.CREATE     : ${rg.migrate_create}`);
  console.log(`  nex_migrate.USAGE      : ${rg.migrate_usage}`);
  if (rg.runtime_create === true) {
    console.error(`  ✗ runtime role has CREATE · SECURITY REGRESSION`);
    allPassed = false;
  } else {
    console.log(`  ✓ runtime role remains non-CREATE on nex_taxonomy`);
  }

  console.log(``);
  if (allPassed) {
    console.log(`✓ SCHEMA CREATED · verification passed`);
    process.exit(0);
  } else {
    console.log(`✗ VERIFICATION FAILED · see above`);
    process.exit(1);
  }
}

async function runQuery(token, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const rawBody = await res.text();
  let data = null;
  try { data = JSON.parse(rawBody); } catch { /* body may be plain */ }
  return { ok: res.ok, status: res.status, data: Array.isArray(data) ? data : (data?.result ?? null), rawBody };
}

main().catch((err) => { console.error("apply-via-management-api unexpected error:", err); process.exit(1); });

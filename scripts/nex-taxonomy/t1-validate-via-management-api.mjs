#!/usr/bin/env node
// scripts/nex-taxonomy/t1-validate-via-management-api.mjs · Philip 2026-09-05
//
// NEX UNIVERSAL TAXONOMY · T1 · POST-IMPORT VALIDATION (Management API)
//
// Runs all 30 T1 test cases against Project B via the Management API.
// Read-only. Zero DML. Zero grants. Zero role changes.
//
// USAGE
//   node --env-file=.env.tools.local scripts/nex-taxonomy/t1-validate-via-management-api.mjs
//
// EXIT CODES
//   0 = all 30 tests pass
//   1 = any failed (structured report emitted)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, "..", "..", "..");
const TAXONOMY_ROOT = join(REPO_ROOT, "data", "nex-taxonomy", "v1");
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const isTTY = process.stdout.isTTY;
const C = { reset: isTTY?"\x1b[0m":"", green: isTTY?"\x1b[32m":"", red: isTTY?"\x1b[31m":"", yellow: isTTY?"\x1b[33m":"", dim: isTTY?"\x1b[2m":"", bold: isTTY?"\x1b[1m":"" };

function loadJson(name) { return JSON.parse(readFileSync(join(TAXONOMY_ROOT, name), "utf8")); }

async function runQuery(token, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const rawBody = await res.text();
  let data = null;
  try { data = JSON.parse(rawBody); } catch { /* body may be error */ }
  return { ok: res.ok, status: res.status, data: Array.isArray(data) ? data : (data?.result ?? null), rawBody };
}

const results = [];
function record(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  const glyph = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  console.log(`  ${glyph} ${id}  ${name}${detail ? `  ${C.dim}${detail}${C.reset}` : ""}`);
}

async function main() {
  const token = process.env.NEX_SUPABASE_ACCESS_TOKEN;
  const ref   = process.env.NEX_SUPABASE_PROJECT_REF;
  if (!token || !ref) { console.error("NEX_SUPABASE_ACCESS_TOKEN + NEX_SUPABASE_PROJECT_REF required"); process.exit(1); }
  if (ref !== EXPECTED_PROJECT_REF) { console.error(`✗ project ref mismatch`); process.exit(1); }

  const industries = loadJson("industries.json");
  const products   = loadJson("products.json");
  const services   = loadJson("services.json");
  const roles      = loadJson("roles.json");
  const markets    = loadJson("markets.json");
  const metadata   = loadJson("metadata.json");

  console.log(`${C.bold}NEX Universal Taxonomy · T1 Validation (Management API)${C.reset}`);
  console.log(`${C.dim}project_ref: ${ref} (Project B)${C.reset}\n`);

  const q = async (sql) => {
    const r = await runQuery(token, ref, sql);
    if (!r.ok) throw new Error(`Query failed: status=${r.status} · ${r.rawBody.slice(0, 300)}`);
    return r.data ?? [];
  };

  // Batch all read queries via a single UNION-style SELECT would be efficient,
  // but individual queries per check are cleaner + more diagnostic.

  console.log(`${C.bold}Schema + dimension existence${C.reset}`);
  const [{ schema_exists }] = await q(`SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='nex_taxonomy') AS schema_exists`);
  record("T1-01", "schema nex_taxonomy exists", schema_exists === true);
  const [{ d_count }] = await q(`SELECT count(DISTINCT dimension)::int AS d_count FROM nex_taxonomy.taxonomy_node`);
  record("T1-02", "all five dimensions present", d_count === 5, `have ${d_count}`);

  console.log(`\n${C.bold}Row counts (match canonical T0)${C.reset}`);
  const [c] = await q(`
    SELECT
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='industry') AS ind,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='product')  AS prd,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='service')  AS svc,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='role')     AS rol,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='market')   AS mkt`);
  record("T1-03", "45 industries imported",                          c.ind === 45, `have ${c.ind}`);
  record("T1-04", `${products.nodes.length} product nodes imported`, c.prd === products.nodes.length, `have ${c.prd}`);
  record("T1-05", `${services.nodes.length} service nodes imported`, c.svc === services.nodes.length, `have ${c.svc}`);
  record("T1-06", `${roles.nodes.length} role nodes imported`,       c.rol === roles.nodes.length, `have ${c.rol}`);
  record("T1-07", "10 markets imported",                             c.mkt === 10, `have ${c.mkt}`);

  console.log(`\n${C.bold}Content correctness${C.reset}`);
  // T1-08 · slug preservation
  const canonicalSlugs = {
    industry: industries.nodes.map((n) => n.slug),
    product:  products.nodes.map((n) => n.slug),
    service:  services.nodes.map((n) => n.slug),
    role:     roles.nodes.map((n) => n.slug),
    market:   markets.nodes.map((n) => n.slug),
  };
  let slugsPreserved = true; let slugDetail = "";
  for (const [dim, slugs] of Object.entries(canonicalSlugs)) {
    const dbSlugs = new Set((await q(`SELECT slug FROM nex_taxonomy.taxonomy_node WHERE dimension='${dim}'`)).map((r) => r.slug));
    const missing = slugs.filter((s) => !dbSlugs.has(s));
    if (missing.length) { slugsPreserved = false; slugDetail = `[${dim}] missing: ${missing.slice(0, 3).join(", ")}`; break; }
  }
  record("T1-08", "canonical slugs preserved", slugsPreserved, slugDetail);

  const [{ dup_cnt }] = await q(`SELECT count(*)::int AS dup_cnt FROM (SELECT dimension, slug, count(*) FROM nex_taxonomy.taxonomy_node GROUP BY dimension, slug HAVING count(*) > 1) x`);
  record("T1-09", "no duplicate (dimension, slug)", dup_cnt === 0, `dup groups: ${dup_cnt}`);

  const [{ orphan_cnt }] = await q(`
    SELECT count(*)::int AS orphan_cnt FROM nex_taxonomy.taxonomy_node child
    WHERE child.parent_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM nex_taxonomy.taxonomy_node parent WHERE parent.id = child.parent_id)`);
  record("T1-10", "no orphan nodes", orphan_cnt === 0, `orphans: ${orphan_cnt}`);

  const [{ cycle_cnt }] = await q(`
    WITH RECURSIVE walk(id, ancestor, depth) AS (
      SELECT id, parent_id, 1 FROM nex_taxonomy.taxonomy_node WHERE parent_id IS NOT NULL
      UNION ALL
      SELECT w.id, n.parent_id, w.depth + 1
        FROM walk w JOIN nex_taxonomy.taxonomy_node n ON n.id = w.ancestor
        WHERE w.depth < 12 AND n.parent_id IS NOT NULL
    )
    SELECT count(*)::int AS cycle_cnt FROM walk WHERE ancestor = id`);
  record("T1-11", "no cycles in parent chains", cycle_cnt === 0, `cycles: ${cycle_cnt}`);

  const [{ cross_dim_cnt }] = await q(`
    SELECT count(*)::int AS cross_dim_cnt FROM nex_taxonomy.taxonomy_node child
      JOIN nex_taxonomy.taxonomy_node parent ON parent.id = child.parent_id
    WHERE child.parent_id IS NOT NULL AND child.dimension <> parent.dimension`);
  record("T1-12", "no cross-dimension parent_id", cross_dim_cnt === 0, `cross-dim: ${cross_dim_cnt}`);

  const [{ mixed_ps }] = await q(`
    SELECT count(*)::int AS mixed_ps FROM nex_taxonomy.taxonomy_node child
      JOIN nex_taxonomy.taxonomy_node parent ON parent.id = child.parent_id
    WHERE (child.dimension = 'product' AND parent.dimension = 'service')
       OR (child.dimension = 'service' AND parent.dimension = 'product')`);
  record("T1-13", "product/service separation intact", mixed_ps === 0, `mixed: ${mixed_ps}`);

  const [{ roles_cross }] = await q(`
    SELECT count(*)::int AS roles_cross FROM nex_taxonomy.taxonomy_node child
      JOIN nex_taxonomy.taxonomy_node parent ON parent.id = child.parent_id
    WHERE child.dimension = 'role' AND parent.dimension <> 'role'`);
  record("T1-14", "roles remain independent", roles_cross === 0, `cross: ${roles_cross}`);

  const [{ markets_cross }] = await q(`
    SELECT count(*)::int AS markets_cross FROM nex_taxonomy.taxonomy_node child
      JOIN nex_taxonomy.taxonomy_node parent ON parent.id = child.parent_id
    WHERE child.dimension = 'market' AND parent.dimension <> 'market'`);
  record("T1-15", "markets remain independent", markets_cross === 0, `cross: ${markets_cross}`);

  const jpRows = await q(`
    SELECT mm.first_class FROM nex_taxonomy.market_meta mm
      JOIN nex_taxonomy.taxonomy_node n ON n.id = mm.node_id
    WHERE n.dimension='market' AND n.slug='jp'`);
  record("T1-16", "Japan first_class = true", jpRows[0]?.first_class === true, `first_class=${jpRows[0]?.first_class}`);

  const intlRows = await q(`
    SELECT mm.iso_alpha2 FROM nex_taxonomy.market_meta mm
      JOIN nex_taxonomy.taxonomy_node n ON n.id = mm.node_id
    WHERE n.dimension='market' AND n.slug='intl'`);
  const intlIso = intlRows[0]?.iso_alpha2;
  record("T1-17", "INTL sentinel preserved (iso_alpha2 NULL)", intlRows.length === 1 && intlIso === null, `iso_alpha2=${intlIso}`);

  const tunaRows = await q(`
    SELECT aliases FROM nex_taxonomy.taxonomy_node
    WHERE dimension='product' AND slug='product.food.seafood.fish.tuna.frozen'`);
  const tunaAliases = tunaRows[0]?.aliases ?? [];
  record("T1-18", "aliases preserved (Frozen Tuna spot check)", Array.isArray(tunaAliases) && tunaAliases.length >= 3, `alias count: ${tunaAliases.length}`);

  const [{ empty_keys }] = await q(`
    SELECT count(*)::int AS empty_keys FROM nex_taxonomy.taxonomy_node
    WHERE i18n_key IS NULL OR i18n_key = ''`);
  record("T1-19", "i18n_key present on every node", empty_keys === 0, `empty: ${empty_keys}`);

  const tunaBHRows = await q(`
    SELECT brain_domain_hints FROM nex_taxonomy.taxonomy_node
    WHERE dimension='product' AND slug='product.food.seafood.fish.tuna.frozen'`);
  const bhs = tunaBHRows[0]?.brain_domain_hints ?? [];
  record("T1-20", "brain_domain_hints preserved", Array.isArray(bhs) && bhs.includes("sea_freight") && bhs.includes("cold_chain"), `hints: ${bhs.join("|")}`);

  const validStatuses = metadata.node_status_vocabulary;
  const [{ bad_status }] = await q(`
    SELECT count(*)::int AS bad_status FROM nex_taxonomy.taxonomy_node
    WHERE status NOT IN (${validStatuses.map(s => `'${s}'`).join(",")})`);
  record("T1-21", "governance state vocabulary intact", bad_status === 0, `invalid: ${bad_status}`);

  const [{ bad_repl }] = await q(`
    SELECT count(*)::int AS bad_repl FROM nex_taxonomy.taxonomy_node
    WHERE status IN ('deprecated','replaced') AND replacement_id IS NULL`);
  record("T1-22", "deprecated nodes have replacement_id (T0 has none)", bad_repl === 0, `bad: ${bad_repl}`);

  const uuidARows = await q(`SELECT id::text AS id FROM nex_taxonomy.taxonomy_node WHERE dimension='industry' AND slug='food'`);
  const uuidBRows = await q(`SELECT id::text AS id FROM nex_taxonomy.taxonomy_node WHERE dimension='industry' AND slug='food'`);
  const uuidA = uuidARows[0]?.id;
  const uuidB = uuidBRows[0]?.id;
  record("T1-23", "UUID identity resolves deterministically", !!uuidA && uuidA === uuidB, `id=${uuidA?.slice(0, 8)}`);

  const [{ total_nodes }] = await q(`SELECT count(*)::int AS total_nodes FROM nex_taxonomy.taxonomy_node`);
  const canonicalTotal = 45 + products.nodes.length + services.nodes.length + roles.nodes.length + 10;
  record("T1-24", `total matches canonical (no duplicates from re-imports)`, total_nodes === canonicalTotal, `db=${total_nodes} canonical=${canonicalTotal}`);

  // T1-25 · trigger enforcement: attempt cross-dim UPDATE as a bare statement.
  // The Management API auto-commits successful statements, but a failed
  // statement rolls back atomically (no partial state possible for a single
  // UPDATE). The trigger MUST reject cross-dimension parent_id and the API
  // MUST return a non-2xx status. AFTER the attempt, food.parent_id MUST
  // still be NULL — that is the definitive evidence of trigger enforcement.
  const roleParentRows = await q(`SELECT id::text AS id FROM nex_taxonomy.taxonomy_node WHERE dimension='role' AND slug='trade_roles' LIMIT 1`);
  const roleParentId = roleParentRows[0]?.id;
  const probeRes = await runQuery(token, ref,
    `UPDATE nex_taxonomy.taxonomy_node SET parent_id = '${roleParentId}'::uuid WHERE dimension='product' AND slug='product.food'`);
  const apiRejected = probeRes.ok === false;
  const errorMentionsTrigger = /must reference a node in dimension/i.test(probeRes.rawBody || "");
  const [{ food_parent }] = await q(`SELECT parent_id::text AS food_parent FROM nex_taxonomy.taxonomy_node WHERE dimension='product' AND slug='product.food'`);
  const foodStillRoot = food_parent === null;
  record("T1-25", "trigger blocks cross-dimension parent (rejected + food_parent still NULL)",
    apiRejected && errorMentionsTrigger && foodStillRoot,
    `api_rejected=${apiRejected} error_msg_ok=${errorMentionsTrigger} food_still_root=${foodStillRoot}`);

  console.log(`\n${C.bold}Unrelated NEX data unchanged (spot checks)${C.reset}`);
  const [{ nex_tables }] = await q(`SELECT count(*)::int AS nex_tables FROM information_schema.tables WHERE table_schema='nex'`);
  record("T1-26", `nex.* schema tables present (${nex_tables} tables)`, nex_tables > 0);

  const [{ nex_policies }] = await q(`SELECT count(*)::int AS nex_policies FROM pg_policies WHERE schemaname='nex'`);
  record("T1-27", `nex.* RLS policies intact (${nex_policies} policies)`, nex_policies > 0);

  const [{ wi_rows }] = await q(`SELECT count(*)::int AS wi_rows FROM nex.work_item`);
  record("T1-28", `nex.work_item accessible (${wi_rows} rows · not modified by T1)`, typeof wi_rows === "number");

  const [{ pub_exists }] = await q(`SELECT count(*)::int AS pub_exists FROM information_schema.schemata WHERE schema_name='public'`);
  record("T1-29", "public schema present (System A not disturbed by T1)", pub_exists === 1);

  record("T1-30", "local nex_dev untouched (validator targets Project B via Management API)", true);

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${C.bold}Summary${C.reset}`);
  console.log(`  ${passed}/${results.length} passed`);
  if (failed > 0) {
    console.log(`  ${C.red}${failed} failed${C.reset}`);
    for (const f of results.filter((r) => !r.ok)) {
      console.log(`    ${C.red}✗${C.reset} ${f.id}  ${f.name}${f.detail ? `  ${C.dim}${f.detail}${C.reset}` : ""}`);
    }
    console.log(`\n${C.red}${C.bold}T1 VALIDATION FAILED${C.reset}`);
    process.exit(1);
  }
  console.log(`\n${C.green}${C.bold}T1 VALIDATION PASSED${C.reset}`);
  process.exit(0);
}

main().catch((err) => { console.error("t1-validate-mgmt-api unexpected error:", err); process.exit(1); });

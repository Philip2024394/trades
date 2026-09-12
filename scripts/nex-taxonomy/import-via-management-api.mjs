#!/usr/bin/env node
// scripts/nex-taxonomy/import-via-management-api.mjs · Philip 2026-09-05
//
// NEX UNIVERSAL TAXONOMY · T1 · IMPORT VIA SUPABASE MANAGEMENT API (Option DML-B)
//
// Imports the canonical T0 content into nex_taxonomy tables via the same
// Management API used for schema DDL. Zero grants added. Zero role changes.
// No new privileges granted to nex_migrate or nex_app_runtime.
//
// USAGE
//   node --env-file=.env.tools.local scripts/nex-taxonomy/import-via-management-api.mjs
//
// EXIT CODES
//   0 = import complete + verification passed
//   1 = any request failed (Management API returns errors from Postgres directly)
//
// STRATEGY
//   1. Load T0 canonical JSON.
//   2. Send taxonomy_version upsert (1 request).
//   3. For each of 5 dimensions: multi-row INSERT with parent_id=NULL,
//      replacement_id=NULL, ON CONFLICT (dimension, slug) DO UPDATE (5 requests).
//   4. Send parent_id UPDATEs via VALUES-CTE join (1 request).
//   5. Send replacement_id UPDATEs (skipped · T0 has none).
//   6. Send market_meta multi-row INSERT (1 request).
//   7. Verify counts + Japan first_class via Management API.
//   Total: 8 sequential API requests · each idempotent.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, "..", "..", "..");
const TAXONOMY_ROOT = join(REPO_ROOT, "data", "nex-taxonomy", "v1");
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

function loadJson(name) { return JSON.parse(readFileSync(join(TAXONOMY_ROOT, name), "utf8")); }

// ── SQL literal helpers (safe for JSONB · Japanese · apostrophes) ────

function pgLit(s) {
  if (s === null || s === undefined) return "NULL";
  if (typeof s === "boolean") return s ? "TRUE" : "FALSE";
  if (typeof s === "number") return String(s);
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function pgJsonb(v) {
  const s = JSON.stringify(v ?? null);
  return "'" + s.replace(/'/g, "''") + "'::jsonb";
}
function pgIntOrNull(n) { return (n === null || n === undefined) ? "NULL" : String(parseInt(n, 10)); }

async function runQuery(token, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const rawBody = await res.text();
  let data = null;
  try { data = JSON.parse(rawBody); } catch { /* body may be error text */ }
  return { ok: res.ok, status: res.status, data: Array.isArray(data) ? data : (data?.result ?? null), rawBody };
}

async function requireOk(label, res) {
  if (!res.ok) {
    console.error(`\n✗ ${label} · status=${res.status}`);
    console.error(res.rawBody.slice(0, 2000));
    process.exit(1);
  }
  console.log(`  ✓ ${label} · status=${res.status}`);
}

async function main() {
  const token = process.env.NEX_SUPABASE_ACCESS_TOKEN;
  const ref   = process.env.NEX_SUPABASE_PROJECT_REF;
  if (!token || !ref) { console.error("NEX_SUPABASE_ACCESS_TOKEN + NEX_SUPABASE_PROJECT_REF must be set (run with --env-file=.env.tools.local)"); process.exit(1); }
  if (ref !== EXPECTED_PROJECT_REF) { console.error(`✗ project ref mismatch: ${ref} != ${EXPECTED_PROJECT_REF}`); process.exit(1); }

  console.log("=== NEX Universal Taxonomy · T1 · Management API IMPORT (DML-B) ===");
  console.log(`project_ref: ${ref} (Project B confirmed)\n`);

  const metadata   = loadJson("metadata.json");
  const industries = loadJson("industries.json");
  const products   = loadJson("products.json");
  const services   = loadJson("services.json");
  const roles      = loadJson("roles.json");
  const markets    = loadJson("markets.json");

  const dimensions = {
    industry: industries.nodes, product: products.nodes,
    service: services.nodes, role: roles.nodes, market: markets.nodes,
  };

  console.log("Content sizes:");
  for (const [d, ns] of Object.entries(dimensions)) console.log(`  ${d.padEnd(10)} ${ns.length} nodes`);
  console.log("");

  // Baseline check — schema exists, tables empty
  console.log("=== Baseline ===");
  const baseline = await runQuery(token, ref, `SELECT
    (SELECT count(*)::int FROM information_schema.schemata WHERE schema_name='nex_taxonomy') AS schema_c,
    (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node) AS nodes,
    (SELECT count(*)::int FROM nex_taxonomy.market_meta) AS markets,
    (SELECT count(*)::int FROM nex_taxonomy.taxonomy_version) AS versions`);
  await requireOk("baseline query", baseline);
  const bl = baseline.data?.[0] ?? {};
  console.log(`  schema=${bl.schema_c} · nodes=${bl.nodes} · markets=${bl.markets} · versions=${bl.versions}`);
  if (bl.schema_c !== 1) { console.error("✗ schema not present"); process.exit(1); }

  // ── Request 1 · taxonomy_version upsert ──────────────────────────
  console.log("\n=== Request 1 · taxonomy_version ===");
  const ver = metadata.taxonomy_version;
  const releasedAt = metadata.released_at ? new Date(metadata.released_at).toISOString() : new Date().toISOString();
  const versionMeta = {
    brain_domain_vocabulary: metadata.brain_domain_vocabulary,
    confidence_vocabulary: metadata.confidence_vocabulary,
    node_status_vocabulary: metadata.node_status_vocabulary,
    governance: metadata.governance,
    downstream_slices: metadata.downstream_slices,
  };
  const versionSql = `
    INSERT INTO nex_taxonomy.taxonomy_version (version, status, released_at, released_by, specification, changelog, metadata)
    VALUES (${ver}, 'active', ${pgLit(releasedAt)}, ${pgLit(metadata.released_by ?? null)}, ${pgLit(metadata.specification ?? null)}, ${pgJsonb(metadata.changelog ?? [])}, ${pgJsonb(versionMeta)})
    ON CONFLICT (version) DO UPDATE SET
      status='active',
      released_at=EXCLUDED.released_at,
      released_by=EXCLUDED.released_by,
      specification=EXCLUDED.specification,
      changelog=EXCLUDED.changelog,
      metadata=EXCLUDED.metadata`;
  await requireOk(`taxonomy_version v${ver}`, await runQuery(token, ref, versionSql));

  // ── Requests 2-6 · multi-row INSERT per dimension (parent_id=NULL) ──
  console.log("\n=== Requests 2-6 · multi-row INSERT per dimension ===");
  for (const [dim, nodes] of Object.entries(dimensions)) {
    const rows = nodes.map((n) => {
      const cols = [
        pgLit(dim),                              // dimension
        pgLit(n.slug),                           // slug
        pgIntOrNull(n.depth),                    // depth
        pgLit(n.label_en),                       // label_en
        pgJsonb(n.label_i18n ?? { en: n.label_en }), // label_i18n
        pgLit(n.i18n_key),                       // i18n_key
        pgLit(n.status ?? "active"),             // status
        pgIntOrNull(n.version_introduced ?? ver),// version_introduced
        pgIntOrNull(n.version_deprecated),       // version_deprecated
        pgJsonb(n.aliases ?? []),                // aliases
        pgJsonb(n.brain_domain_hints ?? []),     // brain_domain_hints
        pgJsonb(n.attribute_hints ?? []),        // attribute_hints
        pgLit(n.notes ?? null),                  // notes
        pgJsonb({}),                             // metadata
      ];
      return `(${cols.join(", ")})`;
    }).join(",\n  ");

    const insertSql = `
      INSERT INTO nex_taxonomy.taxonomy_node
        (dimension, slug, depth, label_en, label_i18n, i18n_key, status, version_introduced, version_deprecated, aliases, brain_domain_hints, attribute_hints, notes, metadata)
      VALUES
        ${rows}
      ON CONFLICT (dimension, slug) DO UPDATE SET
        depth              = EXCLUDED.depth,
        label_en           = EXCLUDED.label_en,
        label_i18n         = EXCLUDED.label_i18n,
        i18n_key           = EXCLUDED.i18n_key,
        status             = EXCLUDED.status,
        version_introduced = EXCLUDED.version_introduced,
        version_deprecated = EXCLUDED.version_deprecated,
        aliases            = EXCLUDED.aliases,
        brain_domain_hints = EXCLUDED.brain_domain_hints,
        attribute_hints    = EXCLUDED.attribute_hints,
        notes              = EXCLUDED.notes,
        metadata           = EXCLUDED.metadata`;
    await requireOk(`INSERT ${dim} (${nodes.length} rows · ${(insertSql.length/1024).toFixed(1)}KB)`, await runQuery(token, ref, insertSql));
  }

  // ── Request 7 · parent_id updates via VALUES-CTE join ────────────
  console.log("\n=== Request 7 · parent_id updates ===");
  const parentTuples = [];
  for (const [dim, nodes] of Object.entries(dimensions)) {
    for (const n of nodes) {
      if (n.parent_id) parentTuples.push(`(${pgLit(dim)}, ${pgLit(n.slug)}, ${pgLit(n.parent_id)})`);
    }
  }
  if (parentTuples.length > 0) {
    const parentSql = `
      WITH map(dim, child_slug, parent_slug) AS (
        VALUES
          ${parentTuples.join(",\n          ")}
      )
      UPDATE nex_taxonomy.taxonomy_node child
         SET parent_id = parent.id
        FROM map m
        JOIN nex_taxonomy.taxonomy_node parent
          ON parent.dimension = m.dim AND parent.slug = m.parent_slug
       WHERE child.dimension = m.dim
         AND child.slug = m.child_slug
         AND child.parent_id IS DISTINCT FROM parent.id`;
    await requireOk(`parent_id updates (${parentTuples.length} mappings · ${(parentSql.length/1024).toFixed(1)}KB)`, await runQuery(token, ref, parentSql));
  } else {
    console.log("  (no parent mappings)");
  }

  // ── Request 8 · replacement_id updates (T0 has zero) ─────────────
  const replTuples = [];
  for (const [dim, nodes] of Object.entries(dimensions)) {
    for (const n of nodes) {
      if (n.replacement_id) replTuples.push(`(${pgLit(dim)}, ${pgLit(n.slug)}, ${pgLit(n.replacement_id)})`);
    }
  }
  console.log(`\n=== Request 8 · replacement_id updates (${replTuples.length}) ===`);
  if (replTuples.length > 0) {
    const replSql = `
      WITH map(dim, child_slug, replacement_slug) AS (
        VALUES
          ${replTuples.join(",\n          ")}
      )
      UPDATE nex_taxonomy.taxonomy_node child
         SET replacement_id = replacement.id
        FROM map m
        JOIN nex_taxonomy.taxonomy_node replacement
          ON replacement.dimension = m.dim AND replacement.slug = m.replacement_slug
       WHERE child.dimension = m.dim
         AND child.slug = m.child_slug
         AND child.replacement_id IS DISTINCT FROM replacement.id`;
    await requireOk(`replacement_id updates`, await runQuery(token, ref, replSql));
  } else {
    console.log("  (T0 has zero replacements · skipped)");
  }

  // ── Request 9 · market_meta multi-row upsert ─────────────────────
  console.log("\n=== Request 9 · market_meta ===");
  const mmRows = markets.nodes.map((m) => (
    `(${pgLit(m.slug)}, ${pgLit(m.iso_alpha2)}, ${pgLit(m.region)}, ${pgLit(m.timezone)}, ${pgLit(m.currency_default)}, ${pgLit(!!m.first_class)})`
  )).join(",\n    ");
  const mmSql = `
    INSERT INTO nex_taxonomy.market_meta (node_id, iso_alpha2, region, timezone, currency_default, first_class)
    SELECT n.id, mm.iso_alpha2, mm.region, mm.timezone, mm.currency_default, mm.first_class
      FROM (VALUES
        ${mmRows}
      ) AS mm(slug, iso_alpha2, region, timezone, currency_default, first_class)
      JOIN nex_taxonomy.taxonomy_node n ON n.dimension = 'market' AND n.slug = mm.slug
    ON CONFLICT (node_id) DO UPDATE SET
      iso_alpha2       = EXCLUDED.iso_alpha2,
      region           = EXCLUDED.region,
      timezone         = EXCLUDED.timezone,
      currency_default = EXCLUDED.currency_default,
      first_class      = EXCLUDED.first_class`;
  await requireOk(`market_meta upsert (${markets.nodes.length} rows)`, await runQuery(token, ref, mmSql));

  // ── Post-import verification ─────────────────────────────────────
  console.log("\n=== Post-import verification (via Management API) ===");
  const verifySql = `
    SELECT
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_version) AS versions,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='industry') AS industries,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='product')  AS products,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='service')  AS services,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='role')     AS roles,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='market')   AS markets,
      (SELECT count(*)::int FROM nex_taxonomy.market_meta) AS market_meta,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE parent_id IS NULL) AS root_nodes,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE parent_id IS NOT NULL) AS parented_nodes,
      (SELECT first_class FROM nex_taxonomy.market_meta mm JOIN nex_taxonomy.taxonomy_node n ON n.id=mm.node_id WHERE n.dimension='market' AND n.slug='jp') AS japan_first_class,
      (SELECT count(*)::int FROM nex_taxonomy.taxonomy_node child
         JOIN nex_taxonomy.taxonomy_node parent ON parent.id = child.parent_id
        WHERE child.parent_id IS NOT NULL AND child.dimension <> parent.dimension) AS cross_dim_bleed`;
  const v = await runQuery(token, ref, verifySql);
  await requireOk("verification query", v);
  const r = v.data?.[0] ?? {};
  const canonicalNodeTotal = 45 + products.nodes.length + services.nodes.length + roles.nodes.length + 10;
  const parentedExpected = canonicalNodeTotal - Object.values(dimensions).reduce((s, arr) => s + arr.filter(n => !n.parent_id).length, 0);
  console.log(`  taxonomy_version rows : ${r.versions}`);
  console.log(`  industries            : ${r.industries} / 45`);
  console.log(`  products              : ${r.products} / ${products.nodes.length}`);
  console.log(`  services              : ${r.services} / ${services.nodes.length}`);
  console.log(`  roles                 : ${r.roles} / ${roles.nodes.length}`);
  console.log(`  markets               : ${r.markets} / 10`);
  console.log(`  market_meta           : ${r.market_meta} / 10`);
  console.log(`  root nodes            : ${r.root_nodes}`);
  console.log(`  parented nodes        : ${r.parented_nodes} (expected ${parentedExpected})`);
  console.log(`  Japan first_class     : ${r.japan_first_class}`);
  console.log(`  cross-dimension bleed : ${r.cross_dim_bleed} (must be 0)`);

  const problems = [];
  if (r.versions < 1) problems.push("no version row");
  if (r.industries !== 45) problems.push(`industries=${r.industries}`);
  if (r.products !== products.nodes.length) problems.push(`products=${r.products}`);
  if (r.services !== services.nodes.length) problems.push(`services=${r.services}`);
  if (r.roles !== roles.nodes.length) problems.push(`roles=${r.roles}`);
  if (r.markets !== 10) problems.push(`markets=${r.markets}`);
  if (r.market_meta !== 10) problems.push(`market_meta=${r.market_meta}`);
  if (r.japan_first_class !== true) problems.push(`Japan.first_class=${r.japan_first_class}`);
  if (r.cross_dim_bleed !== 0) problems.push(`cross_dim_bleed=${r.cross_dim_bleed}`);
  if (r.parented_nodes !== parentedExpected) problems.push(`parented=${r.parented_nodes} != expected ${parentedExpected}`);

  if (problems.length) {
    console.error(`\n✗ IMPORT VERIFICATION FAILED:`);
    for (const p of problems) console.error(`  · ${p}`);
    process.exit(1);
  }

  console.log("\n✓ IMPORT COMPLETE · verification passed");
  process.exit(0);
}

main().catch((err) => { console.error("import-via-management-api unexpected error:", err); process.exit(1); });

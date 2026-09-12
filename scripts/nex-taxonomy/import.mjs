#!/usr/bin/env node
// scripts/nex-taxonomy/import.mjs · Philip 2026-09-05
//
// NEX UNIVERSAL TAXONOMY · T1 · IMPORTER
//
// Reads the T0 canonical JSON (data/nex-taxonomy/v1/*.json) and imports
// into the persistent storage created by migration 144. Idempotent ·
// atomic · trigger-safe.
//
// USAGE
//   NEX_POSTGRES_URL=postgresql://... node scripts/nex-taxonomy/import.mjs
//
// EXIT CODES
//   0 = success
//   1 = validation or database failure (transaction rolled back)
//
// STRATEGY
//   1. Load canonical JSON (metadata · industries · products · services ·
//      roles · markets).
//   2. Run T0 validator inline (fail fast on content bugs).
//   3. Open single transaction against NEX_POSTGRES_URL.
//   4. UPSERT taxonomy_version.
//   5. PASS 1 · UPSERT all nodes with parent_id = NULL, replacement_id = NULL.
//      ON CONFLICT (dimension, slug) DO UPDATE preserves UUID identity.
//   6. PASS 2 · UPDATE parent_id via same-dimension slug join.
//   7. PASS 3 · UPDATE replacement_id via same-dimension slug join.
//   8. UPSERT market_meta rows for market dimension.
//   9. Verify counts + invariants inside the transaction.
//  10. COMMIT (or ROLLBACK on any error).
//
// The importer NEVER modifies unrelated NEX data · never activates any
// workforce · never invents UUIDs on re-run · never inserts duplicates.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, "..", "..", "..");
const TAXONOMY_ROOT = join(REPO_ROOT, "data", "nex-taxonomy", "v1");

const isTTY = process.stdout.isTTY;
const C = {
  reset: isTTY ? "\x1b[0m" : "",
  green: isTTY ? "\x1b[32m" : "",
  red:   isTTY ? "\x1b[31m" : "",
  yellow:isTTY ? "\x1b[33m" : "",
  dim:   isTTY ? "\x1b[2m" : "",
  bold:  isTTY ? "\x1b[1m" : "",
};

function log(msg) { console.log(msg); }
function ok(msg)   { log(`  ${C.green}✓${C.reset} ${msg}`); }
function warn(msg) { log(`  ${C.yellow}⚠${C.reset} ${msg}`); }
function fail(msg) { log(`  ${C.red}✗${C.reset} ${msg}`); }

// ── Load canonical content ───────────────────────────────────────────

function loadJson(name) {
  const p = join(TAXONOMY_ROOT, name);
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (err) { throw new Error(`Failed to load ${name}: ${err.message}`); }
}

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("[import] NEX_POSTGRES_URL not set · aborting");
    process.exit(1);
  }

  log(`${C.bold}NEX Universal Taxonomy · T1 Importer${C.reset}`);
  log(`${C.dim}Target: ${url.replace(/:[^:@]+@/, ":***@")}${C.reset}`);
  log("");

  log(`${C.bold}Load canonical content${C.reset}`);
  const metadata   = loadJson("metadata.json");
  const industries = loadJson("industries.json");
  const products   = loadJson("products.json");
  const services   = loadJson("services.json");
  const roles      = loadJson("roles.json");
  const markets    = loadJson("markets.json");
  const examples   = loadJson("examples.json");
  ok(`metadata · industries=${industries.nodes.length} · products=${products.nodes.length} · services=${services.nodes.length} · roles=${roles.nodes.length} · markets=${markets.nodes.length} · examples=${examples.examples.length}`);

  // ── Inline validation (subset of T0 checks · fail fast) ──────────────
  log(`\n${C.bold}Inline content validation${C.reset}`);

  const dimensions = { industry: industries.nodes, product: products.nodes, service: services.nodes, role: roles.nodes, market: markets.nodes };
  const brainVocabulary = new Set(metadata.brain_domain_vocabulary || []);

  // Dimension separation · unique ids/slugs · brain hints in vocabulary · label_i18n.en match
  for (const [dim, nodes] of Object.entries(dimensions)) {
    const idSet = new Set();
    const slugSet = new Set();
    for (const n of nodes) {
      if (n.domain !== dim) throw new Error(`[${dim}] node ${n.id} has wrong domain field: ${n.domain}`);
      if (idSet.has(n.id)) throw new Error(`[${dim}] duplicate id: ${n.id}`);
      if (slugSet.has(n.slug)) throw new Error(`[${dim}] duplicate slug: ${n.slug}`);
      idSet.add(n.id);
      slugSet.add(n.slug);
      if ((n.label_i18n?.en ?? "") !== n.label_en) throw new Error(`[${dim}] label_i18n.en != label_en for ${n.id}`);
      const hints = Array.isArray(n.brain_domain_hints) ? n.brain_domain_hints : [];
      for (const h of hints) {
        if (!brainVocabulary.has(h)) throw new Error(`[${dim}] brain hint ${h} not in vocabulary (${n.id})`);
      }
    }
    ok(`[${dim}] ${nodes.length} nodes · ids+slugs unique · hints valid`);
  }

  if (industries.nodes.length !== 45) throw new Error(`Expected 45 industries, got ${industries.nodes.length}`);
  ok(`industries.length = 45 (T0 doctrine target)`);

  const jp = markets.nodes.find((m) => m.id === "JP");
  if (!jp) throw new Error("Market JP missing");
  if (jp.first_class !== true) throw new Error("Market JP.first_class must be true");
  ok(`Japan first_class = true`);

  // ── Connect ──────────────────────────────────────────────────────────
  log(`\n${C.bold}Connect to Project B${C.reset}`);
  let pg;
  try { pg = await import("pg"); }
  catch { console.error("[import] pg package missing · run: npm install pg"); process.exit(1); }

  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const pool = new pg.default.Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3, // tight budget · never starve app pool (per workforce-must-not-starve-app doctrine)
  });

  const client = await pool.connect();
  ok(`connected · ssl=${needsSsl}`);

  let ok_import = false;
  try {
    await client.query("BEGIN");
    log(`\n${C.bold}Import (single transaction)${C.reset}`);

    // ── UPSERT taxonomy_version ──────────────────────────────────────
    const ver = metadata.taxonomy_version;
    const releasedAt = metadata.released_at ? new Date(metadata.released_at).toISOString() : new Date().toISOString();
    await client.query(
      `INSERT INTO nex_taxonomy.taxonomy_version (version, status, released_at, released_by, specification, changelog, metadata)
       VALUES ($1, 'active', $2, $3, $4, $5, $6)
       ON CONFLICT (version) DO UPDATE SET
         status='active',
         released_at=EXCLUDED.released_at,
         released_by=EXCLUDED.released_by,
         specification=EXCLUDED.specification,
         changelog=EXCLUDED.changelog,
         metadata=EXCLUDED.metadata,
         updated_at=now()`,
      [ver, releasedAt, metadata.released_by ?? null, metadata.specification ?? null,
       JSON.stringify(metadata.changelog ?? []),
       JSON.stringify({
         brain_domain_vocabulary: metadata.brain_domain_vocabulary,
         confidence_vocabulary: metadata.confidence_vocabulary,
         node_status_vocabulary: metadata.node_status_vocabulary,
         governance: metadata.governance,
         downstream_slices: metadata.downstream_slices,
       })]
    );
    ok(`taxonomy_version v${ver} upserted`);

    // ── PASS 1 · UPSERT all nodes with parent_id=NULL, replacement_id=NULL ──
    let insertedThisRun = 0;
    for (const [dim, nodes] of Object.entries(dimensions)) {
      for (const n of nodes) {
        const res = await client.query(
          `INSERT INTO nex_taxonomy.taxonomy_node
             (dimension, slug, parent_id, depth, label_en, label_i18n, i18n_key, status,
              version_introduced, version_deprecated, replacement_id,
              aliases, brain_domain_hints, attribute_hints, notes, metadata)
           VALUES
             ($1, $2, NULL, $3, $4, $5, $6, $7,
              $8, $9, NULL,
              $10, $11, $12, $13, $14)
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
             metadata           = EXCLUDED.metadata,
             updated_at         = now()
           RETURNING (xmax = 0) AS inserted`,
          [
            dim,
            n.slug,
            n.depth,
            n.label_en,
            JSON.stringify(n.label_i18n ?? { en: n.label_en }),
            n.i18n_key,
            n.status ?? "active",
            n.version_introduced ?? ver,
            n.version_deprecated ?? null,
            JSON.stringify(n.aliases ?? []),
            JSON.stringify(n.brain_domain_hints ?? []),
            JSON.stringify(n.attribute_hints ?? []),
            n.notes ?? null,
            JSON.stringify({}),
          ]
        );
        if (res.rows[0]?.inserted) insertedThisRun++;
      }
    }
    const totalCanonical = Object.values(dimensions).reduce((s, arr) => s + arr.length, 0);
    ok(`pass 1 · ${totalCanonical} canonical nodes upserted (newly inserted this run: ${insertedThisRun})`);

    // ── PASS 2 · UPDATE parent_id for nodes with a parent ─────────────
    let parentedCount = 0;
    for (const [dim, nodes] of Object.entries(dimensions)) {
      for (const n of nodes) {
        if (!n.parent_id) continue;
        const r = await client.query(
          `UPDATE nex_taxonomy.taxonomy_node child
             SET parent_id = parent.id
             FROM nex_taxonomy.taxonomy_node parent
             WHERE child.dimension = $1
               AND child.slug = $2
               AND parent.dimension = $1
               AND parent.slug = $3
               AND child.parent_id IS DISTINCT FROM parent.id`,
          [dim, n.slug, n.parent_id]
        );
        parentedCount += r.rowCount;
      }
    }
    ok(`pass 2 · parent_id updated for ${parentedCount} rows this run (already-correct rows skipped)`);

    // ── PASS 3 · UPDATE replacement_id for nodes with one ─────────────
    let replacementCount = 0;
    for (const [dim, nodes] of Object.entries(dimensions)) {
      for (const n of nodes) {
        if (!n.replacement_id) continue;
        const r = await client.query(
          `UPDATE nex_taxonomy.taxonomy_node child
             SET replacement_id = replacement.id
             FROM nex_taxonomy.taxonomy_node replacement
             WHERE child.dimension = $1
               AND child.slug = $2
               AND replacement.dimension = $1
               AND replacement.slug = $3
               AND child.replacement_id IS DISTINCT FROM replacement.id`,
          [dim, n.slug, n.replacement_id]
        );
        replacementCount += r.rowCount;
      }
    }
    ok(`pass 3 · replacement_id updated for ${replacementCount} rows this run`);

    // ── UPSERT market_meta ──────────────────────────────────────────
    let mmCount = 0;
    for (const m of markets.nodes) {
      const r = await client.query(
        `INSERT INTO nex_taxonomy.market_meta (node_id, iso_alpha2, region, timezone, currency_default, first_class)
         SELECT id, $2, $3, $4, $5, $6
           FROM nex_taxonomy.taxonomy_node
          WHERE dimension = 'market' AND slug = $1
         ON CONFLICT (node_id) DO UPDATE SET
           iso_alpha2       = EXCLUDED.iso_alpha2,
           region           = EXCLUDED.region,
           timezone         = EXCLUDED.timezone,
           currency_default = EXCLUDED.currency_default,
           first_class      = EXCLUDED.first_class,
           updated_at       = now()`,
        [m.slug, m.iso_alpha2 ?? null, m.region ?? null, m.timezone ?? null, m.currency_default ?? null, !!m.first_class]
      );
      mmCount += r.rowCount;
    }
    ok(`market_meta upserted (${mmCount} rows)`);

    // ── In-transaction verification ──────────────────────────────────
    log(`\n${C.bold}In-transaction verification${C.reset}`);
    const q = async (sql, args = []) => (await client.query(sql, args)).rows;

    const [{ count: nIndustries }] = await q(`SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='industry'`);
    const [{ count: nProducts }]   = await q(`SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='product'`);
    const [{ count: nServices }]   = await q(`SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='service'`);
    const [{ count: nRoles }]      = await q(`SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='role'`);
    const [{ count: nMarkets }]    = await q(`SELECT count(*)::int FROM nex_taxonomy.taxonomy_node WHERE dimension='market'`);
    const [{ count: nMarketMeta }] = await q(`SELECT count(*)::int FROM nex_taxonomy.market_meta`);
    ok(`counts · industries=${nIndustries}/45 · products=${nProducts}/${products.nodes.length} · services=${nServices}/${services.nodes.length} · roles=${nRoles}/${roles.nodes.length} · markets=${nMarkets}/10 · market_meta=${nMarketMeta}/10`);

    if (nIndustries !== 45) throw new Error(`industry count mismatch: ${nIndustries} != 45`);
    if (nProducts !== products.nodes.length) throw new Error(`product count mismatch`);
    if (nServices !== services.nodes.length) throw new Error(`service count mismatch`);
    if (nRoles !== roles.nodes.length) throw new Error(`role count mismatch`);
    if (nMarkets !== 10) throw new Error(`market count mismatch: ${nMarkets} != 10`);
    if (nMarketMeta !== 10) throw new Error(`market_meta count mismatch: ${nMarketMeta} != 10`);

    const [{ jp_first_class }] = await q(
      `SELECT mm.first_class AS jp_first_class
         FROM nex_taxonomy.market_meta mm
         JOIN nex_taxonomy.taxonomy_node n ON n.id = mm.node_id
        WHERE n.dimension = 'market' AND n.slug = 'jp'`
    );
    if (jp_first_class !== true) throw new Error(`Japan first_class must be true, got ${jp_first_class}`);
    ok(`Japan first_class=true`);

    const orphans = await q(
      `SELECT count(*)::int AS c FROM nex_taxonomy.taxonomy_node child
         WHERE child.parent_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM nex_taxonomy.taxonomy_node parent
               WHERE parent.id = child.parent_id
                 AND parent.dimension = child.dimension
           )`
    );
    if (orphans[0].c !== 0) throw new Error(`orphan rows: ${orphans[0].c}`);
    ok(`zero orphans · dimension separation intact`);

    // Ensure canonical counts match what T0 says
    const canonicalTotal = 45 + products.nodes.length + services.nodes.length + roles.nodes.length + 10;
    const [{ count: nTotal }] = await q(`SELECT count(*)::int FROM nex_taxonomy.taxonomy_node`);
    if (nTotal !== canonicalTotal) {
      throw new Error(`total node count mismatch: db=${nTotal} vs canonical=${canonicalTotal} · possible stale rows from prior version`);
    }
    ok(`total node count matches canonical (${nTotal})`);

    await client.query("COMMIT");
    ok_import = true;
    log(`\n${C.green}${C.bold}T1 IMPORT COMMITTED${C.reset}`);
  } catch (err) {
    log(`\n${C.red}IMPORT ROLLED BACK${C.reset}`);
    fail(err instanceof Error ? err.message : String(err));
    try { await client.query("ROLLBACK"); } catch { /* noop */ }
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(ok_import ? 0 : 1);
}

main().catch((err) => {
  console.error("[import] unexpected error:", err);
  process.exit(1);
});

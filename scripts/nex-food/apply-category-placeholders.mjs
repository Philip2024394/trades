// scripts/nex-food/apply-category-placeholders.mjs · Philip 2026-08-28.
//
// Fill empty food_business.hero_image_url slots with category-matched
// placeholder images from src/lib/nexapp/foodKnowledge.ts. Each listing
// gets a deterministic pick by hashing internal_id → pool-index. Same
// business_id always maps to the same image so refresh is stable.
//
// PROVENANCE (honest labelling per NEX image doctrine):
//   hero_image_source     = 'nex_category_pool'
//   hero_image_approved   = false          (owner claim can override)
//   hero_image_provenance = { kind: 'category_illustration',
//                             pool: <categorySlug>,
//                             pool_size: <N>,
//                             note: 'Category illustration · not a verified
//                                   image of this specific business',
//                             selected_at: <ISO>,
//                             source_file: 'src/lib/nexapp/foodKnowledge.ts' }
//
// Cards can display a small "Category illustration" chip when
// hero_image_source === 'nex_category_pool'.
//
// Reversible: reset all placeholder-sourced rows via
//   UPDATE nex.food_business SET hero_image_url=NULL, hero_image_source=NULL,
//          hero_image_provenance=NULL
//   WHERE hero_image_source = 'nex_category_pool';
//
// Usage:
//   node scripts/nex-food/apply-category-placeholders.mjs           # dry run
//   node scripts/nex-food/apply-category-placeholders.mjs --apply   # write

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FOOD_KNOWLEDGE = path.join(REPO_ROOT, "src", "lib", "nexapp", "foodKnowledge.ts");

const APPLY = process.argv.includes("--apply");

// DB category value → foodKnowledge categorySlug value (verified against
// parse output: pools are `restaurant` / `coffee-cafe` / `fast-food` /
// `ice-cream-dessert` · all singular for restaurants).
const CATEGORY_MAP = {
  "restaurant":        "restaurant",
  "coffee-cafe":       "coffee-cafe",
  "fast-food":         "fast-food",
  "ice-cream-dessert": "ice-cream-dessert",
};

// ── Extract images from foodKnowledge.ts ───────────────────────────────────

const src = fs.readFileSync(FOOD_KNOWLEDGE, "utf8");

// The file declares records like:
//   {
//     id: "...",
//     publicKnowledgeRef: "#FK-YOG-001",
//     imageUrl: "https://ik.imagekit.io/...",
//     categorySlug: "restaurants",
//     cuisine: "Indonesian",
//     primaryDish: "Nasi Padang platter",
//     ...
//   }
// Each record spans multiple lines. Split file on `publicKnowledgeRef:`
// and pull fields from each block.
function extractRecords() {
  const chunks = src.split(/publicKnowledgeRef:\s*"/);
  const out = [];
  for (const chunk of chunks.slice(1)) {   // skip first (preamble)
    const closingQuote = chunk.indexOf('"');
    if (closingQuote < 0) continue;
    const ref = chunk.slice(0, closingQuote);
    const rest = chunk.slice(closingQuote + 1);

    const urlM = rest.match(/imageUrl:\s*"([^"]+)"/);
    const catM = rest.match(/categorySlug:\s*"([^"]+)"/);
    if (!urlM || !catM) continue;

    const dishM    = rest.match(/primaryDish:\s*"([^"]+)"/);
    const cuisineM = rest.match(/cuisine:\s*"([^"]+)"/);
    out.push({
      ref,
      imageUrl: urlM[1],
      categorySlug: catM[1],
      primaryDish: dishM ? dishM[1] : null,
      cuisine: cuisineM ? cuisineM[1] : null,
    });
  }
  return out;
}

const records = extractRecords();
console.log(`[extract] parsed ${records.length} food knowledge records`);

// Pool by categorySlug
const pools = {};
for (const r of records) {
  (pools[r.categorySlug] ??= []).push(r);
}
for (const [k, v] of Object.entries(pools)) {
  console.log(`  pool ${k}: ${v.length}`);
}

// ── Deterministic pick from pool by business_id hash ──────────────────────

function pickFromPool(businessId, pool) {
  if (!pool || pool.length === 0) return null;
  const h = crypto.createHash("sha1").update(businessId).digest();
  const idx = h.readUInt32BE(0) % pool.length;
  return pool[idx];
}

// ── Apply ─────────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 4,
});

async function main() {
  console.log(`\n[apply] mode: ${APPLY ? "WRITE" : "DRY RUN (add --apply to write)"}\n`);

  // Fetch all empty listings, category by category (respect the mapping)
  const stats = { scanned: 0, wouldUpdate: 0, updated: 0, byCategory: {} };

  for (const [dbCat, poolKey] of Object.entries(CATEGORY_MAP)) {
    const p = pools[poolKey] ?? [];
    if (p.length === 0) {
      console.log(`  skip · category ${dbCat} · pool ${poolKey} empty`);
      continue;
    }
    const emptyRows = await pool.query(
      `SELECT internal_id::text AS id, business_name
       FROM nex.food_business
       WHERE category = $1
         AND (hero_image_url IS NULL OR hero_image_url = '')`,
      [dbCat],
    );
    stats.scanned += emptyRows.rowCount;
    stats.byCategory[dbCat] = { empty: emptyRows.rowCount, updated: 0 };

    // Batch update in chunks of 200
    const chunkSize = 200;
    for (let i = 0; i < emptyRows.rows.length; i += chunkSize) {
      const chunk = emptyRows.rows.slice(i, i + chunkSize);
      if (!APPLY) {
        for (const row of chunk) {
          const rec = pickFromPool(row.id, p);
          if (rec) stats.wouldUpdate++;
        }
      } else {
        const provenance = (rec) => JSON.stringify({
          kind: "category_illustration",
          pool: poolKey,
          pool_size: p.length,
          note: "Category illustration · not a verified image of this specific business",
          selected_at: new Date().toISOString(),
          source_file: "src/lib/nexapp/foodKnowledge.ts",
          image_ref: rec.ref,
          image_dish: rec.primaryDish,
          image_cuisine: rec.cuisine,
        });
        // Multi-row upsert via UNNEST for atomicity
        const ids = chunk.map((r) => r.id);
        const urls = chunk.map((r) => pickFromPool(r.id, p).imageUrl);
        const provs = chunk.map((r) => provenance(pickFromPool(r.id, p)));
        await pool.query(
          `UPDATE nex.food_business AS fb
              SET hero_image_url        = data.url,
                  hero_image_source     = 'nex_category_pool',
                  hero_image_approved   = false,
                  hero_image_provenance = data.prov::jsonb,
                  updated_at            = NOW()
             FROM (SELECT unnest($1::uuid[]) AS id,
                          unnest($2::text[]) AS url,
                          unnest($3::text[]) AS prov) AS data
            WHERE fb.internal_id = data.id
              AND (fb.hero_image_url IS NULL OR fb.hero_image_url = '')`,
          [ids, urls, provs],
        );
        stats.updated += chunk.length;
        stats.byCategory[dbCat].updated += chunk.length;
      }
    }
    console.log(`  ${dbCat}: ${emptyRows.rowCount} empty · pool=${p.length} · ${APPLY ? "updated="+stats.byCategory[dbCat].updated : "would-update="+emptyRows.rowCount}`);
  }

  console.log("\n[done]");
  console.log("  scanned empty:", stats.scanned);
  if (APPLY) console.log("  updated:     ", stats.updated);
  else       console.log("  would update:", stats.wouldUpdate);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

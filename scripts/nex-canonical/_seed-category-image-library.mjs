// scripts/nex-canonical/_seed-category-image-library.mjs
//
// NEX Directory · P0 · Seed the category_image_library with 10 food
// variant illustrations.
//
// Idempotent · safe to re-run · uses WHERE NOT EXISTS keyed on
// (category_slug, variant_tag) because migration 112 does not declare
// a UNIQUE constraint on that pair.
//
// Hard guard: refuses to run against anything but the local `nex_dev`
// database. The seed MUST NOT be fired against the Supabase canonical
// mirror or any production target.
//
// Run with:
//   node --env-file=.env.local scripts/nex-canonical/_seed-category-image-library.mjs

import pg from "pg";

const CATEGORY_SLUG = "food";
const LICENCE = "NEX internal";
const ATTRIBUTION = "NEX design system";
const ADDED_BY = "philip";
const NOTES =
  "Representative illustration · not a photograph of the specific business (ADR-0022)";
const PRIORITY = 100;

// 10 variants · matches the SVGs authored under
// public/nex-category-fallbacks/food-<variant>.svg.
const VARIANTS = [
  "restaurant",
  "cafe",
  "warung",
  "bakery",
  "street-food",
  "fine-dining",
  "seafood",
  "fast-food",
  "dessert",
  "bar-pub",
];

function urlFor(variant) {
  return `/nex-category-fallbacks/food-${variant}.svg`;
}

async function main() {
  const connectionString = process.env.NEX_POSTGRES_URL;
  if (!connectionString) {
    console.error("NEX_POSTGRES_URL is not set · aborting");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // ── Guard · verify we are on the LOCAL nex_dev database ──────────
    const db = await client.query("SELECT current_database() AS db");
    const dbName = db.rows[0]?.db;
    if (dbName !== "nex_dev") {
      console.error(
        `Refusing to seed · current_database() = ${JSON.stringify(dbName)} ` +
          `(expected 'nex_dev')`,
      );
      process.exit(2);
    }
    console.log(`[seed-category-image-library] db = ${dbName} · OK`);

    // ── Idempotent insert · WHERE NOT EXISTS keyed on slug+variant ──
    const insertSql = `
      INSERT INTO nex.category_image_library
        (category_slug, variant_tag, url, attribution, licence, priority, active, notes, added_by)
      SELECT $1, $2, $3, $4, $5, $6, TRUE, $7, $8
      WHERE NOT EXISTS (
        SELECT 1
          FROM nex.category_image_library
         WHERE category_slug = $1
           AND variant_tag   = $2
      )
      RETURNING id
    `;

    let inserted = 0;
    for (const variant of VARIANTS) {
      const result = await client.query(insertSql, [
        CATEGORY_SLUG,
        variant,
        urlFor(variant),
        ATTRIBUTION,
        LICENCE,
        PRIORITY,
        NOTES,
        ADDED_BY,
      ]);
      if (result.rows.length > 0) {
        inserted += 1;
        console.log(`[seed] inserted food/${variant} → ${result.rows[0].id}`);
      } else {
        console.log(`[seed] skipped food/${variant} · already present`);
      }
    }

    const totalResult = await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.category_image_library WHERE active = TRUE",
    );
    const total = totalResult.rows[0]?.n ?? 0;

    console.log(`[seed-category-image-library] inserted ${inserted} new row(s)`);
    console.log(`[seed-category-image-library] total active rows = ${total}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[seed-category-image-library] FAILED", err);
  process.exit(1);
});

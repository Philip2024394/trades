#!/usr/bin/env node
// scripts/nex-workforce/seed-bike-taxonomy.mjs · Philip 2026-08-29
//
// Idempotent seed of nex.bike_model from data/nex-bike-taxonomy.json.
// Run any time · UPSERTs on slug · never destructive.

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAXONOMY_PATH = pathResolve(__dirname, "..", "..", "data", "nex-bike-taxonomy.json");

const pool = new pg.Pool({
  connectionString:
    process.env.NEX_POSTGRES_URL ??
    "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

async function main() {
  const raw = JSON.parse(readFileSync(TAXONOMY_PATH, "utf8"));
  const bikes = Array.isArray(raw.bikes) ? raw.bikes : [];
  console.log(`loaded ${bikes.length} bikes from taxonomy`);

  const client = await pool.connect();
  let inserted = 0, updated = 0;
  try {
    for (const b of bikes) {
      const res = await client.query(
        `INSERT INTO nex.bike_model
           (slug, brand, model, year_range, cc, category,
            base_image, base_color, common_colors)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (slug) DO UPDATE SET
           brand         = EXCLUDED.brand,
           model         = EXCLUDED.model,
           year_range    = EXCLUDED.year_range,
           cc            = EXCLUDED.cc,
           category      = EXCLUDED.category,
           base_image    = EXCLUDED.base_image,
           base_color    = EXCLUDED.base_color,
           common_colors = EXCLUDED.common_colors,
           updated_at    = now()
         RETURNING (xmax = 0) AS is_new`,
        [
          b.slug, b.brand, b.model, b.year_range, b.cc, b.category,
          b.base_image, b.base_color, b.common_colors ?? [],
        ],
      );
      if (res.rows[0]?.is_new) inserted++; else updated++;
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`done · inserted=${inserted} · updated=${updated}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

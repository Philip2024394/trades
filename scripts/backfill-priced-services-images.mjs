// One-shot backfill: for every demo listing in Supabase, overwrite the
// `priced_services` JSONB column with the same service entries the seed
// would build today — but now with `image_url` populated from
// src/lib/demoServiceImages.ts.
//
// Safe to re-run: a fresh UPDATE replaces the column atomically, and if
// the image map gets richer over time, re-running picks up the new
// URLs without dropping anything else.
//
// Run: node scripts/backfill-priced-services-images.mjs

import { readFileSync } from "node:fs";
import { DEMO_TRADE_SEEDS } from "../src/lib/demoTradeSeeds.ts";
import { DEMO_SERVICE_IMAGES } from "../src/lib/demoServiceImages.ts";

const ENV_TEXT = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = ENV_TEXT.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

function esc(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

let updated = 0;
let missing = 0;

for (const seed of DEMO_TRADE_SEEDS) {
  const enriched = seed.priced_services.map((s) => ({
    name: s.name,
    price: s.price,
    unit: s.unit,
    description: s.description,
    image_url: DEMO_SERVICE_IMAGES[`${seed.trade_slug}::${s.name}`] ?? null
  }));
  const sql = `
    UPDATE hammerex_trade_off_listings
       SET priced_services = ${esc(JSON.stringify(enriched))}::jsonb
     WHERE slug = ${esc(seed.profile_slug)}
   RETURNING id;
  `;
  const res = await query(sql);
  if (Array.isArray(res) && res.length > 0) {
    updated++;
    const imgsCount = enriched.filter((e) => !!e.image_url).length;
    console.log(`= ${seed.profile_slug}: ${enriched.length} services (${imgsCount} with image)`);
  } else {
    missing++;
    console.warn(`! ${seed.profile_slug}: no listing matched`);
  }
}

console.log(`\nDone. Listings updated: ${updated}. Missed: ${missing}.`);

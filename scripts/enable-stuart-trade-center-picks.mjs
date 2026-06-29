// One-shot: enable Trade Center Picks for Stuart's demo profile +
// seed 4 demo picks pointing at his existing xrated products.
// Idempotent — uses ON CONFLICT (listing_id, product_id) DO UPDATE.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const STUART_SLUG = "demo-stuart-kingsley-building-merchant-hull";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

// 1. Find Stuart.
const listingRows = await query(
  `SELECT id, addons_enabled FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}' LIMIT 1;`
);
if (!listingRows.length) throw new Error(`Listing not found: ${STUART_SLUG}`);
const listingId = listingRows[0].id;
console.log(`Stuart's listing_id: ${listingId}`);

// 2. Find his xrated products.
const products = await query(
  `SELECT id, name FROM hammerex_xrated_products WHERE listing_id = '${listingId}' AND status = 'live' ORDER BY sort_order ASC, created_at DESC LIMIT 8;`
);
console.log(`Found ${products.length} live products`);
products.forEach((p) => console.log(`  - ${p.name} (${p.id})`));

if (products.length === 0) {
  console.error("Stuart has 0 live products — cannot seed picks. Toggling addon only.");
}

// 3. Toggle the addon on.
await query(
  `UPDATE hammerex_trade_off_listings
   SET addons_enabled = COALESCE(addons_enabled, '{}'::jsonb) || '{"trade_center_picks": true}'::jsonb
   WHERE id = '${listingId}';`
);
console.log("Addon trade_center_picks toggled ON");

// 4. Seed picks (one per status, up to 5 products).
const STATUS_PLAN = [
  { status: "on_promo", note: "20% off this week — pallet quantities only.", arrival: null, expires_days: 14 },
  { status: "new_arrival", note: "Just hit the yard — first orders out tomorrow.", arrival: null, expires_days: null },
  { status: "pre_order", note: "Reserve now — arrives next month.", arrival_days: 28, expires: null },
  { status: "in_stock", note: "Always on the shelf. No wait.", arrival: null, expires: null },
  { status: "just_arrived", note: "Fresh stock landed Monday.", arrival: null, expires_days: 7 }
];

let inserted = 0;
for (let i = 0; i < Math.min(products.length, STATUS_PLAN.length); i++) {
  const p = products[i];
  const plan = STATUS_PLAN[i];
  const arrivalSql =
    plan.arrival_days != null
      ? `now() + interval '${plan.arrival_days} days'`
      : "NULL";
  const expiresSql =
    plan.expires_days != null
      ? `now() + interval '${plan.expires_days} days'`
      : "NULL";
  const noteSql = plan.note.replace(/'/g, "''");
  const sql = `
    INSERT INTO hammerex_xrated_trade_center_picks
      (listing_id, product_id, status, note, arrival_at, expires_at, sort_order)
    VALUES
      ('${listingId}', '${p.id}', '${plan.status}', '${noteSql}', ${arrivalSql}, ${expiresSql}, ${i})
    ON CONFLICT (listing_id, product_id) DO UPDATE
      SET status = EXCLUDED.status,
          note = EXCLUDED.note,
          arrival_at = EXCLUDED.arrival_at,
          expires_at = EXCLUDED.expires_at,
          sort_order = EXCLUDED.sort_order,
          updated_at = now();
  `;
  await query(sql);
  inserted++;
  console.log(`  + ${plan.status.padEnd(13)} → ${p.name}`);
}

console.log(`\nDone. ${inserted} picks seeded for Stuart.`);

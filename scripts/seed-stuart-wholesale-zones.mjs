// Seed Stuart's wholesale-mode setup so the 3-zone delivery widget
// has data to render:
//   - Toggle wholesale_mode add-on ON
//   - Set wholesale_origin_lat/lng to Stuart's Hull yard coords
//   - Insert/upsert a single zones row with 3 zones:
//     5km free / 15km £15 / 30km £40

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const SLUG = "demo-stuart-kingsley-building-merchant-hull";
const HULL_LAT = 53.7457;
const HULL_LNG = -0.3367;

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

// 1. Toggle add-on + set yard origin
await q(`
  UPDATE hammerex_trade_off_listings
     SET addons_enabled = COALESCE(addons_enabled, '{}'::jsonb) || '{"wholesale_mode": true}'::jsonb,
         wholesale_origin_lat = ${HULL_LAT},
         wholesale_origin_lng = ${HULL_LNG},
         wholesale_allow_pickup = true,
         updated_at = now()
   WHERE slug = '${SLUG}';
`);

// 2. Upsert the zones row (one per listing).
const bands = JSON.stringify([
  { max_km: 15, price_pence: 1500, min_order_pence: 0 },
  { max_km: 30, price_pence: 4000, min_order_pence: 0 }
]);

const listingId = (await q(`
  SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}';
`))[0].id;

// Insert if missing, update if exists.
await q(`
  INSERT INTO hammerex_xrated_wholesale_zones
    (listing_id, free_radius_km, banded_pricing, max_delivery_km, min_order_pence, sort_order)
  VALUES
    ('${listingId}', 5, ${"$$" + bands + "$$"}::jsonb, 30, 0, 0)
  ON CONFLICT (listing_id) DO UPDATE
    SET free_radius_km = EXCLUDED.free_radius_km,
        banded_pricing = EXCLUDED.banded_pricing,
        max_delivery_km = EXCLUDED.max_delivery_km,
        min_order_pence = EXCLUDED.min_order_pence,
        updated_at = now();
`);

const after = await q(`
  SELECT free_radius_km, banded_pricing, max_delivery_km
    FROM hammerex_xrated_wholesale_zones
   WHERE listing_id = '${listingId}';
`);
console.log("Zones:", JSON.stringify(after, null, 2));

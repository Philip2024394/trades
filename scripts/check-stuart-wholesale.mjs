import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  return JSON.parse(await r.text());
}
const listing = await q(`SELECT id, slug, wholesale_origin_lat, wholesale_origin_lng, wholesale_allow_pickup, addons_enabled->'wholesale_mode' AS wholesale_on FROM hammerex_trade_off_listings WHERE slug='demo-stuart-kingsley-building-merchant-hull'`);
console.log("Listing wholesale fields:", JSON.stringify(listing, null, 2));
const zones = await q(`SELECT id, free_radius_km, banded_pricing, free_postcodes, max_delivery_km FROM hammerex_xrated_wholesale_zones WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug='demo-stuart-kingsley-building-merchant-hull')`);
console.log("\nZones row:", JSON.stringify(zones, null, 2));

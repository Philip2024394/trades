// Seed Russell Haines' wholesale_origin_* fields so the delivery-zones
// map can pin his depot at Leeds LS10 1LG.

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
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

// Leeds LS10 1LG is roughly the Aire Valley Industrial Estate area.
// Coords resolved to Postcodes.io centroid.
const LAT = 53.7727;
const LNG = -1.5364;

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET wholesale_origin_lat = ${LAT},
         wholesale_origin_lng = ${LNG},
         wholesale_origin_postcode = 'LS10 1LG',
         wholesale_origin_address = 'Unit 4 Aire Valley Industrial Estate\\nLeeds LS10 1LG',
         wholesale_distance_fudge = 1.4
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id, wholesale_origin_lat, wholesale_origin_lng;
`);
console.log("Russell yard origin seeded:", upd);

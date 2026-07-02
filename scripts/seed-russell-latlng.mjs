// Seed Russell's listing lat/lng (the general profile coords the
// services page and TradeAreaMap use). Copies the same LS10 1LG
// coordinates already on wholesale_origin_lat/lng.

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

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET lat = 53.7727, lng = -1.5364
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id, lat, lng;
`);
console.log("Russell lat/lng seeded:", upd);

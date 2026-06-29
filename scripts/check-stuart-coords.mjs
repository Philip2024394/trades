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
const r = await q(`SELECT slug, primary_trade, city, lat, lng, array_length(service_postcodes, 1) AS postcodes_n, array_length(services_offered, 1) AS services_n, operating_hours IS NOT NULL AS has_hours FROM hammerex_trade_off_listings WHERE slug='demo-stuart-kingsley-building-merchant-hull'`);
console.log(JSON.stringify(r, null, 2));

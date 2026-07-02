// Set the site cabin image on Stuart's welfare_unit category.

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

const slug = "demo-stuart-kingsley-building-merchant-hull";
const URL =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_42_41%20AM.png";

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{categories,welfare_unit,image_url}', '"${URL}"'::jsonb, true)
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Patched welfare_unit image_url:", upd);

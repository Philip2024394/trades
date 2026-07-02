// Seed a sample running_text banner on Russell's mini_excavator so
// the new feature is visible out of the box.

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

const slug = "demo-russell-haines-plant-hire-leeds";
const text =
  "New mini excavator 3.5 tonne arriving Wednesday — hire from Friday morning with nationwide delivery";

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{categories,mini_excavator,running_text}', '"${text}"'::jsonb, true)
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Mini excavator running_text set:", upd);

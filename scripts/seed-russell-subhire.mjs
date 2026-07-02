// Update Russell's sub-hire copy to the Trade Circle sourcing pitch.

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

const cfg = {
  enabled: true,
  heading: "Not listed? Ask us anyway.",
  subheading:
    "We partner with Trade Circle — the UK trades network — to source machines, parts and consumables you can't find on our shelves. Same rates, same insurance, same delivery SLA. You deal with us; we do the running around.",
  partners: [
    { name: "GAP Group Leeds", logo_url: "", note: "cross-hire on midi excavators + rollers" },
    { name: "Selwood Pumps", logo_url: "", note: "dewatering + pump specialists" },
    { name: "Bomag NE", logo_url: "", note: "rollers + compaction" },
    { name: "Speedy Hire Leeds Depot", logo_url: "", note: "tool hire cross-supply" },
    { name: "HSS Hire Wakefield", logo_url: "", note: "small tool + generator backup" },
    { name: "A-Plant / Sunbelt Bradford", logo_url: "", note: "specialist attachments" }
  ],
  markup_percent: 0
};

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{sub_hire}', '${JSON.stringify(cfg).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell sub_hire updated:", upd);

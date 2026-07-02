// Patch dimension_diagram_url on mini_excavator + midi_excavator for
// every merchant that has plant hire configured. Runs against both
// Russell Haines and Stuart Kingsley.

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

const DIAGRAMS = {
  mini_excavator:
    "https://ik.imagekit.io/9mrgsv2rp/Untitleddsdas.png",
  midi_excavator:
    "https://ik.imagekit.io/9mrgsv2rp/Untitledsadasdasdsdsdds.png"
};

const targets = await q(`
  SELECT slug FROM hammerex_trade_off_listings
   WHERE addons_enabled ? 'plant_hire'
     AND (addons_enabled->>'plant_hire')::boolean = true;
`);

for (const row of targets) {
  let expr = "plant_hire";
  for (const [cat, url] of Object.entries(DIAGRAMS)) {
    expr = `jsonb_set(${expr}, '{categories,${cat},dimension_diagram_url}', '"${url}"'::jsonb, true)`;
  }
  const upd = await q(`
    UPDATE hammerex_trade_off_listings
       SET plant_hire = ${expr}
     WHERE slug = '${row.slug}'
     RETURNING slug;
  `);
  console.log(`✓ ${upd[0].slug} — mini_excavator + midi_excavator diagrams set`);
}

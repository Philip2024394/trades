// Seed sample "For sale" data on 3 of Russell Haines' machines so the
// buy-now badge + modal button render out of the box on the template.

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

const seeds = {
  mini_excavator: {
    for_sale: true,
    sale_price_pence: 1795000,
    sale_condition: "used",
    sale_year: 2022,
    sale_hours_used: 1450,
    sale_note: "Full service history, 2 new tracks fitted March 2026, quick hitch, 3 buckets included.",
    sale_stock_count: 1
  },
  telehandler: {
    for_sale: true,
    sale_price_pence: 3495000,
    sale_condition: "refurbished",
    sale_year: 2020,
    sale_hours_used: 2800,
    sale_note: "Full workshop refurb April 2026 — new hydraulics, new tyres, LOLER certified.",
    sale_stock_count: 1
  },
  dumper: {
    for_sale: true,
    sale_price_pence: 895000,
    sale_condition: "ex_demo",
    sale_year: 2024,
    sale_hours_used: 180,
    sale_note: "Ex-fleet demo. Cosmetic wear only. Full manufacturer warranty remaining.",
    sale_stock_count: 2
  }
};

let expr = "plant_hire";
for (const [cat, seed] of Object.entries(seeds)) {
  for (const [field, value] of Object.entries(seed)) {
    expr = `jsonb_set(${expr}, '{categories,${cat},${field}}', '${JSON.stringify(value).replace(/'/g, "''")}'::jsonb, true)`;
  }
}

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = ${expr}
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Seeded for-sale data on 3 machines:", upd);

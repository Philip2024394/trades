// Flip cart_enabled = true on every plant_hire category for Stuart's
// row. Optionally seed a sample blocked_ranges array on the first two
// categories so the availability calendar has visible test data.

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

// 1) Fetch current categories to know which slugs exist.
const row = await q(
  `SELECT plant_hire->'categories' AS cats FROM hammerex_trade_off_listings WHERE slug = '${slug}';`
);
const cats = row[0]?.cats ?? {};
const slugs = Object.keys(cats);
console.log(`Found ${slugs.length} categories on Stuart's row.`);

// 2) Build a JSONB patch: flip cart_enabled = true on every category
//    + drop 2 sample blocked ranges onto mini_excavator so the calendar
//    surface has visible test data.
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysFrom = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const sampleBlocks = [
  { from: daysFrom(1), to: daysFrom(5), note: "On hire — Smith Groundworks" },
  { from: daysFrom(14), to: daysFrom(16), note: "Service — Kubota dealer" }
];

let expr = "plant_hire";
for (const s of slugs) {
  expr = `jsonb_set(${expr}, '{categories,${s},cart_enabled}', 'true'::jsonb, true)`;
}
// Seed sample blocked ranges on mini_excavator so the customer surface
// has visible data. Doesn't overwrite anything on other categories.
expr = `jsonb_set(${expr}, '{categories,mini_excavator,blocked_ranges}', '${JSON.stringify(
  sampleBlocks
).replace(/'/g, "''")}'::jsonb, true)`;

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = ${expr}
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Flipped cart_enabled=true on all + seeded mini_excavator blocked ranges:", upd);

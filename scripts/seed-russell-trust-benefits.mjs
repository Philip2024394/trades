// Rewrite Russell's trust_benefits to the new {label, url} format with
// proper deep links into the new pages (careers, trade-accounts,
// haulage compliance, breakdown, delivery zones).

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

const benefits = [
  { label: "CPA Terms & Conditions", url: `/${slug}/plant-hire/haulage` },
  { label: "Hired-In Insured", url: `/${slug}/plant-hire/haulage` },
  { label: "CPCS-carded Operators", url: `/${slug}/plant-hire/careers` },
  { label: "HSE-audited fleet", url: `/${slug}/plant-hire/haulage` },
  { label: "Same-day local delivery", url: `/${slug}/plant-hire/delivery-zones` },
  { label: "24/7 breakdown line", url: `/${slug}/plant-hire/breakdown` },
  { label: "Weekend hire available", url: `/${slug}/plant-hire` },
  { label: "Trade accounts welcome", url: `/${slug}/plant-hire/trade-accounts` }
];

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{trust_benefits}', '${JSON.stringify(benefits).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Russell trust_benefits seeded with URLs:", upd);

// Set Stuart's recommendations array to the 5 non-Stuart lead case
// studies — drywaller / plasterer / electrician / tool hire / kitchen
// manufacturer. Each with a short merchant-voice note.

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const SLUG = "demo-stuart-kingsley-building-merchant-hull";

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

const RECS = [
  {
    slug: "demo-marcus-okafor-drywaller-manchester",
    note: "Drywaller who shows up with the right material list every time. Worth knowing if you're boarding out a loft or commercial fit."
  },
  {
    slug: "demo-emma-whitfield-plasterer-leeds",
    note: "Master plasterer — re-skims, lime work, the lot. Knows her materials and her finish."
  },
  {
    slug: "demo-jamie-mclean-electrician-edinburgh",
    note: "NICEIC sparkie I'd trust on my own house. EICRs done properly, no upsell."
  },
  {
    slug: "demo-rebecca-fawcett-tool-hire-derby",
    note: "Honest tool hire — recommends the right kit for the job, not the most expensive."
  },
  {
    slug: "demo-charlotte-pemberton-kitchen-manufacturer-bath",
    note: "Bespoke kitchen-maker. Hand-painted Mylands finishes, dovetailed drawers, top-end work."
  }
];

const json = JSON.stringify(RECS);

await q(`
  UPDATE hammerex_trade_off_listings
     SET recommendations = ${"$$" + json + "$$"}::jsonb,
         updated_at = now()
   WHERE slug = '${SLUG}';
`);

const after = await q(`
  SELECT jsonb_array_length(recommendations) AS count
    FROM hammerex_trade_off_listings WHERE slug = '${SLUG}';
`);
console.log(`Stuart now has ${after[0].count} trusted trades.`);

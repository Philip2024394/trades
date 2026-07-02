// Enable Russell's breakdown service with realistic UK-market rates.

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
  own_machine_supported: true,
  third_party_supported: true,
  callout_fee_pence: 12500,
  hourly_rate_pence: 8500,
  minimum_callout_hours: 1,
  parts_markup_percent: 15,
  payment_options: {
    card_before_dispatch: true,
    card_after_fix: true,
    cash_on_fix: true,
    trade_account: true
  },
  terms_of_service:
    "By submitting this report you accept the following: (1) our technician will attend as soon as reasonably practicable within the SLA shown; (2) chargeable work is billed at the hourly rate + minimum callout shown above, plus parts at cost + agreed markup; (3) our hire customers within warranty pay nothing subject to fair-use terms; (4) payment method selected below is binding; (5) attendance may be delayed by traffic or weather; (6) if the fault is operator misuse (out of fuel, ignored warning lights) full labour and parts are chargeable regardless of hire status.",
  sla_local_hours: 4,
  sla_national_hours: 24
};

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{breakdown_service}', '${JSON.stringify(cfg).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell breakdown_service seeded:", upd);

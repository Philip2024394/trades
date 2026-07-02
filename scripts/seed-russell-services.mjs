// Replace Russell Haines' priced_services with the 3 services the
// merchant asked for. Also renames the primary_trade-adjacent copy.

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

const services = [
  {
    name: "Truck rental",
    unit: "per day",
    price: 180,
    image_url: null,
    description:
      "Flatbed and tipper trucks for site material moves. 7.5T or 18T available. Driver optional — Class C1 or C licence to self-drive."
  },
  {
    name: "Excavator bucket sales",
    unit: "each",
    price: 450,
    image_url: null,
    description:
      "New and refurbished buckets for 1T–13T excavators. Ditching, grading, riddle and rock buckets in stock. Same-day fitting in the workshop."
  },
  {
    name: "Hydraulic pipe fittings",
    unit: "each",
    price: 12,
    image_url: null,
    description:
      "Hydraulic hose repair + custom fittings while-you-wait. BSP, JIC and ORFS threads stocked. Machine cover if you drop the hose before 2pm."
  }
];

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET priced_services = '${JSON.stringify(services).replace(/'/g, "''")}'::jsonb
   WHERE slug = '${slug}'
   RETURNING id, jsonb_array_length(priced_services) as service_count;
`);
console.log("Services set to 3:", upd);

// Follow-up — recompute bulk_tiers against the actual base price of
// £198 (the row existed already; main script didn't touch price_pence).

import { readFileSync } from "node:fs";

const HAMMER_ENV = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = (HAMMER_ENV.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) ?? [])[1]?.trim();
const projectRef = "msdonkkechxzgagyguoe";
const productId = "8f633cd8-1e8d-4c76-847b-db8f18ed70fb";
const base = 19800; // £198.00

const tiers = [
  { min_qty: 2, max_qty: 3, price_pence: Math.round(base * 0.95) }, // 18810 (£188.10)
  { min_qty: 4, max_qty: null, price_pence: Math.round(base * 0.93) } // 18414 (£184.14)
];

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

const sql = `
  UPDATE hammerex_xrated_products
     SET bulk_tiers = '${JSON.stringify(tiers).replace(/'/g, "''")}'::jsonb
   WHERE id = '${productId}'
  RETURNING id, price_pence, bulk_tiers;
`;
const res = await query(sql);
console.log(JSON.stringify(res[0], null, 2));

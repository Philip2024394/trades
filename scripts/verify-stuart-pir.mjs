// Final verification — query the row and dump key fields.

import { readFileSync } from "node:fs";

const HAMMER_ENV = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = (HAMMER_ENV.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) ?? [])[1]?.trim();
const projectRef = "msdonkkechxzgagyguoe";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

const rows = await query(`
  SELECT id, name, status, price_pence, cover_url, gallery_urls, bulk_tiers,
         LENGTH(description) AS description_len,
         SUBSTRING(description FROM 1 FOR 80) AS description_head
    FROM hammerex_xrated_products
   WHERE id = '8f633cd8-1e8d-4c76-847b-db8f18ed70fb';
`);
console.log(JSON.stringify(rows[0], null, 2));

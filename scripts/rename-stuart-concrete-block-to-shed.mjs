// Rename Stuart's "Concrete Block 100mm" product (linked from pick
// sort_order 0) to "Timber Garden Shed - Treated 8' x 6'". The pick's
// product_id is unchanged — just the product itself gets renamed +
// reslugged so the PDP URL stays valid.

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

const NEW_NAME = "Timber Garden Shed - Treated 8' x 6'";
const NEW_SLUG = "timber-garden-shed-treated-8x6";

// Find the product currently attached to pick sort_order 0.
const productId = (await q(`
  SELECT p.id AS product_id
    FROM hammerex_xrated_trade_center_picks tcp
    JOIN hammerex_xrated_products p ON p.id = tcp.product_id
   WHERE tcp.listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
     AND tcp.sort_order = 0;
`))[0]?.product_id;

if (!productId) throw new Error("Could not resolve product_id for pick sort_order 0");

await q(`
  UPDATE hammerex_xrated_products
     SET name = ${"$$" + NEW_NAME + "$$"},
         slug = '${NEW_SLUG}',
         updated_at = now()
   WHERE id = '${productId}';
`);

const after = await q(`
  SELECT id, name, slug FROM hammerex_xrated_products WHERE id = '${productId}';
`);
console.log(JSON.stringify(after, null, 2));

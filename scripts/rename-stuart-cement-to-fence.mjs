// Rename Stuart's pick sort_order 1 (Hanson Multicem) product to
// "Garden Timber Fence Panel - 7' x 6'". Same dash-separator pattern
// as the Timber Garden Shed rename so the banner + pick detail auto-
// split the name into main line + subtitle.

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

const NEW_NAME = "Garden Timber Fence Panel - 7' x 6'";
const NEW_SLUG = "garden-timber-fence-panel-7x6";

const productId = (await q(`
  SELECT p.id AS product_id
    FROM hammerex_xrated_trade_center_picks tcp
    JOIN hammerex_xrated_products p ON p.id = tcp.product_id
   WHERE tcp.listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
     AND tcp.sort_order = 1;
`))[0]?.product_id;

if (!productId) throw new Error("Could not resolve product_id for pick sort_order 1");

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

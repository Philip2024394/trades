// Update both the PDP description AND the pick's long_description for
// the Garden Timber Fence Panel (Stuart's pick sort_order 1) so both
// surfaces match the "treated with wood preservative" angle.

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

const PRODUCT_DESC = `Pressure-treated softwood fence panel, 7' wide × 6' tall. Treated with wood preservative for long outdoor life — handles UK weather without yearly re-treatment. Standard waney-edge construction, ideal for boundary fencing, garden screens, or replacing storm-damaged panels.`;

const PICK_LONG_DESC = `Pressure-treated through and through with wood preservative — these panels go up and stay up.

Standard 7' x 6' waney-edge softwood, pre-treated against rot and weather so you can fit and forget. Built for UK boundary fencing, garden screens, and post-storm replacements.

Pallet pricing on this batch only. Collect from the yard or we'll deliver next day across Hull.`;

const pickAndProduct = (await q(`
  SELECT tcp.id AS pick_id, p.id AS product_id
    FROM hammerex_xrated_trade_center_picks tcp
    JOIN hammerex_xrated_products p ON p.id = tcp.product_id
   WHERE tcp.listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
     AND tcp.sort_order = 1;
`))[0];

if (!pickAndProduct) throw new Error("Could not resolve pick + product for sort_order 1");

await q(`
  UPDATE hammerex_xrated_products
     SET description = ${"$$" + PRODUCT_DESC + "$$"},
         updated_at = now()
   WHERE id = '${pickAndProduct.product_id}';
`);

await q(`
  UPDATE hammerex_xrated_trade_center_picks
     SET long_description = ${"$$" + PICK_LONG_DESC + "$$"},
         updated_at = now()
   WHERE id = '${pickAndProduct.pick_id}';
`);

const after = await q(`
  SELECT name, description FROM hammerex_xrated_products WHERE id = '${pickAndProduct.product_id}';
`);
console.log("Product:", JSON.stringify(after, null, 2));

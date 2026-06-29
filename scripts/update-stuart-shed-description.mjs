// Update both PDP description AND pick long_description for the
// Timber Garden Shed (Stuart's pick sort_order 0) to match the
// "treated with wood preservative" angle from the fence panel.

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

const PRODUCT_DESC = `Pressure-treated softwood garden shed, 8' wide × 6' deep. Treated with wood preservative for long outdoor life — handles UK weather without yearly re-treatment. Apex roof, single wide door, factory-glazed window. Ideal for tool storage, bikes, garden equipment, or a small workshop.`;

const PICK_LONG_DESC = `Pressure-treated through and through with wood preservative — this shed goes up and stays up.

Standard 8' x 6' apex-roof construction in tongue-and-groove softwood, pre-treated against rot and weather so you can fit and forget. Single wide door, factory-glazed window, ready for bikes, mowers, or a small workshop bench.

20% off list price while stocks last. Collect from the yard or we'll deliver next day across Hull.`;

const pickAndProduct = (await q(`
  SELECT tcp.id AS pick_id, p.id AS product_id
    FROM hammerex_xrated_trade_center_picks tcp
    JOIN hammerex_xrated_products p ON p.id = tcp.product_id
   WHERE tcp.listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
     AND tcp.sort_order = 0;
`))[0];

if (!pickAndProduct) throw new Error("Could not resolve pick + product for sort_order 0");

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

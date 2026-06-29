import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const BANNER_5 =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2002_08_15%20PM.png";
const STUART_SLUG = "demo-stuart-kingsley-building-merchant-hull";
const PRODUCT_ID = "e13c2f56-85c5-4136-8207-0a3c70b743ce"; // Marshalls Paving Slab

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

const listing = (await q(`
  SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}'
`))[0];

await q(`
  INSERT INTO hammerex_xrated_trade_center_picks
    (listing_id, product_id, status, banner_image_url, note, expires_at, sort_order)
  VALUES
    ('${listing.id}', '${PRODUCT_ID}', 'on_promo',
     '${BANNER_5}',
     'Patio season — pallet quantities while stocks last.',
     now() + interval '21 days', 3)
  ON CONFLICT (listing_id, product_id) DO UPDATE
    SET status = EXCLUDED.status,
        banner_image_url = EXCLUDED.banner_image_url,
        note = EXCLUDED.note,
        expires_at = EXCLUDED.expires_at,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
`);

const after = await q(`
  SELECT sort_order, status, banner_image_url IS NOT NULL AS has_banner
  FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = '${listing.id}' ORDER BY sort_order;
`);
console.log(JSON.stringify(after, null, 2));

// Distribute the two ChatGPT-generated landscape banners across
// Stuart's first two picks (sort_order 0 + 1). Remaining picks fall
// back to the joined product cover_url, so the banner carousel shows
// distinct visuals as it rotates. Idempotent — just overwrites.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const STUART_SLUG = "demo-stuart-kingsley-building-merchant-hull";
const BANNER_1 =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2001_31_04%20PM.png";
const BANNER_2 =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2001_34_13%20PM.png";

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

// Clear all banner_image_url first so the seed becomes fully
// deterministic regardless of prior state.
await q(`
  UPDATE hammerex_xrated_trade_center_picks
  SET banner_image_url = NULL
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}');
`);

await q(`
  UPDATE hammerex_xrated_trade_center_picks
  SET banner_image_url = '${BANNER_1}'
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}')
    AND sort_order = 0;
`);
await q(`
  UPDATE hammerex_xrated_trade_center_picks
  SET banner_image_url = '${BANNER_2}'
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}')
    AND sort_order = 1;
`);

const after = await q(`
  SELECT sort_order, status, banner_image_url IS NOT NULL AS has_banner
  FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}')
  ORDER BY sort_order;
`);
console.log(JSON.stringify(after, null, 2));

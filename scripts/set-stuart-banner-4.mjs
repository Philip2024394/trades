import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const BANNER_4 =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2002_02_20%20PM.png";
const STUART_SLUG = "demo-stuart-kingsley-building-merchant-hull";

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

await q(`
  UPDATE hammerex_xrated_trade_center_picks
  SET banner_image_url = '${BANNER_4}'
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}')
    AND sort_order = 4;
`);

const after = await q(`
  SELECT sort_order, status, banner_image_url IS NOT NULL AS has_banner
  FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}')
  ORDER BY sort_order;
`);
console.log(JSON.stringify(after, null, 2));

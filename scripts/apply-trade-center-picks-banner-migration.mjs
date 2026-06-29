// One-shot: add banner_image_url column to picks table + set the
// agreed banner URL on Stuart's 5 picks. Idempotent.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const BANNER_URL =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2001_31_04%20PM.png";
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

const ddl = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260701130000_xrated_trade_center_picks_banner_image.sql",
  "utf-8"
);
await q(ddl);
console.log("Column added.");

const updated = await q(
  `UPDATE hammerex_xrated_trade_center_picks
   SET banner_image_url = '${BANNER_URL}'
   WHERE listing_id = (
     SELECT id FROM hammerex_trade_off_listings WHERE slug = '${STUART_SLUG}'
   )
   RETURNING id;`
);
console.log(`Updated ${updated.length} picks for Stuart.`);

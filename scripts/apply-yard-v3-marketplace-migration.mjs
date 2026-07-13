// Apply the Yard v3 marketplace commerce migration:
//   20260708150000_yard_v3_marketplace_commerce.sql
//
// Adds price_currency, condition, warranty_status, stock_qty,
// delivery_options, delivery_free_over_pence, and video_urls to
// hammerex_trade_off_yard_posts. Uses ADD COLUMN IF NOT EXISTS so
// re-runs are safe.

import { readFileSync } from "node:fs";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch)
  throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const file = "20260708150000_yard_v3_marketplace_commerce.sql";
const sql = readFileSync(
  `C:\\Users\\Victus\\trades\\supabase\\migrations\\${file}`,
  "utf-8"
);

const r = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  }
);
const txt = await r.text();
console.log(`${file}: ${r.status}`);
console.log(txt);
if (!r.ok) process.exit(1);

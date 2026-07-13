import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const r = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `SELECT column_name, data_type, column_default
              FROM information_schema.columns
              WHERE table_name = 'hammerex_trade_off_yard_posts'
                AND column_name IN (
                  'price_currency','condition','warranty_status',
                  'stock_qty','delivery_options','delivery_free_over_pence',
                  'video_urls')
              ORDER BY column_name;`
    })
  }
);
console.log(await r.text());

import { readFileSync } from "node:fs";
const env = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const r = await fetch(
  "https://api.supabase.com/v1/projects/msdonkkechxzgagyguoe/database/query",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query:
        "select column_name from information_schema.columns where table_schema='public' and table_name='hammerex_trade_off_listings' and (column_name ilike '%phone%' or column_name ilike '%whatsapp%')"
    })
  }
);
console.log(await r.text());

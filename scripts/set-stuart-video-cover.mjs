import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const COVER =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2029,%202026,%2002_11_40%20PM.png";
const SLUG = "demo-stuart-kingsley-building-merchant-hull";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(txt);
  return JSON.parse(txt);
}

await q(`UPDATE hammerex_trade_off_listings SET video_cover_url = '${COVER}' WHERE slug = '${SLUG}'`);
const after = await q(`SELECT video_url, video_cover_url FROM hammerex_trade_off_listings WHERE slug = '${SLUG}'`);
console.log(JSON.stringify(after, null, 2));

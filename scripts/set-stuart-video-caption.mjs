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
  if (!r.ok) throw new Error(txt);
  return JSON.parse(txt);
}

await q(`UPDATE hammerex_trade_off_listings SET video_caption = 'Behind the Scenes' WHERE slug = '${SLUG}'`);
const after = await q(`SELECT video_caption FROM hammerex_trade_off_listings WHERE slug = '${SLUG}'`);
console.log(JSON.stringify(after));

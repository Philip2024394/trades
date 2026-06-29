import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  return JSON.parse(await r.text());
}
const team = await q(`SELECT slug, jsonb_array_length(team_members) AS n, team_members->0->>'avatar_url' AS boss_avatar FROM hammerex_trade_off_listings WHERE slug = 'demo-stuart-kingsley-building-merchant-hull';`);
console.log("Team:", JSON.stringify(team, null, 2));
const picks = await q(`SELECT COUNT(*)::int AS n FROM hammerex_xrated_trade_center_picks WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = 'demo-stuart-kingsley-building-merchant-hull');`);
console.log("Picks:", JSON.stringify(picks));

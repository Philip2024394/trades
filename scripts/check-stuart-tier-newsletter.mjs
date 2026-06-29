// Check Stuart's tier so we know whether the newsletter footer renders
// without flipping the explicit toggle (includedWithPaid logic).
import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  return await r.json();
}

const stuart = await q(`
  SELECT slug, tier, trial_expires_at, status, addons_enabled
  FROM hammerex_trade_off_listings
  WHERE slug='demo-stuart-kingsley-building-merchant-hull'
  LIMIT 1;
`);
console.log(JSON.stringify(stuart, null, 2));

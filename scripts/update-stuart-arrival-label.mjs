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
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

await q(`
  UPDATE hammerex_xrated_trade_center_picks
  SET arrival_window_label = 'Check stock now'
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
    AND arrival_window_label = 'Available immediately';
`);

const after = await q(`
  SELECT sort_order, status, arrival_window_label
  FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
  ORDER BY sort_order;
`);
console.log(JSON.stringify(after, null, 2));

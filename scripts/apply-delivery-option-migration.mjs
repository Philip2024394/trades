// One-shot: add delivery_option column + seed Stuart's 4 delivery=true
// picks to delivery_option='next_day' as a sensible default.

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
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

const ddl = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260701170000_xrated_picks_delivery_option.sql",
  "utf-8"
);
await q(ddl);
console.log("Migration applied: delivery_option column added.");

// Seed Stuart's picks where delivery_available=true → delivery_option='next_day'.
const updated = await q(`
  UPDATE hammerex_xrated_trade_center_picks
     SET delivery_option = 'next_day'
   WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = 'demo-stuart-kingsley-building-merchant-hull')
     AND delivery_available = true
     AND delivery_option IS NULL
   RETURNING id, sort_order;
`);
console.log(`Seeded ${updated.length} of Stuart's picks → next_day:`, updated);

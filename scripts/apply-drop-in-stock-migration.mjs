// Apply the in_stock removal migration to the live Supabase project,
// then delete Stuart's specific in_stock pick (it has no useful meaning
// after the removal — the merchant can re-add the product under a real
// promo status if they want). Idempotent.

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
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260701140000_xrated_trade_center_picks_drop_in_stock.sql",
  "utf-8"
);
await q(ddl);
console.log("Migration applied: in_stock removed from CHECK + existing rows migrated to new_arrival.");

// Also remove Stuart's old in_stock pick (now flipped to new_arrival)
// — he already has a new_arrival pick at sort_order 1, so this would
// be a duplicate status. Delete by sort_order 3 (which was the
// in_stock Tarmac Ballast pick).
const removed = await q(`
  DELETE FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = 'demo-stuart-kingsley-building-merchant-hull')
    AND sort_order = 3
  RETURNING id;
`);
console.log(`Removed ${removed.length} of Stuart's picks (was in_stock).`);

const after = await q(`
  SELECT sort_order, status FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = 'demo-stuart-kingsley-building-merchant-hull')
  ORDER BY sort_order;
`);
console.log("Stuart's remaining picks:", JSON.stringify(after, null, 2));

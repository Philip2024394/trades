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

// Update Stuart's first on_promo pick (sort_order 0 = Concrete Block).
// Note shape: "{headline}\n\n{subline}" — the pick banner shows the
// first line, the detail page shows both as separate paragraphs.
const NEW_NOTE = "20% off list - while stocks last\nwhen it's gone it's gone...";

await q(`
  UPDATE hammerex_xrated_trade_center_picks
  SET note = ${"$$" + NEW_NOTE + "$$"}
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
    AND sort_order = 0;
`);

const after = await q(`
  SELECT sort_order, status, note FROM hammerex_xrated_trade_center_picks
  WHERE listing_id = (SELECT id FROM hammerex_trade_off_listings WHERE slug = '${SLUG}')
    AND sort_order = 0;
`);
console.log(JSON.stringify(after, null, 2));

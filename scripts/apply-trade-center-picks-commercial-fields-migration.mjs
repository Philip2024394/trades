// One-shot: add the six commercial-detail columns to the picks table.
// Idempotent — IF NOT EXISTS on every ADD COLUMN.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing");
const token = tokenMatch[1].trim();
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
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260701150000_xrated_trade_center_picks_commercial_fields.sql",
  "utf-8"
);
const res = await q(ddl);
console.log("Migration applied. Result:", JSON.stringify(res));

// Sanity — list the new columns to confirm.
const cols = await q(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'hammerex_xrated_trade_center_picks'
    AND column_name IN (
      'long_description', 'cta_price_pence', 'cta_price_label',
      'arrival_window_label', 'delivery_available', 'installation_available'
    )
  ORDER BY column_name;
`);
console.log("New columns:\n", JSON.stringify(cols, null, 2));

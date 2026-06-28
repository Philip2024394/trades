// One-shot: apply the app_verified tier migration to the live xrated
// Supabase project. Idempotent — uses DROP CONSTRAINT IF EXISTS, so
// re-runs are safe.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260628090000_xrated_verified_tier.sql",
  "utf-8"
);

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: sql })
});

const txt = await r.text();
if (!r.ok) {
  console.error(`Supabase ${r.status}:`, txt);
  process.exit(1);
}
console.log("Migration applied:", txt);

// Verify the new constraint includes app_verified.
const verifySql = `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'hammerex_trade_off_listings_tier_check';`;
const v = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: verifySql })
});
const vTxt = await v.text();
console.log("Constraint check:", vTxt);

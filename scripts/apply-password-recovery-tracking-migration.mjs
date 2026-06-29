// One-shot: apply the password-recovery queue tracking columns + index
// migration to the live hammerex Supabase project, then verify via
// information_schema. Idempotent (uses ADD COLUMN IF NOT EXISTS and
// CREATE INDEX IF NOT EXISTS).
//
// Usage: node scripts/apply-password-recovery-tracking-migration.mjs

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260628120000_xrated_password_recovery_tracking.sql",
  "utf-8"
);

async function runSql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  const txt = await r.text();
  if (!r.ok) {
    console.error(`Supabase ${r.status}:`, txt);
    process.exit(1);
  }
  return txt;
}

console.log("Applying migration...");
const applied = await runSql(sql);
console.log("Migration response:", applied);

console.log("\nVerifying columns via information_schema...");
const verify = await runSql(`
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'hammerex_trade_off_listings'
    and column_name in ('password_recovery_requested_at', 'password_recovery_sent_at')
  order by column_name;
`);
console.log("Columns present:", verify);

console.log("\nVerifying index via pg_indexes...");
const idx = await runSql(`
  select indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'hammerex_trade_off_listings'
    and indexname = 'idx_password_recovery_pending';
`);
console.log("Index present:", idx);

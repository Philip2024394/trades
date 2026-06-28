// One-shot: apply the password_hash + recovery columns migration to the
// live hammerex Supabase project, then verify the columns exist via
// information_schema. Idempotent (uses ADD COLUMN IF NOT EXISTS).
//
// Usage: node scripts/apply-password-auth-migration.mjs

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260628110000_xrated_password_auth.sql",
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
    and column_name in ('password_hash', 'password_recovery_token', 'password_recovery_expires_at')
  order by column_name;
`);
console.log("Columns present:", verify);

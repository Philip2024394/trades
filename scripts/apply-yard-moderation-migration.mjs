// One-shot: apply the Yard admin moderation + flagging migration to the
// live hammerex Supabase project, then verify via information_schema.
// Idempotent (uses ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
// CREATE TABLE IF NOT EXISTS).
//
// Usage: node scripts/apply-yard-moderation-migration.mjs

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260628130000_xrated_yard_admin_moderation.sql",
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

console.log("Applying Yard moderation migration...");
const applied = await runSql(sql);
console.log("Migration response:", applied);

console.log("\nVerifying new columns on hammerex_trade_off_yard_posts...");
const cols = await runSql(`
  select column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'hammerex_trade_off_yard_posts'
    and column_name in (
      'is_admin_announcement','is_pinned','moderation_status',
      'moderation_reason','moderated_at','flag_count','metadata'
    )
  order by column_name;
`);
console.log("Columns present:", cols);

console.log("\nVerifying flags table exists...");
const tbl = await runSql(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'hammerex_trade_off_yard_flags';
`);
console.log("Table present:", tbl);

console.log("\nVerifying flags table columns...");
const flagCols = await runSql(`
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'hammerex_trade_off_yard_flags'
  order by column_name;
`);
console.log("Flag columns:", flagCols);

console.log("\nVerifying indexes...");
const idx = await runSql(`
  select indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and (
      indexname in ('idx_yard_posts_moderation','idx_yard_posts_pinned','idx_yard_flags_post')
      or tablename = 'hammerex_trade_off_yard_flags'
    )
  order by indexname;
`);
console.log("Indexes present:", idx);

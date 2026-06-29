// One-shot: apply the Xrated Reviews admin-moderation migration to the
// live hammerex Supabase project, then verify via information_schema +
// pg_indexes. Idempotent (uses ADD COLUMN IF NOT EXISTS / CREATE INDEX
// IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
//
// Usage: node scripts/apply-reviews-admin-moderation-migration.mjs

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260628140000_xrated_reviews_admin_moderation.sql",
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

console.log("Applying Reviews admin-moderation migration...");
const applied = await runSql(sql);
console.log("Migration response:", applied);

console.log("\nVerifying new columns on hammerex_xrated_reviews...");
const cols = await runSql(`
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'hammerex_xrated_reviews'
    and column_name in (
      'admin_marked_safe_at','admin_edited_at','admin_action_reason'
    )
  order by column_name;
`);
console.log("Columns present:", cols);

console.log("\nVerifying old status CHECK is gone (so 'flagged'/'spam' are accepted)...");
const constraint = await runSql(`
  select conname
  from pg_constraint
  where conrelid = 'public.hammerex_xrated_reviews'::regclass
    and conname = 'hammerex_xrated_reviews_status_check';
`);
console.log("Status check present?", constraint);

console.log("\nVerifying pending-publish index...");
const idx = await runSql(`
  select indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'idx_reviews_pending_publish';
`);
console.log("Index present:", idx);

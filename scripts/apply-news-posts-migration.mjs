// One-shot: apply the hammerex_xrated_news_posts migration to the live
// Supabase project, then exit. Idempotent — uses IF NOT EXISTS, so
// re-runs are safe.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260629100000_xrated_news_posts.sql",
  "utf-8"
);

const apply = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: sql })
});

const applyTxt = await apply.text();
if (!apply.ok) {
  console.error(`Supabase ${apply.status}:`, applyTxt);
  process.exit(1);
}
console.log("Migration applied:", applyTxt);

// Confirm via information_schema.
const confirmSql = `
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'hammerex_xrated_news_posts'
  ORDER BY ordinal_position;
`;
const confirm = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: confirmSql })
});
const confirmTxt = await confirm.text();
console.log("Confirmation:", confirmTxt);

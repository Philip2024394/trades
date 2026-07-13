// Fix invalid `CREATE POLICY IF NOT EXISTS` — Postgres doesn't support
// that syntax. Rewrite to `DROP POLICY IF EXISTS ... ON <table>;
// CREATE POLICY "name" ON <table> ...` which is safe to re-run.
//
// Reads each affected file, does the rewrite, writes back in place.

import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260705160000_studio_bookings.sql",
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260705170000_business_evidence.sql",
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260705180000_content_manifests.sql",
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260705190000_business_coach.sql"
];

for (const file of files) {
  const src = readFileSync(file, "utf-8");
  // Match the whole CREATE POLICY IF NOT EXISTS ... on <tbl> ... ;
  // (multi-line). Use a callback to build the DROP + CREATE pair per match.
  const rewrite = src.replace(
    /create policy if not exists\s+"([^"]+)"\s+on\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+((?:.|\n)*?);/gi,
    (_full, name, table, body) => {
      return `drop policy if exists "${name}" on ${table};\ncreate policy "${name}"\n  on ${table}\n  ${body.trim()};`;
    }
  );
  if (rewrite === src) {
    console.log(`${file}: no changes`);
    continue;
  }
  writeFileSync(file, rewrite);
  console.log(`${file}: rewritten`);
}

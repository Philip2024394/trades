// Apply the two 2026-07-13 canteen migrations in order:
//   20260713120000_app_canteen_designs.sql
//   20260713130000_app_canteen_snapshots.sql
//
// Designs migration must run first — the snapshots helper takes a
// full state snapshot including the designs table, so the table has
// to exist before the first snapshot can be captured.
//
// Both migrations use IF NOT EXISTS on tables + indexes so re-running
// is safe. Trigger creation uses DROP TRIGGER IF EXISTS first for the
// same reason.

import { readFileSync } from "node:fs";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch)
  throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const files = [
  "20260713120000_app_canteen_designs.sql",
  "20260713130000_app_canteen_snapshots.sql"
];

for (const file of files) {
  const sql = readFileSync(
    `C:\\Users\\Victus\\trades\\supabase\\migrations\\${file}`,
    "utf-8"
  );
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  const txt = await r.text();
  console.log(`\n=== ${file}: ${r.status} ===`);
  console.log(txt);
  if (!r.ok) {
    console.error(`\nMigration ${file} failed. Aborting before subsequent migrations run.`);
    process.exit(1);
  }
}

console.log("\nAll migrations applied.");

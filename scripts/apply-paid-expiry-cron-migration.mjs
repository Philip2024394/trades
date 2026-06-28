// One-shot: install the nightly paid-expiry pg_cron job on the live
// hammerex Supabase project. Idempotent — the migration unschedules any
// previous job with the same name before re-creating it.
//
// Mirrors the apply-team-migration.mjs pattern: reads the management API
// token from C:\Users\Victus\hammer\.env.tools.local, POSTs the SQL to
// the database/query endpoint.

import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260628070000_paid_expiry_cron.sql",
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

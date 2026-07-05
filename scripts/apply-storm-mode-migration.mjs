// Apply Storm-Mode migration to Supabase via the Management API.

import { readFileSync } from "node:fs";

const ENV_PATH = "C:\\Users\\Victus\\hammer\\.env.tools.local";
const MIGRATION_PATH =
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260704200000_storm_mode.sql";
const PROJECT_REF = "msdonkkechxzgagyguoe";

const envText = readFileSync(ENV_PATH, "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();

const sql = readFileSync(MIGRATION_PATH, "utf-8");
const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: sql })
});
console.log(`HTTP ${res.status}`);
console.log(await res.text());
if (!res.ok) process.exit(1);

const verify = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query:
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'studio_brand_storm_mode';"
  })
});
console.log("\nverify — table present:");
console.log(await verify.text());

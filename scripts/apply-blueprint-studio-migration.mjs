// Apply Blueprint Studio migration to Supabase via the Management API.
//
// Reads the token from Hammerex's .env.tools.local (same Supabase project
// as this repo). POSTs the migration SQL to the /database/query endpoint
// so the DDL runs inside the target project.

import { readFileSync } from "node:fs";

const ENV_PATH = "C:\\Users\\Victus\\hammer\\.env.tools.local";
const MIGRATION_PATH =
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260704180000_blueprint_studio.sql";
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
const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body);
if (!res.ok) process.exit(1);

// Verify — count new tables + confirm column addition
const verify = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query: `
      select table_name from information_schema.tables
      where table_schema = 'public'
      and table_name in ('studio_blueprint_installs','studio_brand_outcomes','studio_brand_credentials')
      order by table_name;
    `
  })
});
console.log("\nverify — tables present:");
console.log(await verify.text());

const verifyCol = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query: `
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'studio_layouts' and column_name = 'blueprint_id';
    `
  })
});
console.log("\nverify — studio_layouts.blueprint_id column:");
console.log(await verifyCol.text());

// Run a Supabase migration via the Management API.
// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/run-migration.mjs supabase/migrations/xxx.sql

import { readFileSync } from "node:fs";

const token   = process.env.SUPABASE_ACCESS_TOKEN;
const project = process.env.SUPABASE_PROJECT_REF;
const file    = process.argv[2];

if (!token)   { console.error("SUPABASE_ACCESS_TOKEN not set"); process.exit(1); }
if (!project) { console.error("SUPABASE_PROJECT_REF not set");  process.exit(1); }
if (!file)    { console.error("Usage: node scripts/run-migration.mjs path/to/file.sql"); process.exit(1); }

const sql = readFileSync(file, "utf8");

const url = `https://api.supabase.com/v1/projects/${project}/database/query`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type":  "application/json"
  },
  body: JSON.stringify({ query: sql })
});

const body = await res.text();
console.log(`[${file}] status=${res.status}`);
console.log(body.slice(0, 2000));
process.exit(res.ok ? 0 : 1);

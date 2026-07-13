// Run an arbitrary SQL query against Supabase Management API.
// Usage: node scripts/run-sql.mjs "SELECT 1;"
import { readFileSync, existsSync } from "node:fs";

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    out[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(".env.tools.local");
const sql = process.argv.slice(2).join(" ");
if (!sql) {
  console.error("Usage: node scripts/run-sql.mjs \"<SQL>\"");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: sql })
});
const body = await res.text();
console.log(`status=${res.status}`);
console.log(body);

#!/usr/bin/env node
// Generate a strong DB password locally, ALTER USER postgres via Management API,
// persist NEX_SUPABASE_DB_URL to .env.tools.local, verify pg client can connect.
// Password never printed to stdout/stderr and never logged.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envPath = resolve(repoRoot, ".env.tools.local");
const envText = readFileSync(envPath, "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)?.[1];
if (!TOKEN || !REF) { console.error("Missing NEX_SUPABASE_ACCESS_TOKEN or NEX_SUPABASE_PROJECT_REF"); process.exit(2); }

// 1 · Generate 40-char URL-safe password
// Base64url is URL-safe (no /, +, =), alphanumeric+-_, always safe in Postgres URIs
const pw = randomBytes(30).toString("base64url"); // ~40 chars
process.stderr.write(`  generated new DB password locally (${pw.length} chars, URL-safe)\n`);

// 2 · ALTER USER postgres via Management API SQL
const ENDPOINT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
async function q(sql) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

process.stderr.write(`  posting ALTER USER postgres WITH PASSWORD ... via Management API\n`);
// Escape single quotes in password (base64url has none but be defensive)
const escaped = pw.replace(/'/g, "''");
const alterResult = await q(`ALTER USER postgres WITH PASSWORD '${escaped}'`);
if (alterResult.status !== 200 && alterResult.status !== 201) {
  console.error(`  ALTER USER failed: HTTP ${alterResult.status}`);
  console.error(`  response: ${JSON.stringify(alterResult.body).slice(0, 300)}`);
  process.exit(3);
}
process.stderr.write(`  ALTER USER succeeded (HTTP ${alterResult.status})\n`);

// 3 · Construct URI (Session pooler · IPv4 · advisory-locks-safe)
const URI = `postgresql://postgres.${REF}:${pw}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

// 4 · Persist to .env.tools.local (replace or append)
let newEnv = envText;
if (/^NEX_SUPABASE_DB_URL=/m.test(newEnv)) {
  newEnv = newEnv.replace(/^NEX_SUPABASE_DB_URL=.*$/m, `NEX_SUPABASE_DB_URL=${URI}`);
} else {
  newEnv = newEnv.trimEnd() + `\n\n# NEX Supabase Project B · Session pooler URI (IPv4 · advisory-locks-safe)\n# Password set programmatically by scripts/nex-set-db-password-and-verify.mjs\nNEX_SUPABASE_DB_URL=${URI}\n`;
}
writeFileSync(envPath, newEnv);
process.stderr.write(`  persisted NEX_SUPABASE_DB_URL to ${envPath}\n`);

// 5 · Verify connection using psql (readonly SELECT 1)
process.stderr.write(`  verifying URI via psql SELECT 1 ...\n`);
const psql = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const verify = spawnSync(psql, ["-Atc", "SELECT current_database() || ' as ' || current_user AS ident, now() AS ts", URI], {
  env: { ...process.env },
  encoding: "utf8",
  timeout: 30000,
});
if (verify.status !== 0) {
  console.error(`  psql SELECT 1 FAILED (exit ${verify.status})`);
  console.error(`  stderr: ${verify.stderr}`);
  console.error(`  stdout: ${verify.stdout}`);
  process.exit(4);
}
const line = verify.stdout.trim().split(/\r?\n/)[0];
console.log(`\n  [PASS] psql connection verified: ${line}`);
console.log(`\n  NEX_SUPABASE_DB_URL is now set in .env.tools.local`);
console.log(`  Password: (hidden · known only to .env.tools.local and target Supabase Postgres)`);

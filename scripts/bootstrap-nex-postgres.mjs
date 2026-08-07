#!/usr/bin/env node
// NEX Infrastructure Runtime · local Postgres bootstrap
//
// Applies environment-compatibility DDL from deploy/postgres/bootstrap/
// BEFORE the canonical schema in deploy/postgres/init/. Needed on raw
// Postgres targets (local dev · self-hosted · on-prem) that don't ship
// with Supabase-provided roles like `service_role`.
//
// FLOW
//   npm run nex:bootstrap-postgres     ← this script
//   npm run nex:apply-storage-schema   ← then the canonical schema
//
// SAFE ON SUPABASE (idempotent, IF NOT EXISTS everywhere) but you should
// NOT need to run it there — Supabase provides service_role already.
//
// USAGE
//   NEX_POSTGRES_URL=postgresql://... npm run nex:bootstrap-postgres
//
// EXIT CODES  0 = every file applied cleanly  ·  1 = any file failed

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BOOTSTRAP_DIR = join(process.cwd(), "deploy", "postgres", "bootstrap");

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("[bootstrap] NEX_POSTGRES_URL not set · aborting");
    console.error("   Example: postgresql://postgres@localhost:5433/nex_dev  (PGPASSWORD env for auth)");
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("[bootstrap] `pg` package not installed · run: npm install pg");
    process.exit(1);
  }

  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const pool = new pg.default.Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  const files = readdirSync(BOOTSTRAP_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log("── NEX Postgres Bootstrap ──");
  console.log(`  target        : ${url.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`  ssl           : ${needsSsl ? "yes (auto-detected)" : "no"}`);
  console.log(`  files         : ${files.length}`);
  console.log("");

  let failed = 0;
  for (const file of files) {
    const path = join(BOOTSTRAP_DIR, file);
    const sql = readFileSync(path, "utf8");
    process.stdout.write(`  applying ${file} ... `);
    try {
      await pool.query(sql);
      console.log("ok");
    } catch (err) {
      failed += 1;
      console.log("FAIL");
      console.log(`      ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await pool.end();

  console.log("");
  if (failed === 0) {
    console.log(`PASS · ${files.length}/${files.length} bootstrap files applied · now run: npm run nex:apply-storage-schema`);
    process.exit(0);
  } else {
    console.log(`FAIL · ${failed} of ${files.length} files failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[bootstrap] unexpected error:", err);
  process.exit(1);
});

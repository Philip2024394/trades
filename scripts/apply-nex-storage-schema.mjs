#!/usr/bin/env node
// NEX Infrastructure Runtime · schema apply
//
// Connects to NEX_POSTGRES_URL and applies every deploy/postgres/init/*.sql
// file in alphabetical order. Every file uses IF NOT EXISTS + guarded RLS
// policy creation, so re-running is safe and idempotent.
//
// USAGE
//   NEX_POSTGRES_URL=postgresql://... npm run nex:apply-storage-schema
//
// EXIT CODES  0 = every file applied cleanly  ·  1 = any file failed
//
// SAFE TO RE-RUN. If a table already exists it's skipped; if a policy is
// present it's skipped. No DROP / TRUNCATE / ALTER TABLE anywhere.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const INIT_DIR = join(process.cwd(), "deploy", "postgres", "init");

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    console.error("[apply-schema] NEX_POSTGRES_URL not set · aborting");
    console.error("   Get the Postgres connection string from Supabase Project Settings → Database → Connection string → URI");
    console.error("   Example: postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres");
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("[apply-schema] `pg` package not installed · run: npm install pg");
    process.exit(1);
  }

  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const pool = new pg.default.Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  const files = readdirSync(INIT_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log("── NEX Storage Schema Apply ──");
  console.log(`  target        : ${url.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`  ssl           : ${needsSsl ? "yes (auto-detected)" : "no"}`);
  console.log(`  files         : ${files.length}`);
  console.log("");

  let failed = 0;
  for (const file of files) {
    const path = join(INIT_DIR, file);
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
    console.log(`PASS · ${files.length}/${files.length} files applied`);
    process.exit(0);
  } else {
    console.log(`FAIL · ${failed} of ${files.length} files failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[apply-schema] unexpected error:", err);
  process.exit(1);
});

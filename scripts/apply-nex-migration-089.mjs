// scripts/apply-nex-migration-089.mjs
// Bridge 56g · applies 089_themes_trial.sql to the NEX prod database.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    "nex-supabase",
    "migrations",
    "089_themes_trial.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 089_themes_trial.sql …");
  await pg.query(sql);
  const verify = await pg.query(
    `SELECT column_name, data_type, is_generated
       FROM information_schema.columns
      WHERE table_name = 'nex_account'
        AND column_name IN (
          'themes_trial_used_at',
          'themes_trial_package_id'
        )
      ORDER BY column_name`,
  );
  console.log(`  Columns present · ${verify.rows.length}/2`);
  for (const r of verify.rows) {
    console.log(`    · ${r.column_name} (${r.data_type})`);
  }
  if (verify.rows.length !== 2) {
    console.log("  WARNING · expected 2 columns, got " + verify.rows.length);
    process.exitCode = 1;
  } else {
    console.log("Done · migration 089 applied.");
  }
} finally {
  await pg.end();
}

// scripts/apply-nex-migration-090.mjs
// Bridge 57 · applies 090_nex_subscription_plan.sql to the NEX prod DB.

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
    "090_nex_subscription_plan.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 090_nex_subscription_plan.sql …");
  await pg.query(sql);
  const col = await pg.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'nex_account' AND column_name = 'subscription_plan'`,
  );
  const chk = await pg.query(
    `SELECT conname FROM pg_constraint
      WHERE conrelid = 'nex_account'::regclass
        AND conname = 'nex_account_subscription_plan_known'`,
  );
  console.log(`  column present   · ${col.rows.length}`);
  console.log(`  check constraint · ${chk.rows.length}`);
  if (col.rows.length !== 1 || chk.rows.length !== 1) {
    console.log("  WARNING · expected 1/1, got " + col.rows.length + "/" + chk.rows.length);
    process.exitCode = 1;
  } else {
    console.log("Done · migration 090 applied.");
  }
} finally {
  await pg.end();
}

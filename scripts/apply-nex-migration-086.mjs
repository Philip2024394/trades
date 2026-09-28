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
    "086_nex_account_profile_daily_activity.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 086_nex_account_profile_daily_activity.sql …");
  await pg.query(sql);
  const cols = await pg.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'nex_account_profile'
        AND column_name IN ('daily_activity','daily_activity_detail','avatar_face_verified')
      ORDER BY column_name`,
  );
  console.log("  columns present:");
  cols.rows.forEach((r) => console.log(`    ${r.column_name.padEnd(24)} ${r.data_type}`));
  console.log("Done · migration 086 applied.");
} finally {
  await pg.end();
}

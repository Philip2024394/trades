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
    "083_nex_business_verified.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 083_nex_business_verified.sql …");
  await pg.query(sql);
  const verify = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nex_business'
        AND column_name IN ('verified_at','verified_note')
      ORDER BY column_name`,
  );
  console.log("  columns present:", verify.rows.map((r) => r.column_name).join(", "));
  const idx = await pg.query(
    `SELECT indexname FROM pg_indexes
      WHERE tablename = 'nex_business'
        AND indexname = 'idx_nex_business_verified_at'`,
  );
  console.log("  index present:", idx.rows.length > 0 ? "yes" : "no");
  console.log("Done · migration 083 applied.");
} finally {
  await pg.end();
}

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
    "082_nex_business_location_latlng.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 082_nex_business_location_latlng.sql …");
  await pg.query(sql);
  console.log("Applied.");
  const cols = await pg.query(
    `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'nex_business'
         AND column_name IN ('location_lat','location_lng')
       ORDER BY column_name`,
  );
  console.log("cols:", cols.rows.map((r) => r.column_name).join(", "));
} finally {
  await pg.end();
}

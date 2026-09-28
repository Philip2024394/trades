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
  path.join(process.cwd(), "nex-supabase", "migrations", "088_nex_product_share_grant.sql"),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 088_nex_product_share_grant.sql …");
  await pg.query(sql);
  const cols = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nex_product_share_grant' ORDER BY column_name`,
  );
  console.log(`  nex_product_share_grant · ${cols.rows.length} columns:`);
  cols.rows.forEach((r) => console.log(`    ${r.column_name}`));
  const ck = await pg.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'nex_peer_message_attachment_type_check'`,
  );
  if (ck.rows[0]) {
    console.log(`  attachment_type CHECK: ${ck.rows[0].def}`);
  }
  console.log("Done · migration 088 applied.");
} finally {
  await pg.end();
}

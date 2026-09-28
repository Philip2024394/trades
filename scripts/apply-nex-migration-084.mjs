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
    "084_nex_official_account.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 084_nex_official_account.sql …");
  await pg.query(sql);
  const verify = await pg.query(
    `SELECT id, nex_handle, display_name, chat_theme
       FROM nex_account
      WHERE id = '00000000-0000-0000-0000-000000000001'`,
  );
  if (verify.rows.length === 1) {
    const r = verify.rows[0];
    console.log(`  NEX account present · handle ${r.nex_handle} · name "${r.display_name}" · theme ${r.chat_theme}`);
  } else {
    console.log("  WARNING · NEX account row not found after apply");
  }
  console.log("Done · migration 084 applied.");
} finally {
  await pg.end();
}

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
    "085_nex_chat_theme_layout_style.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 085_nex_chat_theme_layout_style.sql …");
  await pg.query(sql);
  const rows = await pg.query(
    `SELECT id, layout_style FROM nex_chat_theme ORDER BY id`,
  );
  console.log("  layout_style values:");
  rows.rows.forEach((r) => console.log(`    ${r.id.padEnd(20)} ${r.layout_style}`));
  console.log("Done · migration 085 applied.");
} finally {
  await pg.end();
}

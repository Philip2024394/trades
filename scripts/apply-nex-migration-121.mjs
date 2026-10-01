// Applies migration 121 (Joker noir bubble + composer rims) to NEX Supabase.

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing · check .env.local");
  process.exit(1);
}

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  const file = "121_nex_chat_theme_joker_noir_bubbles.sql";
  console.log(`\nApplying ${file} …`);
  const sql = fs.readFileSync(
    path.join(process.cwd(), "nex-supabase", "migrations", file),
    "utf-8",
  );
  await pg.query(sql);
  console.log(`Applied ${file}.`);

  const row = await pg.query(
    `SELECT id, name, accent_hex, bubble_rim_hex, composer_rim_hex
       FROM nex_chat_theme WHERE id='theme-0'`,
  );
  console.log("\ntheme-0 after update:", row.rows[0]);
} finally {
  await pg.end();
}

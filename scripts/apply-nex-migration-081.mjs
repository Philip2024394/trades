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
    "081_nex_chat_theme_pink_dream.sql",
  ),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 081_nex_chat_theme_pink_dream.sql …");
  await pg.query(sql);
  console.log("Applied.");
  const r = await pg.query(
    `SELECT id, name, accent_hex, bubble_rim_hex, composer_rim_hex, hero_image_url, is_active, sort_order
       FROM nex_chat_theme WHERE id = 'pink-dream'`,
  );
  console.log("row:", r.rows[0]);
} finally {
  await pg.end();
}

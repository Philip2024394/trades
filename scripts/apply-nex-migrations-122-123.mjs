// Applies migrations 122 + 123 to NEX Supabase.
// 122 · nex_product.size_chart_url · Phase 1 Shoppe-grade variants.
// 123 · nex_color_palette · master seed palette (26 colours).

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
  for (const file of [
    "122_nex_product_size_chart.sql",
    "123_nex_color_palette.sql",
  ]) {
    console.log(`\nApplying ${file} …`);
    const sql = fs.readFileSync(
      path.join(process.cwd(), "nex-supabase", "migrations", file),
      "utf-8",
    );
    await pg.query(sql);
    console.log(`Applied ${file}.`);
  }

  const col = await pg.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_name = 'nex_product' AND column_name = 'size_chart_url'`,
  );
  console.log("\nnex_product.size_chart_url:", col.rows);

  const palette = await pg.query(
    `SELECT count(*)::int AS n FROM nex_color_palette WHERE is_active = true`,
  );
  console.log(`nex_color_palette active rows: ${palette.rows[0].n}`);
} finally {
  await pg.end();
}

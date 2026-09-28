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
  path.join(process.cwd(), "nex-supabase", "migrations", "087_nex_product_ladder.sql"),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 087_nex_product_ladder.sql …");
  await pg.query(sql);
  const cols = await pg.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name = 'nex_product_ladder' AND column_name IN ('tiers','max_cap_pct','share_friend_bonus_pct','share_group_bonus_pct','share_expiry_hours','compare_channel'))
         OR (table_name = 'nex_buyer_tier_progress' AND column_name IN ('order_count','last_order_at'))
         OR (table_name = 'nex_business' AND column_name = 'compare_markup_pct')
      ORDER BY table_name, column_name`,
  );
  console.log("  columns present:");
  cols.rows.forEach((r) => console.log(`    ${r.table_name.padEnd(28)} ${r.column_name}`));
  console.log("Done · migration 087 applied.");
} finally {
  await pg.end();
}

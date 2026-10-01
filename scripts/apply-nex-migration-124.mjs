// Applies migration 124 (Affiliate Marketplace foundation) to NEX Supabase.

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
  const file = "124_nex_affiliate_marketplace.sql";
  console.log(`\nApplying ${file} …`);
  const sql = fs.readFileSync(
    path.join(process.cwd(), "nex-supabase", "migrations", file),
    "utf-8",
  );
  await pg.query(sql);
  console.log(`Applied ${file}.`);

  const cols = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nex_business'
        AND column_name IN ('reseller_enabled', 'reseller_enabled_at')
      ORDER BY column_name`,
  );
  console.log(
    `\nnex_business reseller columns: ${cols.rows.map((r) => r.column_name).join(", ")}`,
  );

  const promo = await pg.query(
    `SELECT count(*)::int AS n FROM nex_affiliate_promotion`,
  );
  console.log(`nex_affiliate_promotion rows: ${promo.rows[0].n}`);
} finally {
  await pg.end();
}

// Applies migrations 079 + 080 to the NEX Supabase project.
// Bridge 23a (spice + perks) + Bridge 23b (events + gallery).

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
    "079_nex_menu_item_spice_and_perks.sql",
    "080_nex_business_events_and_gallery.sql",
  ]) {
    console.log(`\nApplying ${file} …`);
    const sql = fs.readFileSync(
      path.join(process.cwd(), "nex-supabase", "migrations", file),
      "utf-8",
    );
    await pg.query(sql);
    console.log(`Applied ${file}.`);
  }

  const spice = await pg.query(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.nex_menu_item'::regclass
        AND conname = 'nex_menu_item_spice_level_check'`,
  );
  console.log(`\nspice_level check: ${spice.rows[0]?.def ?? "MISSING"}`);

  const perks = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nex_menu_item' AND column_name IN ('perks', 'perks_note')
      ORDER BY column_name`,
  );
  console.log(`nex_menu_item new columns: ${perks.rows.map((r) => r.column_name).join(", ")}`);

  const business = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'nex_business' AND column_name IN ('events_profile', 'venue_gallery')
      ORDER BY column_name`,
  );
  console.log(`nex_business new columns: ${business.rows.map((r) => r.column_name).join(", ")}`);

  const hist = await pg.query(
    `SELECT version FROM nex_migration_history WHERE version IN ('079', '080') ORDER BY version`,
  );
  console.log(`history rows: ${hist.rows.map((r) => r.version).join(", ")}`);
} finally {
  await pg.end();
}

// Applies migration 078_nex_cart.sql to the NEX Supabase project
// via the pooler URL in .env.local · Bridge 22c-3.

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

const sql = fs.readFileSync(
  path.join(process.cwd(), "nex-supabase", "migrations", "078_nex_cart.sql"),
  "utf-8",
);

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log("Applying 078_nex_cart.sql …");
  await pg.query(sql);
  console.log("Applied.");

  const table = await pg.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'nex_cart'`,
  );
  console.log(`table nex_cart: ${table.rowCount === 1 ? "present ✓" : "MISSING"}`);

  const policies = await pg.query(
    `SELECT policyname FROM pg_policies WHERE tablename = 'nex_cart' ORDER BY policyname`,
  );
  console.log(`policies (${policies.rowCount}):`);
  for (const row of policies.rows) console.log(`  · ${row.policyname}`);

  const trigger = await pg.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.nex_cart'::regclass AND NOT tgisinternal`,
  );
  console.log(`triggers (${trigger.rowCount}):`);
  for (const row of trigger.rows) console.log(`  · ${row.tgname}`);
} finally {
  await pg.end();
}

// scripts/apply-nex-migration-107.mjs
//
// Category Tabs Migration 107 · nex_product_section + nex_product.section_id.

import fs from "node:fs";
import path from "node:path";
import pkg from "pg";
const { Client } = pkg;

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

const MIGRATION_FILE = "107_nex_product_section.sql";
const EXPECTED = "ijvqdvsvwtwxzcqmoqit";

if (!process.env.DATABASE_URL?.includes(EXPECTED)) {
  console.error(`Refusing · DATABASE_URL not ${EXPECTED}`);
  process.exit(2);
}

const results = [];
function record(check, expected, actual, pass) {
  results.push({ check, expected, actual, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${check}`);
  console.log(`      expected: ${expected}`);
  console.log(`      actual:   ${actual}`);
}

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log(`Applying ${MIGRATION_FILE} …`);
  const sql = fs.readFileSync(
    path.join(process.cwd(), "nex-supabase", "migrations", MIGRATION_FILE),
    "utf-8",
  );
  await pg.query(sql);
  console.log(`  ✓ committed`);

  // Ledger
  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '107'`,
    );
    record("Ledger 107", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  // Table exists
  {
    const q = await pg.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'nex_product_section'`,
    );
    record(
      "Table nex_product_section exists",
      "1 row",
      `${q.rows.length}`,
      q.rows.length === 1,
    );
  }

  // section_id column
  {
    const q = await pg.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'nex_product' AND column_name = 'section_id'`,
    );
    record(
      "nex_product.section_id column exists (uuid)",
      "1 row · data_type=uuid",
      JSON.stringify(q.rows[0] || null),
      q.rows.length === 1 && q.rows[0].data_type === "uuid",
    );
  }

  // FK
  {
    const q = await pg.query(`
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'nex_product'::regclass
         AND contype = 'f'
         AND EXISTS (
           SELECT 1 FROM unnest(conkey) c
            WHERE (SELECT attname FROM pg_attribute
                    WHERE attrelid = conrelid AND attnum = c) = 'section_id'
         )
    `);
    record(
      "FK on nex_product.section_id exists",
      "at least 1 row",
      `${q.rows.length}`,
      q.rows.length >= 1,
    );
  }

  // RLS enabled
  {
    const q = await pg.query(`
      SELECT relrowsecurity FROM pg_class
       WHERE relname = 'nex_product_section' AND relnamespace =
         (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    record(
      "RLS enabled on nex_product_section",
      "true",
      `${q.rows[0]?.relrowsecurity}`,
      q.rows[0]?.relrowsecurity === true,
    );
  }

  // Policies (4 expected: public_read + owner_insert + owner_update + owner_delete)
  {
    const q = await pg.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'nex_product_section' ORDER BY policyname`,
    );
    const names = q.rows.map((r) => r.policyname).sort();
    const expected = [
      "nex_product_section_owner_delete",
      "nex_product_section_owner_insert",
      "nex_product_section_owner_update",
      "nex_product_section_public_read",
    ];
    record(
      "4 RLS policies present",
      JSON.stringify(expected),
      JSON.stringify(names),
      JSON.stringify(names) === JSON.stringify(expected),
    );
  }

  // Round-trip insert + FK + cleanup (use an existing business or synth one)
  {
    // Grab or create a throwaway owner + business for the round-trip
    const owner = await pg.query(
      `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
      [`_m107_owner_${Math.random().toString(36).slice(2, 8)}`],
    );
    const ownerId = owner.rows[0].id;
    const slug = `m107biz${Math.random().toString(36).slice(2, 10)}`;
    const biz = await pg.query(
      `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
         VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id`,
      [ownerId, "M107 Roundtrip", slug],
    );
    const bizId = biz.rows[0].id;

    const sec = await pg.query(
      `INSERT INTO nex_product_section (business_id, name, sort_order) VALUES ($1,'Electronic',0) RETURNING id`,
      [bizId],
    );
    const secId = sec.rows[0].id;

    const prod = await pg.query(
      `INSERT INTO nex_product (business_id, name, price_pence, currency, section_id)
        VALUES ($1,'M107 sample',10000,'IDR',$2) RETURNING id, section_id`,
      [bizId, secId],
    );
    record(
      "Round-trip · section_id piped through nex_product insert",
      `section_id === ${secId}`,
      `section_id=${prod.rows[0].section_id}`,
      prod.rows[0].section_id === secId,
    );

    // Delete section → product.section_id should go NULL (ON DELETE SET NULL)
    await pg.query(`DELETE FROM nex_product_section WHERE id = $1`, [secId]);
    const orphan = await pg.query(
      `SELECT section_id FROM nex_product WHERE id = $1`,
      [prod.rows[0].id],
    );
    record(
      "ON DELETE SET NULL · deleting section nulls product.section_id",
      "null",
      `${orphan.rows[0].section_id}`,
      orphan.rows[0].section_id === null,
    );

    // Cleanup
    await pg.query(`DELETE FROM nex_product WHERE id = $1`, [prod.rows[0].id]);
    await pg.query(`DELETE FROM nex_business WHERE id = $1`, [bizId]);
    await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 107 applied and verified.");
} finally {
  await pg.end();
}

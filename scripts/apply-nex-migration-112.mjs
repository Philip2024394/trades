// scripts/apply-nex-migration-112.mjs
//
// Applies Migration 112 · nex_service · Bridge Services-A.
// Idempotent · re-running is safe (CREATE TABLE IF NOT EXISTS).

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

const MIGRATION_FILE = "112_nex_service.sql";
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

  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '112'`,
    );
    record("Ledger 112", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  {
    const q = await pg.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'nex_service'
        ORDER BY ordinal_position`,
    );
    const expected = [
      "id",
      "business_id",
      "name",
      "description",
      "from_price",
      "sort_order",
      "created_at",
      "updated_at",
    ];
    const actual = q.rows.map((r) => r.column_name);
    record(
      "Table columns present",
      expected.join(","),
      actual.join(","),
      expected.every((c) => actual.includes(c)),
    );
  }

  {
    const q = await pg.query(
      `SELECT policyname FROM pg_policies
        WHERE tablename = 'nex_service'
        ORDER BY policyname`,
    );
    const names = q.rows.map((r) => r.policyname);
    record(
      "RLS policies present",
      "nex_service_deny_client_write, nex_service_public_read",
      names.join(", "),
      names.includes("nex_service_public_read") &&
        names.includes("nex_service_deny_client_write"),
    );
  }

  // Round-trip: create business + insert service + read back + delete.
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m112_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const slug = `m112biz${Math.random().toString(36).slice(2, 10)}`;
  const biz = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id`,
    [ownerId, "M112 Roundtrip", slug],
  );
  const bizId = biz.rows[0].id;

  const ins = await pg.query(
    `INSERT INTO nex_service (business_id, name, description, from_price, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, description, from_price, sort_order`,
    [
      bizId,
      "Private catering",
      "Full menu for events of 8-40 · we bring the kitchen.",
      "from Rp 1.2jt",
      0,
    ],
  );
  record(
    "Insert service · round-trip",
    "name='Private catering' · from_price='from Rp 1.2jt'",
    `name='${ins.rows[0].name}' · from_price='${ins.rows[0].from_price}'`,
    ins.rows[0].name === "Private catering" &&
      ins.rows[0].from_price === "from Rp 1.2jt",
  );

  try {
    await pg.query(
      `INSERT INTO nex_service (business_id, name) VALUES ($1, $2)`,
      [bizId, "x".repeat(81)],
    );
    record(
      "CHECK · name > 80 chars rejected",
      "throws",
      "no error",
      false,
    );
  } catch (e) {
    record(
      "CHECK · name > 80 chars rejected",
      "throws",
      "threw as expected",
      /name_len/.test(e.message) || /check constraint/i.test(e.message),
    );
  }

  await pg.query(`DELETE FROM nex_service WHERE business_id = $1`, [bizId]);
  await pg.query(`DELETE FROM nex_business WHERE id = $1`, [bizId]);
  await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 112 applied and verified.");
} finally {
  await pg.end();
}

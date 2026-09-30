// scripts/apply-nex-migration-115.mjs · Bridge Profession-C

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

const MIGRATION_FILE = "115_nex_business_profession.sql";
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
  console.log("  ✓ committed");

  {
    const q = await pg.query("SELECT version FROM nex_migration_history WHERE version = '115'");
    record("Ledger 115", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }
  {
    const q = await pg.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'nex_business' AND column_name = 'profession_id'`,
    );
    record(
      "Column nex_business.profession_id present",
      "1 row · nullable",
      JSON.stringify(q.rows[0] || null),
      q.rows.length === 1 && q.rows[0].is_nullable === "YES",
    );
  }
  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'nex_business' AND indexname = 'nex_business_profession_idx'`,
    );
    record(
      "Partial index nex_business_profession_idx",
      "1 row",
      `${q.rows.length}`,
      q.rows.length === 1,
    );
  }

  // Round-trip: attach a business to a profession + read it back +
  // verify FK constraint rejects a bad id.
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m115_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const slug = `m115biz${Math.random().toString(36).slice(2, 10)}`;
  const biz = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id, profession_id`,
    [ownerId, "M115 Roundtrip", slug],
  );
  const bizId = biz.rows[0].id;
  record(
    "New business · profession_id NULL by default",
    "null",
    `${biz.rows[0].profession_id}`,
    biz.rows[0].profession_id === null,
  );

  const prof = await pg.query(
    "SELECT id FROM nex_profession WHERE slug = 'trades_plumber'",
  );
  const profId = prof.rows[0].id;
  await pg.query(
    "UPDATE nex_business SET profession_id = $1 WHERE id = $2",
    [profId, bizId],
  );
  const readback = await pg.query(
    "SELECT profession_id FROM nex_business WHERE id = $1",
    [bizId],
  );
  record(
    "Round-trip · profession_id persists",
    profId,
    `${readback.rows[0].profession_id}`,
    readback.rows[0].profession_id === profId,
  );

  try {
    await pg.query(
      "UPDATE nex_business SET profession_id = $1 WHERE id = $2",
      ["00000000-0000-0000-0000-000000000000", bizId],
    );
    record(
      "FK constraint · bad profession_id rejected",
      "throws",
      "no error",
      false,
    );
  } catch (e) {
    record(
      "FK constraint · bad profession_id rejected",
      "throws",
      "threw as expected",
      /foreign key/i.test(e.message) || /violates/i.test(e.message),
    );
  }

  await pg.query("DELETE FROM nex_business WHERE id = $1", [bizId]);
  await pg.query("DELETE FROM nex_account WHERE id = $1", [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 115 applied and verified.");
} finally {
  await pg.end();
}

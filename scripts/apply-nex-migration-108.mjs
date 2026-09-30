// scripts/apply-nex-migration-108.mjs
//
// Migration 108 · nex_business.shipping_scope enum.

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

const MIGRATION_FILE = "108_nex_business_shipping_scope.sql";
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
      `SELECT version FROM nex_migration_history WHERE version = '108'`,
    );
    record("Ledger 108", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  {
    const q = await pg.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'nex_business' AND column_name = 'shipping_scope'`,
    );
    record(
      "Column nex_business.shipping_scope (text)",
      "1 row · data_type=text",
      JSON.stringify(q.rows[0] || null),
      q.rows.length === 1 && q.rows[0].data_type === "text",
    );
  }

  {
    const q = await pg.query(
      `SELECT conname FROM pg_constraint
        WHERE conname = 'nex_business_shipping_scope_check'`,
    );
    record(
      "CHECK constraint nex_business_shipping_scope_check present",
      "1 row",
      `${q.rows.length}`,
      q.rows.length === 1,
    );
  }

  // Round-trip: create biz + set each enum value + assert NULL default
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m108_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const slug = `m108biz${Math.random().toString(36).slice(2, 10)}`;
  const biz = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id, shipping_scope`,
    [ownerId, "M108 Roundtrip", slug],
  );
  record(
    "Default shipping_scope NULL on insert",
    "null",
    `${biz.rows[0].shipping_scope}`,
    biz.rows[0].shipping_scope === null,
  );

  const bizId = biz.rows[0].id;
  const valid = [
    "local_delivery",
    "local_and_export",
    "international_only",
    "pickup_only",
    "dine_in",
    "digital",
  ];
  let allValidAccepted = true;
  for (const v of valid) {
    try {
      await pg.query(
        `UPDATE nex_business SET shipping_scope = $1 WHERE id = $2`,
        [v, bizId],
      );
    } catch {
      allValidAccepted = false;
    }
  }
  record(
    "All 6 enum values accepted",
    "true",
    `${allValidAccepted}`,
    allValidAccepted,
  );

  // Bogus value must be rejected
  let bogusRejected = false;
  try {
    await pg.query(
      `UPDATE nex_business SET shipping_scope = 'teleportation' WHERE id = $1`,
      [bizId],
    );
  } catch {
    bogusRejected = true;
  }
  record(
    "Bogus value rejected by CHECK",
    "true",
    `${bogusRejected}`,
    bogusRejected,
  );

  await pg.query(`DELETE FROM nex_business WHERE id = $1`, [bizId]);
  await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 108 applied and verified.");
} finally {
  await pg.end();
}

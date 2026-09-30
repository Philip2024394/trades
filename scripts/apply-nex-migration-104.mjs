// scripts/apply-nex-migration-104.mjs
//
// Applies Bridge 99 Migration 104 · nex_bridge99_create_first_message
// stored function to the canonical NEX Supabase project.
// Verifies function existence, argument shape, SECURITY DEFINER flag,
// uuid-ossp extension, and live invocation with valid inputs (rolled
// back inside savepoint).

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing · check .env.local");
  process.exit(1);
}

const MIGRATION_FILE = "104_nex_bridge99_first_message_atomic.sql";
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const results = [];
function record(check, expected, actual, pass) {
  results.push({ check, expected, actual, pass });
  const marker = pass ? "✓" : "✗";
  console.log(`  ${marker} ${check}`);
  console.log(`      expected: ${expected}`);
  console.log(`      actual:   ${actual}`);
}

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  if (!process.env.DATABASE_URL.includes(EXPECTED_PROJECT_REF)) {
    console.error(`Refusing to apply · DATABASE_URL not ${EXPECTED_PROJECT_REF}`);
    process.exit(2);
  }
  console.log(`Target project confirmed: ${EXPECTED_PROJECT_REF}`);

  console.log(`\nApplying ${MIGRATION_FILE} …`);
  const sql = fs.readFileSync(
    path.join(process.cwd(), "nex-supabase", "migrations", MIGRATION_FILE),
    "utf-8",
  );
  await pg.query(sql);
  console.log(`  ✓ ${MIGRATION_FILE} committed`);

  console.log("\n─── Verification ───────────────────────────────────────────");

  // 1. Ledger row
  {
    const q = await pg.query(
      `SELECT version, description FROM nex_migration_history WHERE version = '104'`,
    );
    record(
      "Migration ledger has version 104",
      "1 row · description starts with 'Bridge 99 Stage 6'",
      q.rows.length === 1
        ? `1 row · '${(q.rows[0].description || "").slice(0, 80)}…'`
        : `${q.rows.length} rows`,
      q.rows.length === 1 &&
        q.rows[0].description.startsWith("Bridge 99 Stage 6"),
    );
  }

  // 2. Function exists · 9 args · SECURITY DEFINER
  {
    const q = await pg.query(
      `SELECT proname, pronargs, prosecdef
         FROM pg_proc
        WHERE proname = 'nex_bridge99_create_first_message'`,
    );
    const row = q.rows[0];
    record(
      "Stored function exists with 9 args and SECURITY DEFINER",
      "proname=nex_bridge99_create_first_message · pronargs=9 · prosecdef=true",
      row
        ? `proname=${row.proname} · pronargs=${row.pronargs} · prosecdef=${row.prosecdef}`
        : "MISSING",
      !!row && Number(row.pronargs) === 9 && row.prosecdef === true,
    );
  }

  // 3. uuid-ossp extension present
  {
    const q = await pg.query(
      `SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'`,
    );
    record(
      "uuid-ossp extension present (for uuid_generate_v5)",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // 4. Live invocation · savepoint-scoped, rolled back.
  // Uses a real owner account (any existing) + a synthetic ciphertext row.
  await pg.query("BEGIN");
  try {
    await pg.query("SAVEPOINT sp_live_invoke");
    const acc = await pg.query(`SELECT id FROM nex_account LIMIT 1`);
    if (acc.rows.length === 0) {
      record(
        "Live invocation · valid call returns account_id + conversation_id + first_message_id",
        "SKIPPED · no nex_account rows",
        "SKIPPED",
        true,
      );
    } else {
      const ownerId = acc.rows[0].id;
      const sendIntent = randomUUID();
      const groupId = randomUUID(); // message_group_id column is uuid
      const publicKey = "A".repeat(43); // 43-char base64 (32-byte key)
      const ciphertextRows = JSON.stringify([
        {
          recipient_device_id: "test-device-1",
          ciphertext: Buffer.from("test-ciphertext-1").toString("base64"),
          nonce: Buffer.from("test-nonce-24bytes-padding!!").toString("base64"),
        },
        {
          recipient_device_id: "test-device-2",
          ciphertext: Buffer.from("test-ciphertext-2").toString("base64"),
          nonce: Buffer.from("test-nonce-24bytes-padding!!").toString("base64"),
        },
      ]);

      const invoke = await pg.query(
        `SELECT nex_bridge99_create_first_message(
           'New visitor',
           'test-device-abcdef',
           $1,
           $2::uuid,
           NULL,             -- owner_business_id may be null for non-cover tests
           $3::uuid,
           $4,
           $5::jsonb,
           '_test_fp_apply_104'
         ) AS result`,
        [publicKey, ownerId, sendIntent, groupId, ciphertextRows],
      );
      const result = invoke.rows[0].result;
      const okShape =
        result &&
        typeof result === "object" &&
        typeof result.account_id === "string" &&
        typeof result.conversation_id === "string" &&
        typeof result.first_message_id === "string";
      record(
        "Live invocation · returns { account_id, conversation_id, first_message_id }",
        "all three ids present as strings",
        JSON.stringify(result),
        okShape,
      );

      // Verify all 6 mutations landed BEFORE the rollback:
      const provisional = await pg.query(
        `SELECT id FROM nex_account WHERE id = $1::uuid AND claimed_at IS NULL`,
        [result.account_id],
      );
      record(
        "Live invocation · nex_account row inserted (claimed_at NULL)",
        "1 row",
        `${provisional.rows.length}`,
        provisional.rows.length === 1,
      );

      const devKey = await pg.query(
        `SELECT id FROM nex_account_device_key WHERE account_id = $1::uuid`,
        [result.account_id],
      );
      record(
        "Live invocation · nex_account_device_key inserted",
        "1 row",
        `${devKey.rows.length}`,
        devKey.rows.length === 1,
      );

      const conv = await pg.query(
        `SELECT id, origin_cover_business_id FROM nex_peer_conversation WHERE id = $1::uuid`,
        [result.conversation_id],
      );
      record(
        "Live invocation · nex_peer_conversation inserted (origin NULL for non-cover test)",
        "1 row · origin NULL",
        conv.rows.length === 1
          ? `1 row · origin=${conv.rows[0].origin_cover_business_id}`
          : "MISSING",
        conv.rows.length === 1 && conv.rows[0].origin_cover_business_id === null,
      );

      const msgs = await pg.query(
        `SELECT id, send_intent_id, recipient_device_id
           FROM nex_peer_message
          WHERE conversation_id = $1::uuid
          ORDER BY recipient_device_id`,
        [result.conversation_id],
      );
      record(
        "Live invocation · 2 nex_peer_message rows inserted with derived per-recipient send_intent_id",
        "2 rows · distinct send_intent_id values (uuid_v5 derived)",
        `${msgs.rows.length} rows · send_intent_ids=${msgs.rows.map((r) => r.send_intent_id).join(",")}`,
        msgs.rows.length === 2 &&
          msgs.rows[0].send_intent_id !== msgs.rows[1].send_intent_id,
      );

      const risk = await pg.query(
        `SELECT provisional_fingerprint FROM nex_account_risk_signal WHERE account_id = $1::uuid`,
        [result.account_id],
      );
      record(
        "Live invocation · nex_account_risk_signal row inserted with fingerprint",
        "1 row · fp='_test_fp_apply_104'",
        risk.rows.length === 1
          ? `1 row · fp='${risk.rows[0].provisional_fingerprint}'`
          : "MISSING",
        risk.rows.length === 1 &&
          risk.rows[0].provisional_fingerprint === "_test_fp_apply_104",
      );

      const outbox = await pg.query(
        `SELECT id FROM nex_welcome_outbox WHERE account_id = $1::uuid`,
        [result.account_id],
      );
      record(
        "Live invocation · nex_welcome_outbox event inserted",
        "1 row",
        `${outbox.rows.length}`,
        outbox.rows.length === 1,
      );

      // Rollback so no test data survives.
      await pg.query("ROLLBACK TO SAVEPOINT sp_live_invoke");
    }
  } finally {
    await pg.query("ROLLBACK");
  }

  // 5. Live rejection · empty ciphertext_rows must RAISE
  await pg.query("BEGIN");
  try {
    await pg.query("SAVEPOINT sp_empty_ct");
    const acc = await pg.query(`SELECT id FROM nex_account LIMIT 1`);
    if (acc.rows.length > 0) {
      let rejected = false;
      let msg = "";
      try {
        await pg.query(
          `SELECT nex_bridge99_create_first_message(
             'x','device-8chars','${"A".repeat(43)}',$1::uuid,NULL,$2::uuid,'g','[]'::jsonb,'fp'
           )`,
          [acc.rows[0].id, randomUUID()],
        );
        msg = "call unexpectedly succeeded";
      } catch (e) {
        rejected = /non-empty JSON array/i.test(e.message);
        msg = rejected ? "rejected · empty JSON array" : `wrong error: ${e.message}`;
      }
      await pg.query("ROLLBACK TO SAVEPOINT sp_empty_ct");
      record(
        "Live rejection · empty p_ciphertext_rows raises",
        "RAISE EXCEPTION · non-empty JSON array",
        msg,
        rejected,
      );
    }
  } finally {
    await pg.query("ROLLBACK");
  }

  // 6. Migrations 102-103 still intact
  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version IN ('102','103') ORDER BY version`,
    );
    record(
      "Migrations 102 + 103 ledger rows still present",
      "2 rows",
      `${q.rows.length}`,
      q.rows.length === 2,
    );
  }

  console.log("\n─── Summary ────────────────────────────────────────────────");
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) {
    console.log("\nFailing checks:");
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  ✗ ${r.check}`);
    }
    process.exit(1);
  }
  console.log("\n✓ Migration 104 applied and verified.");
} finally {
  await pg.end();
}

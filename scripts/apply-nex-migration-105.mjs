// scripts/apply-nex-migration-105.mjs
//
// Applies Bridge 99 Migration 105 · first-send intent deduplication.
// Verifies the sealed §13 A2 race is closed via three live scenarios:
//   1. Sequential retry with same intent → deduplicated=true, no new account.
//   2. Concurrent race with same intent → exactly one account created.
//   3. Different intents proceed in parallel, no cross-contamination.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client, Pool } = pkg;

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

const MIGRATION_FILE = "105_nex_bridge99_first_send_dedup.sql";
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const results = [];
function record(check, expected, actual, pass) {
  results.push({ check, expected, actual, pass });
  const marker = pass ? "✓" : "✗";
  console.log(`  ${marker} ${check}`);
  console.log(`      expected: ${expected}`);
  console.log(`      actual:   ${actual}`);
}

async function main() {
  if (!process.env.DATABASE_URL.includes(EXPECTED_PROJECT_REF)) {
    console.error(`Refusing to apply · not ${EXPECTED_PROJECT_REF}`);
    process.exit(2);
  }
  console.log(`Target project confirmed: ${EXPECTED_PROJECT_REF}`);

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
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
        `SELECT version FROM nex_migration_history WHERE version = '105'`,
      );
      record(
        "Migration ledger has version 105",
        "1 row",
        `${q.rows.length} row(s)`,
        q.rows.length === 1,
      );
    }

    // 2. Table exists · zero authenticated policies
    {
      const q1 = await pg.query(
        `SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'nex_bridge99_first_send_intent'`,
      );
      record(
        "nex_bridge99_first_send_intent table exists",
        "1 row",
        `${q1.rows.length}`,
        q1.rows.length === 1,
      );
      const q2 = await pg.query(
        `SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'nex_bridge99_first_send_intent'`,
      );
      record(
        "zero authenticated RLS policies on nex_bridge99_first_send_intent",
        "0",
        `${q2.rows[0].n}`,
        q2.rows[0].n === 0,
      );
    }

    // Prepare a shared owner for all test scenarios
    const ownerRow = await pg.query(
      `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
      [`_bridge99_m105_owner_${Math.random().toString(36).slice(2, 8)}`],
    );
    const ownerId = ownerRow.rows[0].id;
    const createdProvIds = [];

    function ciphertextRows() {
      return JSON.stringify([
        {
          recipient_device_id: "test-device-1",
          ciphertext: Buffer.from("ct-1").toString("base64"),
          nonce: Buffer.from("nonce-24bytes-padding-ok").toString("base64"),
        },
      ]);
    }

    async function callAtomic(pgOrClient, sendIntentId) {
      const groupId = randomUUID();
      const publicKey = "A".repeat(43);
      const r = await pgOrClient.query(
        `SELECT nex_bridge99_create_first_message(
           'New visitor',
           $1,
           $2,
           $3::uuid,
           NULL,
           $4::uuid,
           $5,
           $6::jsonb,
           $7
         ) AS result`,
        [
          `dev-${randomUUID().slice(0, 12)}`,
          publicKey,
          ownerId,
          sendIntentId,
          groupId,
          ciphertextRows(),
          `_test_fp_${randomUUID().slice(0, 8)}`,
        ],
      );
      return r.rows[0].result;
    }

    // 3. Sequential same-intent → dedup
    {
      const intentId = randomUUID();
      const first = await callAtomic(pg, intentId);
      createdProvIds.push(first.account_id);
      const second = await callAtomic(pg, intentId);
      record(
        "Sequential same send_intent_id · second call returns cached ids · deduplicated=true",
        "second.account_id === first.account_id AND deduplicated=true",
        `first=${first.account_id} · second=${second.account_id} · dedup=${second.deduplicated}`,
        second.account_id === first.account_id &&
          second.conversation_id === first.conversation_id &&
          second.first_message_id === first.first_message_id &&
          second.deduplicated === true,
      );

      // Verify only ONE nex_account row exists tagged with this intent
      const q = await pg.query(
        `SELECT count(*)::int AS n FROM nex_bridge99_first_send_intent WHERE send_intent_id = $1`,
        [intentId],
      );
      record(
        "Sequential dedup · exactly one intent row in nex_bridge99_first_send_intent",
        "1",
        `${q.rows[0].n}`,
        q.rows[0].n === 1,
      );
    }

    // 4. Concurrent race with same intent → exactly one account created
    {
      const intentId = randomUUID();
      // Fire two truly concurrent calls via separate Pool clients so they
      // do not serialise on a single pg.Client's inherent request queue.
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 4,
      });
      try {
        const [a, b] = await Promise.all([
          (async () => {
            const c = await pool.connect();
            try {
              return await callAtomic(c, intentId);
            } finally {
              c.release();
            }
          })(),
          (async () => {
            const c = await pool.connect();
            try {
              return await callAtomic(c, intentId);
            } finally {
              c.release();
            }
          })(),
        ]);
        createdProvIds.push(a.account_id);
        // b.account_id should equal a.account_id if dedup worked

        const sameAccount = a.account_id === b.account_id;
        const dedupsMatch =
          (a.deduplicated === false && b.deduplicated === true) ||
          (a.deduplicated === true && b.deduplicated === false);
        record(
          "Concurrent same send_intent_id · both calls return the SAME account_id",
          "a.account_id === b.account_id",
          `a=${a.account_id} · b=${b.account_id}`,
          sameAccount,
        );
        record(
          "Concurrent same send_intent_id · exactly ONE call created the account (one deduplicated:true, one deduplicated:false)",
          "one true + one false",
          `a.dedup=${a.deduplicated} · b.dedup=${b.deduplicated}`,
          dedupsMatch,
        );

        // Verify only ONE dedup row
        const q = await pg.query(
          `SELECT count(*)::int AS n FROM nex_bridge99_first_send_intent WHERE send_intent_id = $1`,
          [intentId],
        );
        record(
          "Concurrent race · exactly one dedup row",
          "1",
          `${q.rows[0].n}`,
          q.rows[0].n === 1,
        );
      } finally {
        await pool.end();
      }
    }

    // 5. Different intents proceed in parallel
    {
      const intentA = randomUUID();
      const intentB = randomUUID();
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 4,
      });
      try {
        const [ra, rb] = await Promise.all([
          (async () => {
            const c = await pool.connect();
            try {
              return await callAtomic(c, intentA);
            } finally {
              c.release();
            }
          })(),
          (async () => {
            const c = await pool.connect();
            try {
              return await callAtomic(c, intentB);
            } finally {
              c.release();
            }
          })(),
        ]);
        createdProvIds.push(ra.account_id, rb.account_id);
        record(
          "Different intents · two independent accounts created",
          "ra.account_id !== rb.account_id",
          `ra=${ra.account_id} · rb=${rb.account_id}`,
          ra.account_id !== rb.account_id,
        );
      } finally {
        await pool.end();
      }
    }

    // Cleanup
    await pg.query(`DELETE FROM nex_account WHERE id = ANY($1::uuid[])`, [
      createdProvIds,
    ]);
    await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

    console.log("\n─── Summary ────────────────────────────────────────────────");
    const pass = results.filter((r) => r.pass).length;
    const fail = results.filter((r) => !r.pass).length;
    console.log(`  ${pass} passed · ${fail} failed · ${results.length} total`);
    if (fail > 0) {
      process.exit(1);
    }
    console.log("\n✓ Migration 105 applied and verified.");
  } finally {
    await pg.end();
  }
}

await main();

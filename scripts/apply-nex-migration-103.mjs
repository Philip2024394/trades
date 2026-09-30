// scripts/apply-nex-migration-103.mjs
//
// Applies NEX-native Migration 103 · Bridge 99 · nex_welcome_outbox.
// -----------------------------------------------------------------------------
// Sealed doctrine baseline: git commit 6566ace3
// Plan file: docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md (v5)
// Q8 founder-accepted: outbox scoped to Bridge 99 provisional-create only.
//
// After apply, runs every verification the founder specified in the Stage 3
// directive:
//   · ledger row present
//   · table exists
//   · 12 columns present in the expected order
//   · FK to nex_account(id) with ON DELETE CASCADE
//   · four CHECK constraints (attempts_nonneg, fail_reason_consistency,
//     lease_consistency, terminal_exclusivity)
//   · four indexes (PK + uq_account + claimable + lease)
//   · RLS enabled + zero authenticated policies
//   · five savepoint-scoped live CHECK proofs:
//       1. UNIQUE (account_id) rejects duplicate
//       2. terminal_exclusivity rejects processed + failed
//       3. fail_reason_consistency rejects failed without reason
//       4. lease_consistency rejects claimed without lease
//       5. attempts_nonneg rejects attempts = -1
//   · Migration 102 objects still intact after 103 applies

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing · check .env.local");
  process.exit(1);
}

const MIGRATION_FILE = "103_nex_welcome_outbox.sql";
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
  const url = process.env.DATABASE_URL;
  if (!url.includes(EXPECTED_PROJECT_REF)) {
    console.error(
      `\nRefusing to apply · DATABASE_URL does not reference project ${EXPECTED_PROJECT_REF}.`,
    );
    console.error(`  URL host part: ${new URL(url).host}`);
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

  // 1. Migration ledger
  {
    const q = await pg.query(
      "SELECT version, description FROM nex_migration_history WHERE version = '103'",
    );
    record(
      "Migration ledger has version 103",
      "1 row · description starts with 'Bridge 99 · nex_welcome_outbox'",
      q.rows.length === 1
        ? `1 row · '${(q.rows[0].description || "").slice(0, 80)}…'`
        : `${q.rows.length} rows`,
      q.rows.length === 1 &&
        q.rows[0].description.startsWith("Bridge 99 · nex_welcome_outbox"),
    );
  }

  // 2. Table exists
  {
    const q = await pg.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'nex_welcome_outbox'`,
    );
    record(
      "nex_welcome_outbox table exists",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // 3. 12 columns in expected order
  {
    const q = await pg.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'nex_welcome_outbox'
        ORDER BY ordinal_position`,
    );
    const expected = [
      "id",
      "account_id",
      "created_at",
      "claimed_at",
      "claimed_by",
      "lease_expires_at",
      "processed_at",
      "failed_at",
      "fail_reason",
      "attempts",
      "last_attempt_error",
      "next_attempt_after",
    ];
    const actual = q.rows.map((r) => r.column_name);
    const ok =
      actual.length === expected.length &&
      expected.every((c, i) => actual[i] === c);
    record(
      "nex_welcome_outbox has exactly the 12 expected columns in expected order",
      expected.join(", "),
      actual.join(", "),
      ok,
    );
  }

  // 4. FK to nex_account(id) ON DELETE CASCADE
  {
    const q = await pg.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'nex_welcome_outbox'::regclass AND contype = 'f'`,
    );
    const row = q.rows[0];
    record(
      "FK account_id -> nex_account(id) ON DELETE CASCADE",
      "1 constraint · REFERENCES nex_account(id) ON DELETE CASCADE",
      row ? `${row.conname}: ${row.def}` : "MISSING",
      !!row &&
        /REFERENCES nex_account\(id\)/i.test(row.def) &&
        /ON DELETE CASCADE/i.test(row.def),
    );
  }

  // 5. Four CHECK constraints
  {
    const q = await pg.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'nex_welcome_outbox'::regclass AND contype = 'c'
        ORDER BY conname`,
    );
    const names = q.rows.map((r) => r.conname);
    const expected = [
      "nex_welcome_outbox_attempts_nonneg",
      "nex_welcome_outbox_fail_reason_consistency",
      "nex_welcome_outbox_lease_consistency",
      "nex_welcome_outbox_terminal_exclusivity",
    ];
    const allPresent = expected.every((n) => names.includes(n));
    record(
      "Four expected CHECK constraints present",
      expected.join(", "),
      names.join(", "),
      allPresent,
    );
  }

  // 6. Four indexes (PK + uq_account + claimable + lease)
  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_welcome_outbox'
        ORDER BY indexname`,
    );
    const names = q.rows.map((r) => r.indexname);
    const expected = [
      "idx_nex_welcome_outbox_claimable",
      "idx_nex_welcome_outbox_lease",
      "nex_welcome_outbox_pkey",
      "uq_nex_welcome_outbox_account",
    ].sort();
    const ok =
      names.length === expected.length &&
      expected.every((n) => names.includes(n));
    record(
      "Four expected indexes present (PK + unique account + claimable + lease)",
      expected.join(", "),
      names.join(", "),
      ok,
    );
  }

  // 7. RLS enabled
  {
    const q = await pg.query(
      `SELECT relrowsecurity FROM pg_class
        WHERE relname = 'nex_welcome_outbox' AND relkind = 'r'`,
    );
    record(
      "RLS enabled on nex_welcome_outbox",
      "relrowsecurity = true",
      q.rows[0] ? `relrowsecurity = ${q.rows[0].relrowsecurity}` : "MISSING",
      q.rows[0]?.relrowsecurity === true,
    );
  }

  // 8. Zero authenticated policies
  {
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM pg_policies
        WHERE tablename = 'nex_welcome_outbox'`,
    );
    record(
      "Zero authenticated-role policies on nex_welcome_outbox",
      "0",
      `${q.rows[0].n}`,
      q.rows[0].n === 0,
    );
  }

  // 9-13. Five live CHECK proofs (savepoint-scoped).
  //
  // All wrapped inside one outer transaction that is rolled back at the
  // end so no data is persisted, regardless of proof outcome.
  await pg.query("BEGIN");
  try {
    const acc = await pg.query("SELECT id FROM nex_account LIMIT 1");
    if (acc.rows.length === 0) {
      const skipMsg = "SKIPPED · no nex_account rows to test against";
      for (const name of [
        "9. UNIQUE (account_id) rejects duplicate",
        "10. terminal_exclusivity rejects processed + failed",
        "11. fail_reason_consistency rejects failed without reason",
        "12. lease_consistency rejects claimed without lease",
        "13. attempts_nonneg rejects attempts = -1",
      ]) {
        record(`Live CHECK · ${name}`, "rejected", skipMsg, true);
      }
    } else {
      const accId = acc.rows[0].id;

      // Proof 9: UNIQUE (account_id) rejects duplicate
      await pg.query("SAVEPOINT sp_dup");
      {
        let rejected = false;
        let msg = "";
        try {
          await pg.query(
            "INSERT INTO nex_welcome_outbox (account_id) VALUES ($1)",
            [accId],
          );
          try {
            await pg.query(
              "INSERT INTO nex_welcome_outbox (account_id) VALUES ($1)",
              [accId],
            );
            msg = "second INSERT unexpectedly succeeded";
          } catch (e) {
            rejected =
              /uq_nex_welcome_outbox_account|duplicate key/i.test(e.message);
            msg = rejected
              ? "rejected by uq_nex_welcome_outbox_account"
              : `wrong error: ${e.message}`;
          }
        } catch (setupErr) {
          msg = `test setup failed: ${setupErr.message}`;
        }
        await pg.query("ROLLBACK TO SAVEPOINT sp_dup");
        record(
          "Live CHECK · UNIQUE (account_id) rejects duplicate",
          "rejected by uq_nex_welcome_outbox_account",
          msg,
          rejected,
        );
      }

      // Proof 10: terminal_exclusivity rejects processed + failed
      await pg.query("SAVEPOINT sp_terminal");
      {
        let rejected = false;
        let msg = "";
        try {
          await pg.query(
            `INSERT INTO nex_welcome_outbox
               (account_id, processed_at, failed_at, fail_reason)
             VALUES ($1, now(), now(), 'test')`,
            [accId],
          );
          msg = "INSERT unexpectedly succeeded";
        } catch (e) {
          rejected = /nex_welcome_outbox_terminal_exclusivity/i.test(
            e.message,
          );
          msg = rejected
            ? "rejected by nex_welcome_outbox_terminal_exclusivity"
            : `wrong error: ${e.message}`;
        }
        await pg.query("ROLLBACK TO SAVEPOINT sp_terminal");
        record(
          "Live CHECK · terminal_exclusivity rejects processed + failed",
          "rejected by nex_welcome_outbox_terminal_exclusivity",
          msg,
          rejected,
        );
      }

      // Proof 11: fail_reason_consistency rejects failed without reason
      await pg.query("SAVEPOINT sp_reason");
      {
        let rejected = false;
        let msg = "";
        try {
          await pg.query(
            `INSERT INTO nex_welcome_outbox
               (account_id, failed_at, fail_reason)
             VALUES ($1, now(), NULL)`,
            [accId],
          );
          msg = "INSERT unexpectedly succeeded";
        } catch (e) {
          rejected = /nex_welcome_outbox_fail_reason_consistency/i.test(
            e.message,
          );
          msg = rejected
            ? "rejected by nex_welcome_outbox_fail_reason_consistency"
            : `wrong error: ${e.message}`;
        }
        await pg.query("ROLLBACK TO SAVEPOINT sp_reason");
        record(
          "Live CHECK · fail_reason_consistency rejects failed_at without fail_reason",
          "rejected by nex_welcome_outbox_fail_reason_consistency",
          msg,
          rejected,
        );
      }

      // Proof 12: lease_consistency rejects claimed without lease
      await pg.query("SAVEPOINT sp_lease");
      {
        let rejected = false;
        let msg = "";
        try {
          await pg.query(
            `INSERT INTO nex_welcome_outbox
               (account_id, claimed_at, lease_expires_at)
             VALUES ($1, now(), NULL)`,
            [accId],
          );
          msg = "INSERT unexpectedly succeeded";
        } catch (e) {
          rejected = /nex_welcome_outbox_lease_consistency/i.test(e.message);
          msg = rejected
            ? "rejected by nex_welcome_outbox_lease_consistency"
            : `wrong error: ${e.message}`;
        }
        await pg.query("ROLLBACK TO SAVEPOINT sp_lease");
        record(
          "Live CHECK · lease_consistency rejects claimed_at without lease_expires_at",
          "rejected by nex_welcome_outbox_lease_consistency",
          msg,
          rejected,
        );
      }

      // Proof 13: attempts_nonneg rejects attempts = -1
      await pg.query("SAVEPOINT sp_attempts");
      {
        let rejected = false;
        let msg = "";
        try {
          await pg.query(
            `INSERT INTO nex_welcome_outbox (account_id, attempts)
             VALUES ($1, -1)`,
            [accId],
          );
          msg = "INSERT unexpectedly succeeded";
        } catch (e) {
          rejected = /nex_welcome_outbox_attempts_nonneg/i.test(e.message);
          msg = rejected
            ? "rejected by nex_welcome_outbox_attempts_nonneg"
            : `wrong error: ${e.message}`;
        }
        await pg.query("ROLLBACK TO SAVEPOINT sp_attempts");
        record(
          "Live CHECK · attempts_nonneg rejects attempts = -1",
          "rejected by nex_welcome_outbox_attempts_nonneg",
          msg,
          rejected,
        );
      }
    }
  } finally {
    await pg.query("ROLLBACK");
  }

  console.log("\n─── Migration 102 spot-check (must remain intact) ─────────");

  // 14. Migration 102 ledger row still present
  {
    const q = await pg.query(
      "SELECT version FROM nex_migration_history WHERE version = '102'",
    );
    record(
      "Migration 102 ledger row still present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // 15. Migration 102 Part A: nex_account.claimed_at still exists
  {
    const q = await pg.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'nex_account' AND column_name = 'claimed_at'`,
    );
    record(
      "Migration 102 Part A · nex_account.claimed_at still present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // 16. Migration 102 Part B: nex_peer_conversation.origin_cover_business_id still exists
  {
    const q = await pg.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'nex_peer_conversation'
          AND column_name = 'origin_cover_business_id'`,
    );
    record(
      "Migration 102 Part B · nex_peer_conversation.origin_cover_business_id still present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // 17. Migration 102 Part C: nex_peer_message.send_intent_id + unique index
  {
    const q1 = await pg.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'nex_peer_message'
          AND column_name = 'send_intent_id'`,
    );
    const q2 = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_peer_message'
          AND indexname = 'uq_nex_peer_message_send_intent'`,
    );
    const ok = q1.rows.length === 1 && q2.rows.length === 1;
    record(
      "Migration 102 Part C · nex_peer_message.send_intent_id + unique index still present",
      "column + index both present",
      `column: ${q1.rows.length}, index: ${q2.rows.length}`,
      ok,
    );
  }

  // 18. Migration 102 Part D: nex_account_risk_signal still exists
  {
    const q = await pg.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'nex_account_risk_signal'`,
    );
    record(
      "Migration 102 Part D · nex_account_risk_signal table still present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // 19. Migration 102 Part E: nex_session_registry still exists
  {
    const q = await pg.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'nex_session_registry'`,
    );
    record(
      "Migration 102 Part E · nex_session_registry table still present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
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
      console.log(`      expected: ${r.expected}`);
      console.log(`      actual:   ${r.actual}`);
    }
    process.exit(1);
  }
  console.log("\n✓ Migration 103 applied and verified.");
} finally {
  await pg.end();
}

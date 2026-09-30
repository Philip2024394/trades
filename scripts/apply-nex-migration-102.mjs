// scripts/apply-nex-migration-102.mjs
//
// Applies NEX-native Migration 102 · Bridge 99 · First Conversation Principle.
// -----------------------------------------------------------------------------
// Sealed doctrine baseline: git commit 6566ace3
// Plan file: docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md (v5)
// Founder approvals: §16 doctrine tick 2026-09-30 + migration 102 v2 KEEP 2026-09-30
//
// Applies:
//   Part A · nex_account.claimed_at                            (identity lifecycle)
//   Part B · nex_peer_conversation.origin_cover_business_id    (conversation provenance)
//   Part C · nex_peer_message.send_intent_id + partial unique  (send idempotency)
//   Part D · nex_account_risk_signal (new table)               (risk-service-owned)
//   Part E · nex_session_registry (new table)                  (session revocation)
//
// After apply, runs every verification SELECT the founder specified in the
// Stage 2 directive, prints results with a green/red status marker per
// requirement, and exits non-zero on any failure.

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

const MIGRATION_FILE = "102_bridge99_provisional_state.sql";
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
  // Confirm we are on the canonical NEX Supabase project. DATABASE_URL
  // contains the project ref in the hostname (e.g. db.<ref>.supabase.co
  // or aws-...pooler.supabase.com?options=project%3D<ref>). We check the
  // raw URL string here as a belt-and-braces guard.
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

  // Migration ledger row
  {
    const q = await pg.query(
      "SELECT version, description FROM nex_migration_history WHERE version = '102'",
    );
    record(
      "Migration ledger has version 102",
      "1 row · description starts with 'Bridge 99 · First Conversation Principle'",
      q.rows.length === 1
        ? `1 row · '${(q.rows[0].description || "").slice(0, 80)}…'`
        : `${q.rows.length} rows`,
      q.rows.length === 1 &&
        q.rows[0].description.startsWith("Bridge 99 · First Conversation Principle"),
    );
  }

  // Part A · nex_account.claimed_at
  {
    const q = await pg.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'nex_account' AND column_name = 'claimed_at'`,
    );
    const row = q.rows[0];
    record(
      "Part A · nex_account.claimed_at exists · timestamptz · nullable",
      "claimed_at / timestamp with time zone / YES",
      row ? `${row.column_name} / ${row.data_type} / ${row.is_nullable}` : "MISSING",
      !!row &&
        row.data_type === "timestamp with time zone" &&
        row.is_nullable === "YES",
    );
  }
  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_account' AND indexname = 'idx_nex_account_unclaimed'`,
    );
    record(
      "Part A · idx_nex_account_unclaimed partial index present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // Part B · nex_peer_conversation.origin_cover_business_id + FK
  {
    const q = await pg.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'nex_peer_conversation'
          AND column_name = 'origin_cover_business_id'`,
    );
    const row = q.rows[0];
    record(
      "Part B · nex_peer_conversation.origin_cover_business_id exists · uuid · nullable",
      "origin_cover_business_id / uuid / YES",
      row ? `${row.column_name} / ${row.data_type} / ${row.is_nullable}` : "MISSING",
      !!row && row.data_type === "uuid" && row.is_nullable === "YES",
    );
  }
  {
    const q = await pg.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'nex_peer_conversation'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%origin_cover_business_id%'`,
    );
    const row = q.rows[0];
    record(
      "Part B · FK on origin_cover_business_id -> nex_business(id) ON DELETE SET NULL",
      "1 constraint · REFERENCES nex_business(id) ON DELETE SET NULL",
      row ? `${row.conname}: ${row.def}` : "MISSING",
      !!row &&
        /REFERENCES nex_business\(id\)/i.test(row.def) &&
        /ON DELETE SET NULL/i.test(row.def),
    );
  }
  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_peer_conversation'
          AND indexname = 'idx_nex_peer_conversation_origin_cover'`,
    );
    record(
      "Part B · idx_nex_peer_conversation_origin_cover partial index present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // Part C · nex_peer_message.send_intent_id + partial unique index
  {
    const q = await pg.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'nex_peer_message' AND column_name = 'send_intent_id'`,
    );
    const row = q.rows[0];
    record(
      "Part C · nex_peer_message.send_intent_id exists · uuid · nullable",
      "send_intent_id / uuid / YES",
      row ? `${row.column_name} / ${row.data_type} / ${row.is_nullable}` : "MISSING",
      !!row && row.data_type === "uuid" && row.is_nullable === "YES",
    );
  }
  {
    const q = await pg.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'nex_peer_message'
          AND indexname = 'uq_nex_peer_message_send_intent'`,
    );
    const row = q.rows[0];
    record(
      "Part C · uq_nex_peer_message_send_intent partial UNIQUE on (sender_account_id, send_intent_id)",
      "UNIQUE partial index WHERE send_intent_id IS NOT NULL",
      row ? row.indexdef : "MISSING",
      !!row &&
        /UNIQUE/i.test(row.indexdef) &&
        /sender_account_id, send_intent_id/.test(row.indexdef) &&
        /send_intent_id IS NOT NULL/i.test(row.indexdef),
    );
  }

  // Part D · nex_account_risk_signal table + zero authenticated policies + RLS
  {
    const q = await pg.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'nex_account_risk_signal'`,
    );
    record(
      "Part D · nex_account_risk_signal table exists",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }
  {
    const q = await pg.query(
      `SELECT relrowsecurity FROM pg_class
        WHERE relname = 'nex_account_risk_signal' AND relkind = 'r'`,
    );
    record(
      "Part D · RLS enabled on nex_account_risk_signal",
      "relrowsecurity = true",
      q.rows[0] ? `relrowsecurity = ${q.rows[0].relrowsecurity}` : "MISSING",
      q.rows[0]?.relrowsecurity === true,
    );
  }
  {
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM pg_policies
        WHERE tablename = 'nex_account_risk_signal'`,
    );
    record(
      "Part D · zero authenticated-role policies on nex_account_risk_signal",
      "0",
      `${q.rows[0].n}`,
      q.rows[0].n === 0,
    );
  }
  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_account_risk_signal'
          AND indexname = 'idx_nex_account_risk_signal_fp'`,
    );
    record(
      "Part D · idx_nex_account_risk_signal_fp partial index present",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }

  // Part E · nex_session_registry table + RLS + zero authenticated policies
  {
    const q = await pg.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'nex_session_registry'`,
    );
    record(
      "Part E · nex_session_registry table exists",
      "1 row",
      `${q.rows.length} row(s)`,
      q.rows.length === 1,
    );
  }
  {
    const q = await pg.query(
      `SELECT relrowsecurity FROM pg_class
        WHERE relname = 'nex_session_registry' AND relkind = 'r'`,
    );
    record(
      "Part E · RLS enabled on nex_session_registry",
      "relrowsecurity = true",
      q.rows[0] ? `relrowsecurity = ${q.rows[0].relrowsecurity}` : "MISSING",
      q.rows[0]?.relrowsecurity === true,
    );
  }
  {
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM pg_policies
        WHERE tablename = 'nex_session_registry'`,
    );
    record(
      "Part E · zero authenticated-role policies on nex_session_registry",
      "0",
      `${q.rows[0].n}`,
      q.rows[0].n === 0,
    );
  }
  {
    const q = await pg.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid = 'nex_session_registry'::regclass
          AND contype = 'f'`,
    );
    const row = q.rows[0];
    record(
      "Part E · FK account_id -> nex_account(id) ON DELETE CASCADE",
      "1 constraint · REFERENCES nex_account(id) ON DELETE CASCADE",
      row ? `${row.conname}: ${row.def}` : "MISSING",
      !!row &&
        /REFERENCES nex_account\(id\)/i.test(row.def) &&
        /ON DELETE CASCADE/i.test(row.def),
    );
  }
  {
    const q = await pg.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'nex_session_registry'::regclass
          AND contype = 'c'
        ORDER BY conname`,
    );
    const names = q.rows.map((r) => r.conname).sort();
    const hasRevoked = names.includes("nex_session_registry_revoked_consistency");
    const hasExpiry = names.includes("nex_session_registry_expiry_after_issue");
    record(
      "Part E · both CHECK constraints present (revoked_consistency + expiry_after_issue)",
      "includes nex_session_registry_revoked_consistency AND nex_session_registry_expiry_after_issue",
      names.join(", "),
      hasRevoked && hasExpiry,
    );
  }
  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_session_registry'
        ORDER BY indexname`,
    );
    const names = q.rows.map((r) => r.indexname).sort();
    const expected = [
      "idx_nex_session_registry_account",
      "idx_nex_session_registry_expiry",
      "nex_session_registry_pkey",
    ].sort();
    const forbidden = "idx_nex_session_registry_active_lookup";
    const hasAllExpected = expected.every((n) => names.includes(n));
    const forbiddenAbsent = !names.includes(forbidden);
    record(
      "Part E · exactly the three expected indexes present; redundant active_lookup absent",
      `[${expected.join(", ")}] · NOT [${forbidden}]`,
      names.join(", "),
      hasAllExpected && forbiddenAbsent && names.length === expected.length,
    );
  }

  // Live test of the expires_at > issued_at CHECK by attempting an invalid
  // insert · must be rejected. Wrapped in a savepoint so a rejection does
  // not poison our outer verification transaction (script uses default
  // implicit-transaction mode, but pg.query BEGIN/ROLLBACK gives us the
  // rollback semantics we need).
  {
    await pg.query("BEGIN");
    try {
      await pg.query("SAVEPOINT sp_expiry_check");
      let rejected = false;
      try {
        // Try to insert a session that expires BEFORE it was issued.
        // Requires a real account_id · we won't insert one just for
        // this negative test, so we grab any existing account_id, or
        // skip cleanly if the account table is empty in this env.
        const acc = await pg.query(
          "SELECT id FROM nex_account LIMIT 1",
        );
        if (acc.rows.length === 0) {
          record(
            "Part E · expires_at > issued_at CHECK (live rejection test)",
            "SKIPPED · no nex_account rows to test against",
            "SKIPPED",
            true,
          );
        } else {
          const accId = acc.rows[0].id;
          try {
            await pg.query(
              `INSERT INTO nex_session_registry
                 (account_id, issued_at, expires_at)
               VALUES ($1, now(), now() - interval '1 minute')`,
              [accId],
            );
            rejected = false;
          } catch (e) {
            rejected = /nex_session_registry_expiry_after_issue|check constraint/i.test(
              String(e.message),
            );
          }
          await pg.query("ROLLBACK TO SAVEPOINT sp_expiry_check");
          record(
            "Part E · expires_at > issued_at CHECK rejects invalid row",
            "INSERT rejected by nex_session_registry_expiry_after_issue",
            rejected ? "rejected as expected" : "NOT REJECTED (constraint missing?)",
            rejected,
          );
        }
      } finally {
        await pg.query("ROLLBACK");
      }
    } catch (e) {
      record(
        "Part E · expires_at > issued_at CHECK (live rejection test)",
        "rejected",
        `outer error: ${e.message}`,
        false,
      );
      try { await pg.query("ROLLBACK"); } catch { /* noop */ }
    }
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
  console.log("\n✓ Migration 102 applied and verified.");
} finally {
  await pg.end();
}

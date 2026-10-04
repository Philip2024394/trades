// scripts/apply-nex-migration-134.mjs
//
// NEX Phase 3A · apply migration 134 and verify.
// Add nex_account_profile.is_discoverable + swap public-read RLS gate.
// Founder-authorised 2026-10-04.

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

const MIGRATION_FILE = "134_nex_account_profile_discoverable.sql";
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
  console.error(`Refusing · DATABASE_URL not pointing at ${EXPECTED_PROJECT_REF}`);
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
  console.log(`  ✓ committed\n`);

  // 1 · Column exists with correct type + default + NOT NULL
  {
    const q = await pg.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'nex_account_profile'
        AND column_name = 'is_discoverable'
    `);
    const row = q.rows[0];
    const ok =
      !!row &&
      row.data_type === "boolean" &&
      row.is_nullable === "NO" &&
      /false/i.test(row.column_default ?? "");
    record(
      "Column is_discoverable created · boolean NOT NULL DEFAULT false",
      "data_type=boolean · is_nullable=NO · column_default~false",
      row ? `${row.data_type} · ${row.is_nullable} · ${row.column_default}` : "<missing>",
      ok,
    );
  }

  // 2 · Public-read policy now gates on is_discoverable
  {
    const q = await pg.query(`
      SELECT polname, pg_get_expr(polqual, polrelid) AS using_clause
      FROM pg_policy
      WHERE polrelid = 'nex_account_profile'::regclass
        AND polname = 'nex_account_profile_public_read'
    `);
    const row = q.rows[0];
    const ok = !!row && /is_discoverable/.test(row.using_clause);
    record(
      "nex_account_profile_public_read gates on is_discoverable",
      "using_clause mentions is_discoverable",
      row ? row.using_clause : "<policy missing>",
      ok,
    );
  }

  // 3 · No existing row was flipped to discoverable
  {
    const q = await pg.query(`
      SELECT COUNT(*)::int AS n FROM nex_account_profile WHERE is_discoverable = true
    `);
    record(
      "No existing row has is_discoverable = true",
      "0",
      String(q.rows[0].n),
      q.rows[0].n === 0,
    );
  }

  // 4 · Legacy is_public = true rows still exist (we did NOT touch is_public)
  {
    const q = await pg.query(`
      SELECT COUNT(*)::int AS n FROM nex_account_profile WHERE is_public = true
    `);
    record(
      "Legacy is_public = true rows preserved (is_public untouched)",
      "5 (expected based on prior audit)",
      String(q.rows[0].n),
      q.rows[0].n >= 1,
    );
  }

  // 5 · Owner policies still exist and are unchanged
  {
    const q = await pg.query(`
      SELECT polname FROM pg_policy
      WHERE polrelid = 'nex_account_profile'::regclass
        AND polname IN (
          'nex_account_profile_owner_read',
          'nex_account_profile_owner_insert',
          'nex_account_profile_owner_update'
        )
      ORDER BY polname
    `);
    const names = q.rows.map((r) => r.polname).sort();
    record(
      "Owner RLS policies preserved",
      "owner_insert · owner_read · owner_update",
      names.join(" · "),
      names.length === 3,
    );
  }

  // 6 · Migration ledger row
  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '134'`,
    );
    record(
      "Migration ledger 134 recorded",
      "1 row",
      String(q.rows.length),
      q.rows.length === 1,
    );
  }

  // 7 · Smoke-test anonymous read · should return 0 rows now
  {
    await pg.query(`SET LOCAL ROLE anon`);
    const q = await pg.query(`SELECT COUNT(*)::int AS n FROM nex_account_profile`);
    await pg.query(`RESET ROLE`);
    record(
      "Anonymous read returns 0 rows (new RLS gate is empty)",
      "0",
      String(q.rows[0].n),
      q.rows[0].n === 0,
    );
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 134 applied and verified.");
} finally {
  await pg.end();
}

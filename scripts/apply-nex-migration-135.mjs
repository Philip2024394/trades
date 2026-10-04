// scripts/apply-nex-migration-135.mjs
//
// NEX Phase 4A · apply + verify migration 135.
// Adds nex_chat_theme intro columns + nex_theme_intro_seen tracker.
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

const MIGRATION_FILE = "135_nex_theme_intro.sql";
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

  // 1 · All three intro columns present with correct types + NULL default
  {
    const q = await pg.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'nex_chat_theme'
        AND column_name IN ('intro_video_url','intro_duration_ms','intro_poster_url')
      ORDER BY column_name
    `);
    const names = q.rows.map((r) => r.column_name).sort();
    const allNullable = q.rows.every((r) => r.is_nullable === "YES");
    const noDefaults = q.rows.every((r) => r.column_default === null);
    record(
      "nex_chat_theme · 3 intro columns created · nullable · no default",
      "intro_duration_ms + intro_poster_url + intro_video_url · all nullable · no default",
      `${names.join(" + ")} · allNullable=${allNullable} · noDefaults=${noDefaults}`,
      names.length === 3 && allNullable && noDefaults,
    );
  }

  // 2 · No existing row has an intro set (feature dormant across catalogue)
  {
    const q = await pg.query(
      `SELECT COUNT(*)::int AS n FROM nex_chat_theme WHERE intro_video_url IS NOT NULL`,
    );
    record(
      "No theme row carries an intro_video_url (feature dormant on all 41 themes)",
      "0",
      String(q.rows[0].n),
      q.rows[0].n === 0,
    );
  }

  // 3 · nex_theme_intro_seen table exists with correct PK
  {
    const q = await pg.query(`
      SELECT a.attname AS col
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE c.relname = 'nex_theme_intro_seen' AND i.indisprimary
      ORDER BY a.attname
    `);
    const cols = q.rows.map((r) => r.col).sort();
    record(
      "nex_theme_intro_seen table · composite PK (account_id, theme_id)",
      "account_id + theme_id",
      cols.join(" + "),
      cols.length === 2 && cols.includes("account_id") && cols.includes("theme_id"),
    );
  }

  // 4 · RLS enabled + policies present (owner_read + owner_insert · NO update/delete)
  {
    const q = await pg.query(`
      SELECT polname, polcmd
      FROM pg_policy
      WHERE polrelid = 'nex_theme_intro_seen'::regclass
      ORDER BY polname
    `);
    const names = q.rows.map((r) => r.polname).sort();
    const cmds = q.rows.map((r) => r.polcmd).sort();
    // polcmd: 'r' = SELECT · 'a' = INSERT · 'w' = UPDATE · 'd' = DELETE
    const correctSet =
      names.length === 2 &&
      names.includes("nex_theme_intro_seen_owner_insert") &&
      names.includes("nex_theme_intro_seen_owner_read") &&
      cmds.sort().join("") === "ar";
    record(
      "nex_theme_intro_seen · 2 RLS policies (owner_read + owner_insert) · no UPDATE/DELETE",
      "2 policies · select + insert only",
      `${names.join(" + ")} · cmds=${cmds.join(",")}`,
      correctSet,
    );
  }

  // 5 · Starting state · seen table empty
  {
    const q = await pg.query(
      `SELECT COUNT(*)::int AS n FROM nex_theme_intro_seen`,
    );
    record(
      "nex_theme_intro_seen starts empty",
      "0",
      String(q.rows[0].n),
      q.rows[0].n === 0,
    );
  }

  // 6 · Constraints wired (duration range + URL lengths)
  {
    const q = await pg.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'nex_chat_theme'::regclass
        AND conname LIKE 'nex_chat_theme_intro_%'
      ORDER BY conname
    `);
    const names = q.rows.map((r) => r.conname).sort();
    record(
      "nex_chat_theme · 3 intro CHECK constraints present",
      "duration_ms_range + poster_url_length + video_url_length",
      names.join(" + "),
      names.length === 3,
    );
  }

  // 7 · Migration ledger row
  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '135'`,
    );
    record(
      "Migration ledger · row for 135 recorded",
      "1 row",
      String(q.rows.length),
      q.rows.length === 1,
    );
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 135 applied and verified.");
} finally {
  await pg.end();
}

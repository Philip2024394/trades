// scripts/apply-nex-migration-113.mjs · Bridge Profession-A · nex_vertical

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

const MIGRATION_FILE = "113_nex_vertical.sql";
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
    const q = await pg.query(
      "SELECT version FROM nex_migration_history WHERE version = '113'",
    );
    record("Ledger 113", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }
  {
    const q = await pg.query("SELECT COUNT(*)::int AS n FROM nex_vertical");
    record("25 verticals seeded", "25", `${q.rows[0].n}`, q.rows[0].n === 25);
  }
  {
    const q = await pg.query(
      "SELECT slug, default_terminology->>'catalog_heading' AS heading FROM nex_vertical WHERE slug IN ('food','trades','creator','maker') ORDER BY slug",
    );
    const map = Object.fromEntries(q.rows.map((r) => [r.slug, r.heading]));
    record(
      "Vertical → heading mapping",
      "food=Menu · trades=Services · creator=Content · maker=Collection",
      `food=${map.food} · trades=${map.trades} · creator=${map.creator} · maker=${map.maker}`,
      map.food === "Menu" &&
        map.trades === "Services" &&
        map.creator === "Content" &&
        map.maker === "Collection",
    );
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 113 applied and verified.");
} finally {
  await pg.end();
}

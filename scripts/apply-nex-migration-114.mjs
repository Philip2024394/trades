// scripts/apply-nex-migration-114.mjs · Bridge Profession-B · nex_profession

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

const MIGRATION_FILE = "114_nex_profession.sql";
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
    const q = await pg.query("SELECT version FROM nex_migration_history WHERE version = '114'");
    record("Ledger 114", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }
  {
    const q = await pg.query("SELECT COUNT(*)::int AS n FROM nex_profession");
    record("Professions seeded", "> 100", `${q.rows[0].n}`, q.rows[0].n > 100);
  }
  {
    const q = await pg.query(
      "SELECT slug, default_cover_layout_id FROM nex_profession WHERE slug IN ('food_restaurant','trades_plumber','creative_photographer','maker_jeweller') ORDER BY slug",
    );
    const map = Object.fromEntries(q.rows.map((r) => [r.slug, r.default_cover_layout_id]));
    record(
      "Profession → layout mapping",
      "food_restaurant=cafe · trades_plumber=product · creative_photographer=personal_brand · maker_jeweller=product_round",
      `food_restaurant=${map.food_restaurant} · trades_plumber=${map.trades_plumber} · creative_photographer=${map.creative_photographer} · maker_jeweller=${map.maker_jeweller}`,
      map.food_restaurant === "cafe" &&
        map.trades_plumber === "product" &&
        map.creative_photographer === "personal_brand" &&
        map.maker_jeweller === "product_round",
    );
  }
  {
    const q = await pg.query(
      "SELECT slug, default_terminology->>'catalog_heading' AS h FROM nex_profession WHERE slug='creative_photographer'",
    );
    record(
      "Photographer profession override",
      "catalog_heading=Packages",
      `catalog_heading=${q.rows[0]?.h}`,
      q.rows[0]?.h === "Packages",
    );
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 114 applied and verified.");
} finally {
  await pg.end();
}

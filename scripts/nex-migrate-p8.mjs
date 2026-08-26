// Applier for Discovery Fabric P8 migrations 111 + 112.
// Philip 2026-08-26 · nex-fabric slice · Foundation A (provider registry)
// and Foundation C (cost budget).
//
// Records BEFORE state, applies migrations sequentially, records AFTER state
// (row counts + column list per table), and verifies the sanity DO blocks in
// each migration passed.
//
// Safe to re-run: all migrations use IF NOT EXISTS / ON CONFLICT DO NOTHING.
//
// Usage:
//   node scripts/nex-migrate-p8.mjs

import { readFileSync } from "fs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
});

const MIGRATIONS = [
  {
    file: "deploy/postgres/init/111_nex_provider_registry.sql",
    table: "provider_registry",
    expectedSeedRows: 5,
    seedIdColumn: "provider_id",
  },
  {
    file: "deploy/postgres/init/112_nex_cost_budget.sql",
    table: "cost_budget",
    expectedSeedRows: 4,
    seedIdColumn: "branch",
  },
];

async function tableExists(table) {
  const q = await pool.query(
    `SELECT 1 FROM information_schema.tables
       WHERE table_schema='nex' AND table_name=$1`,
    [table]);
  return q.rowCount > 0;
}

async function tableCount(table) {
  if (!(await tableExists(table))) return null;
  const q = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.${table}`);
  return q.rows[0].n;
}

async function describe(table) {
  const q = await pool.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema='nex' AND table_name=$1
       ORDER BY ordinal_position`, [table]);
  return q.rows;
}

async function listSeedIds(table, idColumn) {
  if (!(await tableExists(table))) return [];
  const q = await pool.query(`SELECT ${idColumn} AS id FROM nex.${table} ORDER BY ${idColumn}`);
  return q.rows.map((r) => r.id);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" NEX Discovery Fabric P8 · Migrations 111 + 112");
  console.log(" Philip 2026-08-26 · Foundation A (provider registry) + C (cost budget)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // BEFORE snapshot
  console.log("── BEFORE ─────────────────────────────────────────────────────");
  const before = {};
  for (const m of MIGRATIONS) {
    const exists = await tableExists(m.table);
    const count = exists ? await tableCount(m.table) : null;
    before[m.table] = { exists, count };
    console.log(
      `  nex.${m.table.padEnd(20)} ${exists ? `exists · rows=${count}` : "MISSING (fresh install)"}`
    );
  }
  console.log();

  // Apply each migration
  let migrationsSucceeded = 0;
  for (const m of MIGRATIONS) {
    console.log(`── APPLYING ${m.file.split("/").pop()} ──`);
    const sql = readFileSync(m.file, "utf8");
    try {
      await pool.query(sql);
      console.log(`  ✓ applied (sanity DO block passed)`);
      migrationsSucceeded += 1;
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      process.exitCode = 1;
      await pool.end();
      return;
    }

    // Verify table now exists
    const exists = await tableExists(m.table);
    console.log(`  ${exists ? "✓" : "✗"} nex.${m.table} present`);
    if (!exists) { process.exitCode = 1; }

    // Verify seed rows landed
    const ids = await listSeedIds(m.table, m.seedIdColumn);
    const seedOk = ids.length >= m.expectedSeedRows;
    console.log(
      `  ${seedOk ? "✓" : "✗"} seed rows ${ids.length}/${m.expectedSeedRows} present [${ids.join(", ")}]`
    );
    if (!seedOk) { process.exitCode = 1; }
    console.log();
  }

  // AFTER snapshot · row counts + column list per table
  console.log("── AFTER · row counts ─────────────────────────────────────────");
  for (const m of MIGRATIONS) {
    const count = await tableCount(m.table);
    console.log(`  nex.${m.table.padEnd(20)} rows=${count}`);
  }
  console.log();

  console.log("── AFTER · schema ────────────────────────────────────────────");
  for (const m of MIGRATIONS) {
    console.log(`\n  nex.${m.table}:`);
    for (const row of await describe(m.table)) {
      console.log(
        `    ${row.column_name.padEnd(24)} ${row.data_type.padEnd(28)} ${row.is_nullable === "NO" ? "NOT NULL" : ""}`
      );
    }
  }

  const allOk = migrationsSucceeded === MIGRATIONS.length && !process.exitCode;
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(allOk
    ? " ✓ P8 migrations applied · provider_registry + cost_budget ready"
    : " ✗ P8 migration failure · investigate before proceeding");
  console.log("═══════════════════════════════════════════════════════════════");
  await pool.end();
  if (!allOk) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

// Applier for persistence-contract migrations 105-108.
// Philip 2026-08-26 production launch directive · Phase 1.
//
// Records BEFORE state, applies migrations sequentially, records AFTER state,
// and PROVES the 8,818 historical rows were not touched (worker_id/cycle_run_id
// remain NULL, row counts unchanged).
//
// Safe to re-run: all migrations use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
//
// Usage:
//   node scripts/nex-migrate-persistence-contract.mjs

import { readFileSync } from "fs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
});

const MIGRATIONS = [
  { file: "deploy/postgres/init/105_nex_walker_attribution_food_business.sql",           table: "food_business",          check: ["worker_id","cycle_run_id"] },
  { file: "deploy/postgres/init/106_nex_walker_attribution_accommodation_business.sql", table: "accommodation_business", check: ["worker_id","cycle_run_id"] },
  { file: "deploy/postgres/init/107_nex_walker_attribution_mp_seller.sql",              table: "mp_seller",              check: ["worker_id","cycle_run_id"] },
  { file: "deploy/postgres/init/108_nex_rotation_reactivation_cooldown.sql",            table: "discovery_rotation_state", check: ["cooldown_until","reactivation_count"] },
];

const AFFECTED_TABLES = ["food_business","accommodation_business","mp_seller"];

async function tableCount(table) {
  const q = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.${table}`);
  return q.rows[0].n;
}

async function columnExists(table, column) {
  const q = await pool.query(
    `SELECT 1 FROM information_schema.columns
       WHERE table_schema='nex' AND table_name=$1 AND column_name=$2`,
    [table, column]);
  return q.rowCount > 0;
}

async function nullAttributionCount(table) {
  const hasWorker = await columnExists(table, "worker_id");
  if (!hasWorker) return null; // column not there yet
  const q = await pool.query(
    `SELECT COUNT(*)::int AS n FROM nex.${table} WHERE worker_id IS NULL AND cycle_run_id IS NULL`);
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

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" NEX Persistence Contract · Migrations 105-108");
  console.log(" Philip 2026-08-26 · production launch directive · Phase P1");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // BEFORE snapshot
  console.log("── BEFORE ─────────────────────────────────────────────────────");
  const before = {};
  for (const t of AFFECTED_TABLES) {
    before[t] = { total: await tableCount(t), nullAttribution: await nullAttributionCount(t) };
    console.log(`  nex.${t.padEnd(24)} total=${String(before[t].total).padStart(6)}  null_attribution=${before[t].nullAttribution === null ? "(no cols yet)" : before[t].nullAttribution}`);
  }
  console.log();

  // Apply each migration
  for (const m of MIGRATIONS) {
    console.log(`── APPLYING ${m.file.split("/").pop()} ──`);
    const sql = readFileSync(m.file, "utf8");
    try {
      await pool.query(sql);
      console.log(`  ✓ applied`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      process.exitCode = 1;
      await pool.end();
      return;
    }
    for (const col of m.check) {
      const ok = await columnExists(m.table, col);
      console.log(`  ${ok ? "✓" : "✗"} column nex.${m.table}.${col} ${ok ? "present" : "MISSING"}`);
      if (!ok) { process.exitCode = 1; }
    }
    console.log();
  }

  // AFTER snapshot + backward-safety proof
  console.log("── AFTER · backward-safety proof ──────────────────────────────");
  let allSafe = true;
  for (const t of AFFECTED_TABLES) {
    const afterTotal = await tableCount(t);
    const afterNull = await nullAttributionCount(t);
    const totalSame = afterTotal === before[t].total;
    const allHistoricalNull = afterNull === before[t].total;
    console.log(`  nex.${t.padEnd(24)} total=${String(afterTotal).padStart(6)} (${totalSame ? "unchanged ✓" : "CHANGED ✗"})  null_attribution=${afterNull} (should be ${before[t].total}: ${allHistoricalNull ? "✓" : "✗"})`);
    if (!totalSame || !allHistoricalNull) allSafe = false;
  }
  console.log();

  // Print column shapes of the affected tables
  console.log("── SCHEMA AFTER ───────────────────────────────────────────────");
  for (const t of [...AFFECTED_TABLES, "discovery_rotation_state"]) {
    console.log(`\n  nex.${t}:`);
    for (const row of await describe(t)) {
      console.log(`    ${row.column_name.padEnd(28)} ${row.data_type.padEnd(28)} ${row.is_nullable === "NO" ? "NOT NULL" : ""}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(allSafe
    ? " ✓ Migrations applied · historical rows preserved · attribution ready"
    : " ✗ SAFETY VIOLATION · investigate before proceeding to P2");
  console.log("═══════════════════════════════════════════════════════════════");
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

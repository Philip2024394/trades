// Standalone applier for migration 109 (P3 · consecutive_unproductive_reactivations).
// Safe to re-run · ADD COLUMN IF NOT EXISTS.

import { readFileSync } from "fs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
});

const beforeQ = await pool.query(
  `SELECT COUNT(*)::int AS n FROM nex.discovery_rotation_state`
);
console.log("BEFORE · discovery_rotation_state rows:", beforeQ.rows[0].n);

const sql = readFileSync("deploy/postgres/init/109_nex_rotation_consecutive_unproductive.sql", "utf8");
await pool.query(sql);
console.log("✓ migration 109 applied");

const colQ = await pool.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='nex' AND table_name='discovery_rotation_state'
       AND column_name IN ('cooldown_until','reactivation_count','consecutive_unproductive_reactivations','reactivation_reason')
     ORDER BY ordinal_position`
);
console.log("\nP3 columns present:");
for (const r of colQ.rows) {
  console.log(`  ${r.column_name.padEnd(42)} ${r.data_type.padEnd(28)} ${r.is_nullable === "NO" ? "NOT NULL" : "NULL"} ${r.column_default ?? ""}`);
}

const afterQ = await pool.query(
  `SELECT COUNT(*)::int AS n,
          COUNT(*) FILTER (WHERE consecutive_unproductive_reactivations = 0)::int AS zero
     FROM nex.discovery_rotation_state`
);
console.log(`\nAFTER · rows=${afterQ.rows[0].n} · consecutive_unproductive_reactivations=0 for ${afterQ.rows[0].zero} of them (should equal row count)`);

await pool.end();

// scripts/nex-forensics-7h-smoke.mjs
// Print schemas of the key forensic tables.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const tables = [
  "nex.worker_cycle_run",
  "nex.worker_heartbeat",
  "nex.worker_health_status",
  "nex.worker_audit_events",
  "nex.food_business",
  "nex.accommodation_business",
];
for (const t of tables) {
  const r = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position
  `, t.split("."));
  console.log(`\n=== ${t} ===`);
  for (const c of r.rows) console.log(`  ${c.column_name} ${c.data_type}`);
}
await pool.end();

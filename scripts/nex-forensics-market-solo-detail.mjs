// scripts/nex-forensics-market-solo-detail.mjs
import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const combos = [
  { wc: "market:solo:nominatim",              label: "Solo · market" },
  { wc: "market:yogyakarta:nominatim",        label: "Yogyakarta · market" },
  { wc: "market:yogyakarta-city:nominatim",   label: "Yogyakarta · market (legacy zoneId)" },
  { wc: "market:central-java-solo:nominatim", label: "Solo · market (legacy zoneId)" },
];

for (const c of combos) {
  const r = await pool.query(
    `SELECT id, status, records_processed, records_new, errors_count, duration_ms,
            summary,
            audit_report_path
       FROM nex.worker_cycle_run
      WHERE worker_config = $1
      ORDER BY started_at DESC LIMIT 1`,
    [c.wc],
  );
  console.log(`\n=== ${c.label} · ${c.wc} ===`);
  if (r.rows.length === 0) { console.log("NO ROWS"); continue; }
  const row = r.rows[0];
  console.log(`status=${row.status}  processed=${row.records_processed}  new=${row.records_new}  errors=${row.errors_count}  duration=${row.duration_ms}ms`);
  console.log(`audit_report_path=${row.audit_report_path}`);
  console.log(`unexpected_error: ${row.summary?.unexpected_error ?? "(none)"}`);
  console.log(`provider_results: ${JSON.stringify(row.summary?.provider_results ?? null)}`);
  console.log(`reconciler_reason: ${row.summary?.reconciler_reason ?? "(none)"}`);
  console.log(`error_samples: ${JSON.stringify(row.summary?.error_samples ?? row.summary?.errors ?? null)}`);
}

console.log("\n=== rotation_state for market · Solo + Yogyakarta ===");
const rs = await pool.query(`
  SELECT city, category, surface, state, state_entered_at, cycles_completed
    FROM nex.discovery_rotation_state
   WHERE category='market' AND city IN ('Solo','Yogyakarta','solo','yogyakarta')`);
console.log(JSON.stringify(rs.rows, null, 2));

await pool.end();

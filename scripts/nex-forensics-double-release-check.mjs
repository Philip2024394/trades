// scripts/nex-forensics-double-release-check.mjs
// Read-only. Verify the double-release bug is gone from Food+Accommodation
// cycles since the fix was applied (~11:17 UTC 2026-08-24), and show the
// latest Food+Accommodation cycle per new city with full detail.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const FIX_APPLIED_AT = "2026-08-24 11:17:00+00";
const NEW_CITIES = ["Jakarta", "Denpasar", "Surabaya", "Bandung", "Semarang"];

const banner = (t) => `\n${"═".repeat(78)}\n  ${t}\n${"═".repeat(78)}`;

console.log(banner(`Double-release + new-city Food/Accom AFTER-fix verification @ ${new Date().toISOString()}`));

// 1) Count of "Release called on client which has already been released" errors
console.log(banner(`§1 · Double-release error count since ${FIX_APPLIED_AT}`));
{
  const [before, after] = await Promise.all([
    pool.query(`
      SELECT count(*) AS n
        FROM nex.worker_cycle_run
       WHERE worker_type='acquisition'
         AND started_at < $1::timestamptz
         AND started_at >= now() - interval '48 hours'
         AND summary->>'unexpected_error' ILIKE '%already been released to the pool%'`,
      [FIX_APPLIED_AT]),
    pool.query(`
      SELECT worker_config, status, started_at, records_processed, records_new,
             summary->>'unexpected_error' AS err
        FROM nex.worker_cycle_run
       WHERE worker_type='acquisition'
         AND started_at >= $1::timestamptz
         AND summary->>'unexpected_error' ILIKE '%already been released to the pool%'
       ORDER BY started_at`,
      [FIX_APPLIED_AT]),
  ]);
  console.log(`Before fix (48h → ${FIX_APPLIED_AT}): ${before.rows[0].n} cycles hit the double-release bug`);
  console.log(`After  fix (${FIX_APPLIED_AT} → now): ${after.rowCount} cycles hit the double-release bug`);
  if (after.rowCount > 0) {
    console.log(`  DETAILS:`);
    for (const r of after.rows) {
      console.log(`    ${r.started_at.toISOString?.() ?? r.started_at}  ${r.worker_config}  ${r.status}  proc=${r.records_processed} new=${r.records_new}  ${r.err}`);
    }
  }
}

// 2) Latest Food + Accommodation cycle per new city (5 cities × 2 categories = 10)
console.log(banner(`§2 · Latest Food+Accommodation cycle per new city`));
{
  const CATS = ["food", "accommodation"];
  const TABLE_FOR = { food: "nex.food_business", accommodation: "nex.accommodation_business" };
  for (const city of NEW_CITIES) {
    for (const cat of CATS) {
      const [latestR, allR, dirR] = await Promise.all([
        pool.query(`
          SELECT id, worker_config, status, started_at, finished_at,
                 records_processed, records_new, errors_count, duration_ms,
                 summary->>'unexpected_error'                    AS unexpected_error,
                 summary->'provider_results'->0->>'provider'     AS primary_provider,
                 summary->'provider_results'                     AS provider_results,
                 summary->'discovery_stats'                      AS discovery_stats,
                 summary->'reconciler_reason'                    AS reconciler_reason
            FROM nex.worker_cycle_run
           WHERE worker_type='acquisition'
             AND split_part(worker_config,':',1)=$1
             AND split_part(worker_config,':',2)=$2
           ORDER BY started_at DESC LIMIT 1`,
          [cat, city]),
        pool.query(`
          SELECT count(*) FILTER (WHERE started_at >= $3::timestamptz) AS after_fix_attempts,
                 count(*) FILTER (WHERE status='completed' AND started_at >= $3::timestamptz) AS after_fix_completed,
                 count(*) FILTER (WHERE status='failed'    AND started_at >= $3::timestamptz) AS after_fix_failed,
                 count(*) FILTER (WHERE status='aborted'   AND started_at >= $3::timestamptz) AS after_fix_aborted,
                 count(*) FILTER (WHERE status='running'   AND started_at >= $3::timestamptz) AS after_fix_running
            FROM nex.worker_cycle_run
           WHERE worker_type='acquisition'
             AND split_part(worker_config,':',1)=$1
             AND split_part(worker_config,':',2)=$2`,
          [cat, city, FIX_APPLIED_AT]),
        pool.query(`SELECT count(*)::int AS n FROM ${TABLE_FOR[cat]} WHERE city=$1`, [city]),
      ]);
      const dir = dirR.rows[0].n;
      const a = allR.rows[0];
      console.log(`\n── ${city} · ${cat}`);
      console.log(`   AFTER-FIX attempts: ${a.after_fix_attempts}  completed=${a.after_fix_completed} failed=${a.after_fix_failed} aborted=${a.after_fix_aborted} running=${a.after_fix_running}`);
      console.log(`   Directory total: ${dir}`);
      if (latestR.rowCount === 0) { console.log(`   Latest cycle: NONE`); continue; }
      const L = latestR.rows[0];
      const isAfterFix = new Date(L.started_at) >= new Date(FIX_APPLIED_AT);
      console.log(`   Latest cycle: ${L.started_at.toISOString?.() ?? L.started_at}  ${isAfterFix ? '[AFTER-FIX]' : '[before fix]'}`);
      console.log(`     worker_config: ${L.worker_config}`);
      console.log(`     status: ${L.status}  processed=${L.records_processed} new=${L.records_new} errors=${L.errors_count} duration=${L.duration_ms}ms`);
      console.log(`     provider: ${L.primary_provider ?? '(none)'}`);
      console.log(`     unexpected_error: ${L.unexpected_error ?? '(none)'}`);
      if (L.reconciler_reason) console.log(`     reconciler_reason: ${L.reconciler_reason}`);
      if (L.provider_results) console.log(`     provider_results: ${JSON.stringify(L.provider_results)}`);
      if (L.discovery_stats) console.log(`     discovery_stats: ${JSON.stringify(L.discovery_stats)}`);
    }
  }
}

// 3) Denpasar Market directory count preservation check
console.log(banner(`§3 · Denpasar Market preservation`));
{
  const r = await pool.query(`SELECT count(*)::int AS n FROM nex.mp_seller WHERE city='Denpasar'`);
  console.log(`Denpasar mp_seller rows: ${r.rows[0].n}  (expected: still 3 · higher is fine · lower = regression)`);
  const rows = await pool.query(`SELECT business_name, first_discovered_at FROM nex.mp_seller WHERE city='Denpasar' ORDER BY first_discovered_at`);
  for (const b of rows.rows) console.log(`  · ${b.business_name}  (${b.first_discovered_at.toISOString?.() ?? b.first_discovered_at})`);
}

// 4) Serialization storm sentinel (post-fix window only)
console.log(banner(`§4 · Serialization error rate BEFORE vs AFTER fix`));
{
  const r = await pool.query(`
    SELECT
      count(*) FILTER (WHERE started_at < $1::timestamptz AND started_at >= now() - interval '48 hours') AS total_before,
      count(*) FILTER (WHERE started_at < $1::timestamptz AND started_at >= now() - interval '48 hours'
                       AND summary->>'unexpected_error' ILIKE '%could not serialize%') AS serialization_before,
      count(*) FILTER (WHERE started_at >= $1::timestamptz) AS total_after,
      count(*) FILTER (WHERE started_at >= $1::timestamptz
                       AND summary->>'unexpected_error' ILIKE '%could not serialize%') AS serialization_after
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'`,
    [FIX_APPLIED_AT]);
  const b = r.rows[0];
  const beforeRate = b.total_before > 0 ? (100*b.serialization_before/b.total_before).toFixed(1) : "n/a";
  const afterRate  = b.total_after  > 0 ? (100*b.serialization_after /b.total_after ).toFixed(1) : "n/a";
  console.log(`Before fix (48h window): ${b.serialization_before}/${b.total_before} = ${beforeRate}%`);
  console.log(`After  fix (post-fix)  : ${b.serialization_after}/${b.total_after} = ${afterRate}%`);
}

await pool.end();

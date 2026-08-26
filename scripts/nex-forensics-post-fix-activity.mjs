// scripts/nex-forensics-post-fix-activity.mjs
// Read-only. Show what has actually run since 11:17 UTC across ALL walkers,
// what's currently running, and how the "errors=1" cycles express their
// actual failure reason (audit report vs unexpected_error field).
import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const FIX = "2026-08-24 11:17:00+00";
const banner = (t) => `\n${"═".repeat(78)}\n  ${t}\n${"═".repeat(78)}`;

console.log(banner(`Post-fix activity forensics @ ${new Date().toISOString()}`));

console.log(banner(`§A · All acquisition cycles started >= ${FIX}`));
{
  const r = await pool.query(`
    SELECT worker_config, status, started_at, finished_at,
           records_processed, records_new, errors_count, duration_ms,
           substring(summary->>'unexpected_error', 1, 100) AS err
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
     ORDER BY started_at`, [FIX]);
  console.log(`Total cycles post-fix: ${r.rowCount}`);
  for (const row of r.rows) {
    console.log(`  ${row.started_at.toISOString()}  ${row.worker_config.padEnd(48)}  ${row.status.padEnd(10)}  proc=${String(row.records_processed ?? '-').padStart(4)} new=${String(row.records_new ?? '-').padStart(4)} err=${row.errors_count ?? '-'} dur=${row.duration_ms ?? '-'}ms  ${row.err ?? ''}`);
  }
}

console.log(banner(`§B · Currently running acquisition cycles`));
{
  const r = await pool.query(`
    SELECT worker_config, started_at, EXTRACT(EPOCH FROM (now() - started_at))::int AS age_s
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND status='running' AND finished_at IS NULL
     ORDER BY started_at`);
  console.log(`Currently running: ${r.rowCount}`);
  for (const row of r.rows) {
    console.log(`  ${row.started_at.toISOString()}  ${row.worker_config.padEnd(48)}  age=${row.age_s}s`);
  }
}

console.log(banner(`§C · Rotation state for new-city Food+Accommodation`));
{
  const r = await pool.query(`
    SELECT city, category, surface, state,
           state_entered_at,
           EXTRACT(EPOCH FROM (now() - state_entered_at))::int AS state_age_s
      FROM nex.discovery_rotation_state
     WHERE city = ANY($1::text[])
       AND category = ANY(ARRAY['food','accommodation'])
     ORDER BY city, category, surface`,
    [["Jakarta","Denpasar","Surabaya","Bandung","Semarang"]]);
  for (const row of r.rows) {
    console.log(`  ${row.city.padEnd(12)} ${row.category.padEnd(14)} ${row.surface.padEnd(20)} ${row.state.padEnd(12)}  state_age=${row.state_age_s}s`);
  }
}

console.log(banner(`§D · Latest 5 orchestrator picks (post-fix)`));
{
  const r = await pool.query(`
    SELECT picked_at, city, category, surface, reason, tier
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= $1::timestamptz
     ORDER BY picked_at DESC LIMIT 30`, [FIX]);
  console.log(`Picks post-fix: ${r.rowCount}`);
  for (const row of r.rows) {
    console.log(`  ${row.picked_at.toISOString()}  ${(row.city ?? '?').padEnd(12)}  ${(row.category ?? '?').padEnd(14)}  ${(row.surface ?? '-').padEnd(20)}  ${row.tier ?? '?'}  ${row.reason ?? ''}`);
  }
}

console.log(banner(`§E · Audit reports for errors=1 Food/Accom cycles (pre-fix analysis)`));
{
  const r = await pool.query(`
    SELECT id, worker_config, started_at, records_processed, errors_count,
           audit_report_path
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition'
       AND started_at >= now() - interval '24 hours'
       AND errors_count > 0
       AND split_part(worker_config,':',1) IN ('food','accommodation')
       AND split_part(worker_config,':',2) IN ('Jakarta','Denpasar','Surabaya','Bandung','Semarang')
     ORDER BY started_at DESC LIMIT 10`);
  console.log(`Cycles with errors=1: ${r.rowCount}`);
  for (const row of r.rows) {
    console.log(`  ${row.started_at.toISOString()}  ${row.worker_config}  errors=${row.errors_count}  audit=${row.audit_report_path ?? '(none)'}`);
  }
}

console.log(banner(`§F · Double-release string search (ANY summary field · any severity)`));
{
  const r = await pool.query(`
    SELECT count(*) AS n,
           min(started_at) AS first,
           max(started_at) AS last
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition'
       AND started_at >= now() - interval '48 hours'
       AND summary::text ILIKE '%already been released%'`);
  console.log(`Cycles with 'already been released' anywhere in summary (48h): ${r.rows[0].n}`);
  if (Number(r.rows[0].n) > 0) console.log(`  first: ${r.rows[0].first?.toISOString()}  last: ${r.rows[0].last?.toISOString()}`);
}

await pool.end();

// scripts/nex-forensics-final-verdict.mjs
// Read-only. Final green-verdict check for the double-release fix.
import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const FIX = "2026-08-24 11:17:00+00";
const banner = (t) => `\n${"═".repeat(78)}\n  ${t}\n${"═".repeat(78)}`;

console.log(banner(`FINAL VERDICT · post-fix @ ${new Date().toISOString()}`));

// A) Double-release across ALL summary jsonb + audit_report_path
console.log(banner(`§A · Double-release string search (48h)`));
{
  const r = await pool.query(`
    SELECT
      count(*) FILTER (WHERE started_at < $1::timestamptz
                         AND started_at >= now() - interval '48 hours'
                         AND summary::text ILIKE '%already been released%') AS before_fix,
      count(*) FILTER (WHERE started_at >= $1::timestamptz
                         AND summary::text ILIKE '%already been released%') AS after_fix,
      count(*) FILTER (WHERE started_at < $1::timestamptz
                         AND started_at >= now() - interval '48 hours') AS total_before,
      count(*) FILTER (WHERE started_at >= $1::timestamptz) AS total_after
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition'`,
    [FIX]);
  const b = r.rows[0];
  console.log(`  BEFORE fix (48h → 11:17 UTC): ${b.before_fix} / ${b.total_before} cycles hit 'already been released'`);
  console.log(`  AFTER  fix (11:17 UTC → now): ${b.after_fix} / ${b.total_after} cycles hit 'already been released'`);
}

// B) Look at the pre-fix cycles I identified earlier — read their audit_report_path
console.log(banner(`§B · Pre-fix cycles that hit double-release (audit inspection)`));
{
  const configs = [
    'food:Jakarta:jakarta',
    'accommodation:Surabaya:surabaya',
    'accommodation:Bandung:bandung',
    'food:Bandung:bandung',
  ];
  for (const wc of configs) {
    const r = await pool.query(`
      SELECT started_at, status, records_processed, errors_count, duration_ms,
             audit_report_path
        FROM nex.worker_cycle_run
       WHERE worker_config=$1
       ORDER BY started_at DESC LIMIT 3`, [wc]);
    console.log(`\n  ${wc}:`);
    for (const row of r.rows) {
      const post = new Date(row.started_at) >= new Date(FIX);
      console.log(`    ${row.started_at.toISOString()}  ${row.status.padEnd(10)}  proc=${row.records_processed ?? '-'} err=${row.errors_count} dur=${row.duration_ms}ms  ${post?'[AFTER-FIX]':''}`);
    }
  }
}

// C) The Klaten accommodation errors=1 cycle at 11:23 — what actually errored?
console.log(banner(`§C · Klaten accommodation cycle at 11:23:06 (errors=1) detail`));
{
  const r = await pool.query(`
    SELECT id, worker_config, status, started_at, duration_ms,
           records_processed, records_new, errors_count,
           summary
      FROM nex.worker_cycle_run
     WHERE worker_config='accommodation:Klaten:klaten'
       AND started_at >= '2026-08-24 11:23:00+00'::timestamptz
     ORDER BY started_at LIMIT 1`);
  if (r.rowCount === 0) console.log("  NOT FOUND");
  else {
    const row = r.rows[0];
    console.log(`  worker_config: ${row.worker_config}`);
    console.log(`  status: ${row.status}  errors=${row.errors_count}  dur=${row.duration_ms}ms`);
    console.log(`  full summary:`);
    console.log(JSON.stringify(row.summary, null, 2));
  }
}

// D) Serialization storm sentinel post-fix
console.log(banner(`§D · Serialization error rate post-fix`));
{
  const r = await pool.query(`
    SELECT
      count(*) FILTER (WHERE started_at < $1::timestamptz AND started_at >= now() - interval '4 hours') AS pre4h_total,
      count(*) FILTER (WHERE started_at < $1::timestamptz AND started_at >= now() - interval '4 hours'
                         AND summary::text ILIKE '%could not serialize%') AS pre4h_ser,
      count(*) FILTER (WHERE started_at >= $1::timestamptz) AS post_total,
      count(*) FILTER (WHERE started_at >= $1::timestamptz
                         AND summary::text ILIKE '%could not serialize%') AS post_ser
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'`, [FIX]);
  const b = r.rows[0];
  const pre = b.pre4h_total > 0 ? (100*b.pre4h_ser/b.pre4h_total).toFixed(1) : "n/a";
  const post = b.post_total > 0 ? (100*b.post_ser/b.post_total).toFixed(1) : "n/a";
  console.log(`  4h BEFORE fix: ${b.pre4h_ser}/${b.pre4h_total} = ${pre}% cycles had 'could not serialize' error surface`);
  console.log(`  post-fix     : ${b.post_ser}/${b.post_total} = ${post}%`);
}

// E) Orphan bypass sentinel post-fix
console.log(banner(`§E · Orphan bypass / new fixed-cron acquisition post-fix`));
{
  const r = await pool.query(`
    SELECT
      (SELECT count(*) FROM nex.worker_cycle_run
        WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) AS cycles_post,
      (SELECT count(*) FROM nex.discovery_orchestrator_pick
        WHERE picked_at >= $1::timestamptz) AS picks_post,
      (SELECT count(*) FROM nex.worker_cycle_run
        WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
          AND (worker_config LIKE 'market:yogyakarta-city:%'
               OR worker_config LIKE 'market:central-java-%')) AS legacy_configs`, [FIX]);
  const b = r.rows[0];
  console.log(`  Acquisition cycles post-fix : ${b.cycles_post}`);
  console.log(`  Orchestrator picks post-fix : ${b.picks_post}`);
  console.log(`  Orphan bypass (cycles−picks): ${b.cycles_post - b.picks_post}  (target: <= 0 · negative = picks recorded post-fix but child spawn deferred which is fine)`);
  console.log(`  Legacy fixed-cron cycles    : ${b.legacy_configs}  (target: 0)`);
}

// F) Denpasar Market preservation
console.log(banner(`§F · Denpasar Market row preservation`));
{
  const r = await pool.query(`SELECT count(*)::int AS n FROM nex.mp_seller WHERE city='Denpasar'`);
  console.log(`  Denpasar mp_seller rows: ${r.rows[0].n}  (BEFORE snapshot was 3 · growth is fine · regression = fail)`);
}

// G) Denpasar Food chain proof
console.log(banner(`§G · Denpasar Food chain proof`));
{
  const r = await pool.query(`
    SELECT count(*)::int AS n,
           min(first_discovered_at) AS earliest,
           max(first_discovered_at) AS latest
      FROM nex.food_business WHERE city='Denpasar'`);
  console.log(`  Denpasar food_business rows: ${r.rows[0].n}  earliest: ${r.rows[0].earliest?.toISOString?.() ?? r.rows[0].earliest}  latest: ${r.rows[0].latest?.toISOString?.() ?? r.rows[0].latest}`);
}

await pool.end();

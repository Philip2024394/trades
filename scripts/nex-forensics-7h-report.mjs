// scripts/nex-forensics-7h-report.mjs
// 7-hour workforce forensic report · READ-ONLY · walkers keep running.
// Answers the numbered list from Philip's 2026-08-24 forensic directive.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const banner = (t) => `\n${"═".repeat(70)}\n  ${t}\n${"═".repeat(70)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

console.log(banner("NEX Workforce 7-hour forensic report · " + new Date().toISOString()));

console.log(banner("§1 · window boundary"));
pretty(await q(`SELECT now() AT TIME ZONE 'UTC' AS utc_now, (now() - interval '7 hours') AT TIME ZONE 'UTC' AS utc_7h_ago`));

console.log(banner("§2 · headline cycle metrics (last 7h)"));
pretty(await q(`
  WITH w AS (
    SELECT * FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '7 hours'
  )
  SELECT
    (SELECT count(*) FROM w)                                   AS cycles_started_7h,
    (SELECT count(*) FROM w WHERE finished_at IS NOT NULL)     AS cycles_finished_7h,
    (SELECT count(*) FROM w WHERE status = 'success')          AS success_7h,
    (SELECT count(*) FROM w WHERE status = 'failed')           AS failed_7h,
    (SELECT count(*) FROM w WHERE status NOT IN ('success','failed') AND finished_at IS NOT NULL) AS other_terminal_7h,
    (SELECT count(*) FROM w WHERE finished_at IS NULL)         AS still_open_started_7h,
    round((SELECT count(*)::numeric FROM w WHERE status='failed')
        / NULLIF((SELECT count(*)::numeric FROM w WHERE finished_at IS NOT NULL),0), 4) AS failure_rate_finished_7h,
    (SELECT coalesce(sum(records_processed),0)::bigint FROM w) AS records_processed_7h,
    (SELECT coalesce(sum(records_new),0)::bigint       FROM w) AS records_new_7h,
    (SELECT coalesce(sum(records_rejected),0)::bigint  FROM w) AS records_rejected_7h,
    (SELECT round(coalesce(sum(records_new),0)::numeric / 7.0, 2) FROM w) AS records_new_per_hour,
    (SELECT round(avg(duration_ms)::numeric, 0) FROM w WHERE duration_ms IS NOT NULL) AS avg_duration_ms
`));

console.log(banner("§3 · status breakdown (last 7h · all rows)"));
pretty(await q(`
  SELECT coalesce(status,'(null)') AS status, count(*) AS n,
         count(*) FILTER (WHERE finished_at IS NULL) AS still_open
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
  GROUP BY 1 ORDER BY n DESC
`));

console.log(banner("§4 · workforce right-now (state as of now)"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at IS NULL)                    AS open_cycles_now,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at IS NULL
       AND started_at < now() - interval '15 minutes')                                        AS zombie_cycles_over_15min,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at IS NULL
       AND started_at < now() - interval '30 minutes')                                        AS zombie_cycles_over_30min,
    (SELECT count(*) FROM nex.worker_heartbeat
       WHERE last_heartbeat_at >= now() - interval '2 minutes')                               AS heartbeats_fresh_2min,
    (SELECT count(*) FROM nex.worker_heartbeat
       WHERE last_heartbeat_at >= now() - interval '10 minutes')                              AS heartbeats_fresh_10min,
    (SELECT count(*) FROM nex.worker_health_status WHERE health='healthy')                    AS health_healthy,
    (SELECT count(*) FROM nex.worker_health_status WHERE health='stale')                      AS health_stale,
    (SELECT count(*) FROM nex.worker_health_status WHERE health='failing')                    AS health_failing
`));

console.log(banner("§5 · distinct worker_configs seen (last 7h)"));
pretty(await q(`
  SELECT worker_type, count(DISTINCT worker_config) AS distinct_configs,
         count(*)   AS cycles,
         sum(records_new) AS records_new
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
  GROUP BY 1 ORDER BY cycles DESC
`));

console.log(banner("§6 · top 10 worker_configs producing records_new (last 7h)"));
pretty(await q(`
  SELECT worker_type, worker_config,
         count(*) AS cycles,
         sum(records_processed) AS processed,
         sum(records_new) AS new_records,
         sum(errors_count) AS errors,
         count(*) FILTER (WHERE status='failed') AS failures
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
  GROUP BY 1,2
  ORDER BY sum(records_new) DESC NULLS LAST
  LIMIT 10
`));

console.log(banner("§7 · top 10 worker_configs with repeated ZERO-result cycles (last 7h)"));
pretty(await q(`
  SELECT worker_type, worker_config,
         count(*) AS zero_cycles,
         count(*) FILTER (WHERE status='failed') AS failed_of_zero
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
    AND coalesce(records_new,0)=0
    AND finished_at IS NOT NULL
  GROUP BY 1,2
  ORDER BY zero_cycles DESC
  LIMIT 10
`));

console.log(banner("§8 · top 10 worker_configs by error count (last 7h)"));
pretty(await q(`
  SELECT worker_type, worker_config,
         count(*) AS cycles,
         count(*) FILTER (WHERE status='failed') AS failed,
         sum(errors_count) AS errors
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
  GROUP BY 1,2
  ORDER BY count(*) FILTER (WHERE status='failed') DESC, errors DESC NULLS LAST
  LIMIT 10
`));

console.log(banner("§9 · provider usage seen inside summary jsonb (last 7h)"));
pretty(await q(`
  SELECT
    coalesce((summary->>'provider'), (summary->'provider'->>'name'), 'unknown') AS provider,
    count(*) AS cycles,
    sum(records_new) AS new_records,
    count(*) FILTER (WHERE status='failed') AS failed
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
  GROUP BY 1 ORDER BY cycles DESC
`));

console.log(banner("§10 · errors: sample recent failure summaries (last 7h · latest 12)"));
pretty(await q(`
  SELECT worker_type, worker_config, started_at, finished_at, duration_ms,
         errors_count, status,
         left(coalesce(summary::text,'(null)'), 400) AS summary_head
  FROM nex.worker_cycle_run
  WHERE started_at >= now() - interval '7 hours'
    AND status='failed'
  ORDER BY started_at DESC
  LIMIT 12
`));

console.log(banner("§11 · zombie cycles right now (finished_at IS NULL AND started >15min ago)"));
pretty(await q(`
  SELECT worker_type, worker_config, worker_id, started_at,
         now() - started_at AS age
  FROM nex.worker_cycle_run
  WHERE finished_at IS NULL AND started_at < now() - interval '15 minutes'
  ORDER BY started_at ASC
  LIMIT 20
`));

console.log(banner("§12 · fresh persistence proof: rows added to nex.food_business (last 7h)"));
pretty(await q(`
  SELECT count(*) AS food_new_7h,
         min(created_at) AS earliest,
         max(created_at) AS latest
  FROM nex.food_business WHERE created_at >= now() - interval '7 hours'
`));

console.log(banner("§13 · fresh persistence proof: rows added to nex.accommodation_business (last 7h)"));
pretty(await q(`
  SELECT count(*) AS accom_new_7h,
         min(created_at) AS earliest,
         max(created_at) AS latest
  FROM nex.accommodation_business WHERE created_at >= now() - interval '7 hours'
`));

console.log(banner("§14 · city breakdown of persisted rows (last 7h)"));
pretty(await q(`
  SELECT 'food' AS cat, city, count(*) AS added_7h
  FROM nex.food_business WHERE created_at >= now() - interval '7 hours'
  GROUP BY city
  UNION ALL
  SELECT 'accommodation' AS cat, city, count(*) AS added_7h
  FROM nex.accommodation_business WHERE created_at >= now() - interval '7 hours'
  GROUP BY city
  ORDER BY added_7h DESC
`));

console.log(banner("§15 · 1h vs 7h vs 24h comparison headline"));
pretty(await q(`
  SELECT
    -- 1h
    (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '1 hour')                        AS cycles_1h,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '1 hour' AND status='failed')    AS failed_1h,
    (SELECT coalesce(sum(records_new),0) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '1 hour')    AS new_1h,
    -- 7h
    (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '7 hours')                       AS cycles_7h,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '7 hours' AND status='failed')   AS failed_7h,
    (SELECT coalesce(sum(records_new),0) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '7 hours')   AS new_7h,
    -- 24h
    (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '24 hours')                      AS cycles_24h,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '24 hours' AND status='failed')  AS failed_24h,
    (SELECT coalesce(sum(records_new),0) FROM nex.worker_cycle_run WHERE started_at >= now() - interval '24 hours')  AS new_24h
`));

await pool.end();
console.log(banner("END OF REPORT"));

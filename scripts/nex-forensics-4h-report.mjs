// scripts/nex-forensics-4h-report.mjs
// 4-hour workforce forensic report · READ-ONLY · walkers keep running.

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

try {
  console.log(banner("NEX Workforce · last 4 hours · " + new Date().toISOString()));

  console.log(banner("§1 · window boundary"));
  pretty(await q(`SELECT now() AT TIME ZONE 'UTC' AS utc_now, (now() - interval '4 hours') AT TIME ZONE 'UTC' AS utc_4h_ago`));

  console.log(banner("§2 · headline metrics (last 4h)"));
  pretty(await q(`
    WITH w AS (SELECT * FROM nex.worker_cycle_run WHERE started_at >= now() - interval '4 hours')
    SELECT
      (SELECT count(*) FROM w)                                                            AS cycles_started,
      (SELECT count(*) FROM w WHERE finished_at IS NOT NULL)                              AS cycles_finished,
      (SELECT count(*) FROM w WHERE status='success')                                     AS success,
      (SELECT count(*) FROM w WHERE status='failed')                                      AS failed,
      (SELECT count(*) FROM w WHERE finished_at IS NULL)                                  AS still_open,
      round((SELECT count(*)::numeric FROM w WHERE status='failed')
          / NULLIF((SELECT count(*)::numeric FROM w WHERE finished_at IS NOT NULL),0), 4) AS failure_rate,
      (SELECT coalesce(sum(records_processed),0)::bigint FROM w)                          AS records_processed,
      (SELECT coalesce(sum(records_new),0)::bigint       FROM w)                          AS records_new,
      (SELECT round(coalesce(sum(records_new),0)::numeric / 4.0, 2) FROM w)               AS records_new_per_hour,
      (SELECT round(avg(duration_ms)::numeric, 0) FROM w WHERE duration_ms IS NOT NULL)   AS avg_duration_ms
  `));

  console.log(banner("§3 · status breakdown"));
  pretty(await q(`
    SELECT coalesce(status,'(null)') AS status, count(*) AS n,
           count(*) FILTER (WHERE finished_at IS NULL) AS still_open
    FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '4 hours'
    GROUP BY 1 ORDER BY n DESC
  `));

  console.log(banner("§4 · workforce right-now"));
  pretty(await q(`
    SELECT
      (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at IS NULL)                                             AS open_cycles_now,
      (SELECT count(*) FROM nex.worker_cycle_run WHERE finished_at IS NULL AND started_at < now() - interval '15 min')  AS zombies_over_15min,
      (SELECT count(*) FROM nex.worker_heartbeat WHERE last_heartbeat_at >= now() - interval '2 minutes')               AS heartbeats_fresh_2min,
      (SELECT count(*) FROM nex.worker_health_status WHERE health='healthy')                                            AS health_healthy,
      (SELECT count(*) FROM nex.worker_health_status WHERE health='stale')                                              AS health_stale,
      (SELECT count(*) FROM nex.worker_health_status WHERE health='failing')                                            AS health_failing
  `));

  console.log(banner("§5 · top 10 configs producing records_new"));
  pretty(await q(`
    SELECT worker_type, worker_config,
           count(*) AS cycles, sum(records_processed) AS processed,
           sum(records_new) AS new_records, sum(errors_count) AS errors,
           count(*) FILTER (WHERE status='failed') AS failures
    FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '4 hours'
    GROUP BY 1,2 ORDER BY sum(records_new) DESC NULLS LAST LIMIT 10
  `));

  console.log(banner("§6 · top 10 configs with ZERO-result cycles"));
  pretty(await q(`
    SELECT worker_type, worker_config,
           count(*) AS zero_cycles,
           count(*) FILTER (WHERE status='failed') AS failed_of_zero
    FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '4 hours'
      AND coalesce(records_new,0)=0 AND finished_at IS NOT NULL
    GROUP BY 1,2 ORDER BY zero_cycles DESC LIMIT 10
  `));

  console.log(banner("§7 · top 10 configs by failures"));
  pretty(await q(`
    SELECT worker_type, worker_config,
           count(*) AS cycles,
           count(*) FILTER (WHERE status='failed') AS failed,
           sum(errors_count) AS errors
    FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '4 hours'
    GROUP BY 1,2
    ORDER BY count(*) FILTER (WHERE status='failed') DESC, errors DESC NULLS LAST LIMIT 10
  `));

  console.log(banner("§8 · provider usage"));
  pretty(await q(`
    SELECT coalesce((summary->>'provider'), (summary->'provider'->>'name'), 'unknown') AS provider,
           count(*) AS cycles, sum(records_new) AS new_records,
           count(*) FILTER (WHERE status='failed') AS failed
    FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '4 hours'
    GROUP BY 1 ORDER BY cycles DESC
  `));

  console.log(banner("§9 · recent failures (latest 8)"));
  pretty(await q(`
    SELECT worker_type, worker_config, started_at, finished_at, duration_ms,
           errors_count, status, left(coalesce(summary::text,'(null)'), 260) AS summary_head
    FROM nex.worker_cycle_run
    WHERE started_at >= now() - interval '4 hours' AND status='failed'
    ORDER BY started_at DESC LIMIT 8
  `));

  console.log(banner("§10 · zombies right now (open >15 min)"));
  pretty(await q(`
    SELECT worker_type, worker_config, worker_id, started_at, now() - started_at AS age
    FROM nex.worker_cycle_run
    WHERE finished_at IS NULL AND started_at < now() - interval '15 minutes'
    ORDER BY started_at ASC LIMIT 20
  `));

  console.log(banner("§11 · fresh persistence (rows added last 4h)"));
  const [food, accom, mp, tx] = await Promise.all([
    q(`SELECT count(*) AS n FROM nex.food_business WHERE created_at >= now() - interval '4 hours'`).catch(() => [{n: "n/a"}]),
    q(`SELECT count(*) AS n FROM nex.accommodation_business WHERE created_at >= now() - interval '4 hours'`).catch(() => [{n: "n/a"}]),
    q(`SELECT count(*) AS n FROM nex.mp_seller WHERE created_at >= now() - interval '4 hours'`).catch(() => [{n: "n/a"}]),
    q(`SELECT count(*) AS n FROM nex.transport_acquisition_record WHERE created_at >= now() - interval '4 hours'`).catch(() => [{n: "n/a"}]),
  ]);
  pretty({
    food_business: food[0]?.n,
    accommodation_business: accom[0]?.n,
    mp_seller: mp[0]?.n,
    transport_acquisition_record: tx[0]?.n,
  });

  await pool.end();
} catch (err) {
  console.error("REPORT FAILED:", err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
}

// scripts/nex-forensics-cutover3-acceptance.mjs
//
// 2026-08-24 · CUTOVER 3 acceptance forensic. Runs Philip's 7-item acceptance
// test after the fixed-cron acquisition entries were removed.
//
// BEFORE = the 7 hours ending at cutover 3 (2026-08-24 08:55:54 UTC).
// AFTER  = every cycle whose started_at >= cutover 3.
//
// Read-only · no walker interrupted.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const CUTOVER_3 = "2026-08-24 08:55:54+00";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));
async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner(`§A0 · Window boundaries`));
pretty([{ before_window: `${CUTOVER_3} minus 7h`, after_window: `since ${CUTOVER_3}`, now: (await pool.query("SELECT now() AT TIME ZONE 'UTC'")).rows[0] }]);

console.log(banner("§A1 · No-bypass proof · every acquisition cycle since cutover 3 vs orchestrator picks"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run
      WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) AS acquisition_cycles_since_cutover,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick
      WHERE picked_at >= $1::timestamptz) AS orchestrator_picks_since_cutover,
    (SELECT count(*) FROM nex.worker_cycle_run
      WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) -
    (SELECT count(*) FROM nex.discovery_orchestrator_pick
      WHERE picked_at >= $1::timestamptz) AS orphan_bypass_cycles`,
  [CUTOVER_3],
));

console.log(banner("§A2 · Saturation protection · post-saturation Yogyakarta food + accommodation"));
pretty(await q(`
  WITH saturated_at AS (
    SELECT city, category, updated_at AS saturated_since
    FROM nex.discovery_rotation_state
    WHERE state='saturated' AND city='Yogyakarta' AND category IN ('food','accommodation')
  ),
  parsed AS (
    SELECT split_part(worker_config,':',1) AS category,
           split_part(worker_config,':',2) AS city,
           started_at
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
  )
  SELECT s.city, s.category, s.saturated_since,
         (SELECT count(*) FROM parsed p
            WHERE p.city = s.city AND p.category = s.category
              AND p.started_at > GREATEST(s.saturated_since, $1::timestamptz))
           AS cycles_after_saturation_since_cutover
  FROM saturated_at s
  ORDER BY 4 DESC`,
  [CUTOVER_3],
));

console.log(banner("§A3 · Yogyakarta concentration collapse"));
pretty(await q(`
  WITH parsed AS (
    SELECT split_part(worker_config,':',2) AS city,
           split_part(worker_config,':',1) AS category
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
  ),
  total AS (SELECT count(*)::float AS n FROM parsed),
  by_city AS (SELECT city, count(*) AS cycles FROM parsed GROUP BY 1 ORDER BY 2 DESC)
  SELECT
    (SELECT count(*) FROM by_city) AS distinct_cities_walked,
    (SELECT n::int FROM total) AS total_cycles,
    (SELECT city FROM by_city LIMIT 1) AS top_city,
    (SELECT cycles FROM by_city LIMIT 1) AS top_city_cycles,
    (SELECT (cycles::numeric * 100 / (SELECT n FROM total))::text FROM by_city LIMIT 1) AS top_city_pct,
    (SELECT (sum(cycles)::numeric * 100 / (SELECT n FROM total))::text FROM (SELECT cycles FROM by_city LIMIT 3) t) AS top_3_pct`,
  [CUTOVER_3],
));

console.log(banner("§A4 · Geographic progression · picks per city since cutover 3"));
pretty(await q(`
  SELECT city, count(*) AS picks
  FROM nex.discovery_orchestrator_pick
  WHERE picked_at >= $1::timestamptz
  GROUP BY city ORDER BY picks DESC`,
  [CUTOVER_3],
));

console.log(banner("§A5 · Category balance since cutover 3"));
pretty(await q(`
  SELECT split_part(worker_config,':',1) AS category, count(*) AS cycles
  FROM nex.worker_cycle_run
  WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
  GROUP BY 1 ORDER BY cycles DESC`,
  [CUTOVER_3],
));

console.log(banner("§A6 · Preserved rotation lifecycle · current saturation state"));
pretty(await q(`
  SELECT city, category, state, updated_at,
         last_cycle_started_at, last_productive_at,
         extract(epoch from (now() - updated_at))::int AS updated_age_s
  FROM nex.discovery_rotation_state
  WHERE state='saturated'
  ORDER BY updated_at DESC`,
));

console.log(banner("§A7 · Categories still receiving work per city (no starvation check)"));
pretty(await q(`
  WITH parsed AS (
    SELECT split_part(worker_config,':',2) AS city,
           split_part(worker_config,':',1) AS category
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
  )
  SELECT city, array_agg(DISTINCT category ORDER BY category) AS categories_touched,
         count(*) AS cycles
  FROM parsed GROUP BY city ORDER BY cycles DESC`,
  [CUTOVER_3],
));

console.log(banner("§A8 · BEFORE (7h ending at cutover 3) headline for direct comparison"));
pretty(await q(`
  WITH parsed AS (
    SELECT split_part(worker_config,':',2) AS city,
           split_part(worker_config,':',1) AS category
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition'
      AND started_at BETWEEN $1::timestamptz - interval '7 hours' AND $1::timestamptz
  ),
  total AS (SELECT count(*)::float AS n FROM parsed),
  by_city AS (SELECT city, count(*) AS cycles FROM parsed GROUP BY 1 ORDER BY 2 DESC),
  bypass AS (
    SELECT
      (SELECT count(*) FROM nex.worker_cycle_run WHERE worker_type='acquisition' AND started_at BETWEEN $1::timestamptz - interval '7 hours' AND $1::timestamptz) AS total_before,
      (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at BETWEEN $1::timestamptz - interval '7 hours' AND $1::timestamptz) AS picks_before
  )
  SELECT
    (SELECT total_before FROM bypass) AS total_cycles,
    (SELECT picks_before FROM bypass) AS orchestrator_picks,
    (SELECT total_before - picks_before FROM bypass) AS orphan_bypass,
    (SELECT city FROM by_city LIMIT 1) AS top_city,
    (SELECT cycles FROM by_city LIMIT 1) AS top_city_cycles,
    (SELECT (cycles::numeric * 100 / (SELECT n FROM total))::text FROM by_city LIMIT 1) AS top_city_pct,
    (SELECT count(*) FROM by_city) AS distinct_cities_walked`,
  [CUTOVER_3],
));

await pool.end();
console.log(banner("END"));

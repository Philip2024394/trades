// scripts/nex-forensics-rotation-coverage.mjs
// P0 rotation forensic · last 7h.
//
// Answers Philip's asks §11 (no saturated-then-picked) + §12 (geographic
// progression). Read-only · workers keep running.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const WINDOW = "7 hours";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));

async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner(`§R1 · Saturated combos observed in last ${WINDOW} (rotation state history)`));
pretty(await q(`
  SELECT city, category, state, updated_at,
         extract(epoch from (now() - updated_at))::int AS updated_age_s
  FROM nex.discovery_rotation_state
  WHERE state='saturated'
  ORDER BY updated_at DESC
`));

console.log(banner(`§R2 · Orchestrator picks in last ${WINDOW} by city (concentration)`));
pretty(await q(`
  SELECT city, count(*) AS picks
  FROM nex.discovery_orchestrator_pick
  WHERE picked_at >= now() - interval '${WINDOW}'
  GROUP BY city
  ORDER BY picks DESC
`));

console.log(banner(`§R3 · All acquisition cycles in last ${WINDOW} · by parsed city`));
pretty(await q(`
  WITH parsed AS (
    SELECT
      worker_config,
      CASE
        WHEN worker_config LIKE 'market:%' THEN
          initcap(replace(split_part(split_part(worker_config,':',2), '-', 1),' city',''))
        ELSE split_part(worker_config,':',2)
      END AS city_raw,
      split_part(worker_config,':',1) AS category
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  )
  SELECT city_raw, count(*) AS cycles, count(DISTINCT category) AS categories
  FROM parsed GROUP BY city_raw ORDER BY cycles DESC
`));

console.log(banner(`§R4 · Cycles per category (last ${WINDOW})`));
pretty(await q(`
  SELECT split_part(worker_config,':',1) AS category, count(*) AS cycles
  FROM nex.worker_cycle_run
  WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  GROUP BY 1 ORDER BY cycles DESC
`));

console.log(banner(`§R5 · Concentration · % of cycles going to top city and top-3 cities`));
pretty(await q(`
  WITH parsed AS (
    SELECT
      CASE
        WHEN worker_config LIKE 'market:%' THEN split_part(split_part(worker_config,':',2),'-',1)
        ELSE split_part(worker_config,':',2)
      END AS city_key,
      1 AS one
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  ),
  totals AS (SELECT count(*)::float AS total FROM parsed),
  by_city AS (SELECT city_key, count(*) AS cycles FROM parsed GROUP BY 1 ORDER BY 2 DESC)
  SELECT
    (SELECT city_key FROM by_city LIMIT 1) AS top_city,
    round((SELECT cycles::numeric FROM by_city LIMIT 1) / (SELECT total FROM totals) * 100, 1) AS top_city_pct,
    round((SELECT sum(cycles)::numeric FROM (SELECT cycles FROM by_city LIMIT 3) t) / (SELECT total FROM totals) * 100, 1) AS top_3_pct,
    (SELECT count(*) FROM by_city) AS distinct_cities_walked
`));

console.log(banner(`§R6 · CRITICAL · did any saturated combo get a cycle in last ${WINDOW}?`));
pretty(await q(`
  WITH saturated_at AS (
    SELECT city, category, updated_at AS saturated_since
    FROM nex.discovery_rotation_state WHERE state='saturated'
  ),
  cycles AS (
    SELECT split_part(worker_config,':',1) AS category,
           CASE
             WHEN worker_config LIKE 'market:%' THEN initcap(replace(split_part(split_part(worker_config,':',2),'-',1),' city',''))
             ELSE split_part(worker_config,':',2)
           END AS city,
           started_at
    FROM nex.worker_cycle_run
    WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  )
  SELECT s.city, s.category, s.saturated_since,
         (SELECT count(*) FROM cycles c
            WHERE c.city ILIKE s.city AND c.category = s.category
              AND c.started_at > s.saturated_since) AS cycles_after_saturation
  FROM saturated_at s
  ORDER BY cycles_after_saturation DESC
`));

console.log(banner(`§R7 · Fixed-cron vs orchestrator picks · which spawner drives which cycles`));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}') AS total_cycles_7h,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at >= now() - interval '${WINDOW}') AS orchestrator_picks_7h
`));

console.log(banner(`§R8 · Discovery rotation state · full snapshot of every tracked combo`));
pretty(await q(`
  SELECT city, category, state, round,
         last_cycle_started_at, last_productive_at, updated_at
  FROM nex.discovery_rotation_state
  ORDER BY city, category
`));

await pool.end();
console.log(banner("END"));

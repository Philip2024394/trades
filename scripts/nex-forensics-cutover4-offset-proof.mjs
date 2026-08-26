// scripts/nex-forensics-cutover4-offset-proof.mjs
//
// 2026-08-24 · CUTOVER 4 acceptance forensic. Proves the +30s rotation tick
// offset eliminated the tick-collision race that caused Bantul + Sleman
// accommodation to spawn 327-370ms after their SATURATED transition at
// cutover 3.
//
// Reads: nex.worker_cycle_run + nex.discovery_orchestrator_pick +
//        nex.discovery_rotation_state (with state_entered_at)
// No mutations · walkers keep running.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const CUTOVER_4 = "2026-08-24 09:35:41+00";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));
async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner("§O1 · Bypass invariant (should be ≤ 0 · orchestrator = sole authority)"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) AS acquisition_cycles,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at >= $1::timestamptz) AS orchestrator_picks,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) -
    (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at >= $1::timestamptz) AS orphan_bypass`,
  [CUTOVER_4],
));

console.log(banner("§O2 · Genuine saturation violations · uses state_entered_at (precise)"));
pretty(await q(`
  WITH sat AS (
    SELECT city, category, state_entered_at AS sat_since
      FROM nex.discovery_rotation_state WHERE state='saturated'
  ),
  parsed AS (
    SELECT split_part(worker_config,':',1) AS category,
           split_part(worker_config,':',2) AS city, started_at
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
  )
  SELECT s.city, s.category, s.sat_since,
         (SELECT count(*) FROM parsed p
            WHERE p.city = s.city AND p.category = s.category
              AND p.started_at > s.sat_since) AS post_saturation_cycles
  FROM sat s
  ORDER BY post_saturation_cycles DESC`,
  [CUTOVER_4],
));

console.log(banner("§O3 · Sub-second tick-collision check · state transitions AND cycles landing in the same second"));
pretty(await q(`
  WITH transitions AS (
    SELECT city, category, state_entered_at
      FROM nex.discovery_rotation_state
     WHERE state_entered_at >= $1::timestamptz
  ),
  parsed AS (
    SELECT split_part(worker_config,':',1) AS category,
           split_part(worker_config,':',2) AS city,
           started_at
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
  )
  SELECT t.city, t.category, t.state_entered_at,
         (SELECT count(*) FROM parsed p
            WHERE p.city = t.city AND p.category = t.category
              AND date_trunc('second', p.started_at) = date_trunc('second', t.state_entered_at))
           AS cycles_within_same_wallclock_second
  FROM transitions t
  ORDER BY 4 DESC`,
  [CUTOVER_4],
));

console.log(banner("§O4 · Actual timestamps · rotation transitions vs orchestrator picks since cutover 4"));
pretty(await q(`
  SELECT 'rotation_state_transitions' AS event_type,
         state_entered_at AS event_at,
         city || ':' || category AS scope
    FROM nex.discovery_rotation_state
   WHERE state_entered_at >= $1::timestamptz
  UNION ALL
  SELECT 'orchestrator_pick' AS event_type,
         picked_at AS event_at,
         city || ':' || category AS scope
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= $1::timestamptz
   ORDER BY event_at ASC
   LIMIT 30`,
  [CUTOVER_4],
));

console.log(banner("§O5 · Geographic coverage since cutover 4"));
pretty(await q(`
  SELECT count(DISTINCT city) AS distinct_cities_picked,
         count(DISTINCT category) AS distinct_categories_picked,
         count(*) AS total_picks
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= $1::timestamptz`,
  [CUTOVER_4],
));

console.log(banner("§O6 · Category rotation since cutover 4"));
pretty(await q(`
  SELECT category, count(*) AS picks
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= $1::timestamptz
   GROUP BY category ORDER BY picks DESC`,
  [CUTOVER_4],
));

console.log(banner("§O7 · records_new truthfulness · post-fix scoring-only accommodation cycles"));
pretty(await q(`
  SELECT worker_config,
         count(*) AS cycles,
         sum(records_new) AS total_records_new,
         sum(records_processed) AS total_records_processed
    FROM nex.worker_cycle_run
   WHERE worker_config LIKE 'accommodation:%'
     AND started_at >= $1::timestamptz
     AND summary ? 'discovery_stats'
   GROUP BY worker_config ORDER BY cycles DESC`,
  [CUTOVER_4],
));

console.log(banner("§O8 · Serialization errors since cutover 4 (post retry-bump 8→20)"));
pretty(await q(`
  SELECT count(*) AS serialization_errors_since_cutover_4
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
     AND summary->>'unexpected_error' ILIKE 'could not serialize%'`,
  [CUTOVER_4],
));

await pool.end();
console.log(banner("END"));

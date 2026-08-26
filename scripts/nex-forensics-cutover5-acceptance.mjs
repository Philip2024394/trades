// scripts/nex-forensics-cutover5-acceptance.mjs
//
// P0 · 2026-08-24 · Cutover 5 acceptance forensic · Philip's 9 conditions.
// Read-only · walkers keep running · no state mutations.
//
// Cutover 5 (surface-aware rotation state) went live at 2026-08-24 10:01:54 UTC.
// This script measures the ACTUAL behaviour post-cutover against:
//
//   §C1 Surface separation · same (city, cat), one surface SAT + one BUILD → BUILD picked
//   §C2 No false city exhaustion · saturated surface doesn't block other surfaces
//   §C3 Real surfaces for 7 non-Yogya cities (no prambanan placeholder emitted)
//   §C4 72h lifecycle per surface (untouched · precise state_entered_at column)
//   §C5 Geographic progression · picks span cities not addicted to one
//   §C6 Category progression · food/accommodation still receive opportunities
//   §C7 One Geographic Authority · orphan_bypass = 0
//   §C8 No regression · serialization / zombie / scheduler offset / records_new
//   §C9 Legacy surface='default' rows preserved (NOT cleaned)

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const CUTOVER_5 = "2026-08-24 10:01:54+00";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));
async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner("§C1 · SURFACE SEPARATION · same combo · SAT + BUILD surfaces coexist"));
console.log("Every (city, category) with both a SATURATED and non-SAT surface currently:");
pretty(await q(`
  WITH per_combo AS (
    SELECT city, category,
           count(*) FILTER (WHERE state='saturated') AS sat_surfaces,
           count(*) FILTER (WHERE state != 'saturated') AS non_sat_surfaces,
           array_agg(surface || ':' || state ORDER BY surface) AS surface_states
    FROM nex.discovery_rotation_state
    WHERE surface != 'default'
    GROUP BY city, category
  )
  SELECT city, category, sat_surfaces, non_sat_surfaces, surface_states
    FROM per_combo
   WHERE sat_surfaces > 0 AND non_sat_surfaces > 0
   ORDER BY city, category
`));

console.log(banner("§C1b · Where BOTH a SAT and non-SAT surface exist · which surfaces have been PICKED?"));
pretty(await q(`
  WITH mixed AS (
    SELECT city, category
    FROM nex.discovery_rotation_state
    WHERE surface != 'default'
    GROUP BY city, category
    HAVING count(*) FILTER (WHERE state='saturated') > 0
       AND count(*) FILTER (WHERE state != 'saturated') > 0
  ),
  picks AS (
    SELECT city, category, surface, count(*) AS picks_since_cutover
    FROM nex.discovery_orchestrator_pick
    WHERE picked_at >= $1::timestamptz
    GROUP BY 1, 2, 3
  )
  SELECT m.city, m.category, p.surface, p.picks_since_cutover,
         (SELECT state FROM nex.discovery_rotation_state s
           WHERE s.city = m.city AND s.category = m.category AND s.surface = p.surface
           LIMIT 1) AS surface_state_now
    FROM mixed m
    JOIN picks p ON p.city = m.city AND p.category = m.category
   ORDER BY m.city, m.category, p.surface
`, [CUTOVER_5]));

console.log(banner("§C2 · No false city exhaustion · saturated surfaces do not block combo picks"));
pretty(await q(`
  WITH combos AS (
    SELECT DISTINCT city, category
    FROM nex.discovery_rotation_state
    WHERE surface != 'default'
  )
  SELECT c.city, c.category,
         (SELECT count(*) FROM nex.discovery_rotation_state s
           WHERE s.city = c.city AND s.category = c.category AND s.surface != 'default' AND s.state = 'saturated') AS sat_surfaces,
         (SELECT count(*) FROM nex.discovery_rotation_state s
           WHERE s.city = c.city AND s.category = c.category AND s.surface != 'default') AS total_surfaces,
         CASE
           WHEN (SELECT count(*) FROM nex.discovery_rotation_state s
                   WHERE s.city = c.city AND s.category = c.category AND s.surface != 'default') = 0 THEN 'no-surface-rows-yet'
           WHEN (SELECT count(*) FROM nex.discovery_rotation_state s
                   WHERE s.city = c.city AND s.category = c.category AND s.surface != 'default' AND s.state = 'saturated')
              = (SELECT count(*) FROM nex.discovery_rotation_state s
                   WHERE s.city = c.city AND s.category = c.category AND s.surface != 'default') THEN 'fully-exhausted'
           ELSE 'combo-remains-eligible'
         END AS combo_status,
         (SELECT count(*) FROM nex.discovery_orchestrator_pick p
           WHERE p.city = c.city AND p.category = c.category
             AND p.picked_at >= $1::timestamptz) AS picks_since_cutover
    FROM combos c
   ORDER BY c.city, c.category
`, [CUTOVER_5]));

console.log(banner("§C3 · Real surfaces · every distinct worker_config surface since cutover 5"));
pretty(await q(`
  SELECT split_part(worker_config,':',1) AS category,
         split_part(worker_config,':',2) AS city,
         split_part(worker_config,':',3) AS surface,
         count(*) AS cycles
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
   GROUP BY 1, 2, 3
   ORDER BY 1, 2, 3
`, [CUTOVER_5]));

console.log(banner("§C3b · Any post-cutover cycle still using 'prambanan' for non-Yogyakarta cities?"));
pretty(await q(`
  SELECT worker_config, count(*) AS cycles
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'
     AND started_at >= $1::timestamptz
     AND worker_config LIKE '%prambanan%'
     AND worker_config NOT LIKE '%Yogyakarta%'
   GROUP BY worker_config
`, [CUTOVER_5]));

console.log(banner("§C4 · Per-surface state_entered_at · lifecycle timing preserved"));
pretty(await q(`
  SELECT city, category, surface, state,
         state_entered_at,
         extract(epoch from (now() - state_entered_at))::int AS age_s,
         last_cycle_started_at
    FROM nex.discovery_rotation_state
   WHERE surface != 'default'
   ORDER BY state_entered_at DESC LIMIT 15
`));

console.log(banner("§C5 · Geographic progression · unique cities picked since cutover 5"));
pretty(await q(`
  SELECT city, count(*) AS picks, count(DISTINCT surface) AS distinct_surfaces_picked
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= $1::timestamptz
   GROUP BY city ORDER BY picks DESC
`, [CUTOVER_5]));

console.log(banner("§C6 · Category progression since cutover 5"));
pretty(await q(`
  SELECT category, count(*) AS picks
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= $1::timestamptz
   GROUP BY category ORDER BY picks DESC
`, [CUTOVER_5]));

console.log(banner("§C7 · One Geographic Authority · orphan bypass check"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) AS acquisition_cycles,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick
       WHERE picked_at >= $1::timestamptz) AS orchestrator_picks,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= $1::timestamptz)
    - (SELECT count(*) FROM nex.discovery_orchestrator_pick
         WHERE picked_at >= $1::timestamptz) AS orphan_bypass
`, [CUTOVER_5]));

console.log(banner("§C8 · No regression · serialization / zombie / records_new truthfulness"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
         AND summary->>'unexpected_error' ILIKE 'could not serialize%') AS serialization_errors,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE status='aborted' AND finished_at >= $1::timestamptz
         AND summary->>'reconciler_reason'='exceeded_configured_timeout') AS zombies_reconciled,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE finished_at IS NULL AND status='running'
         AND started_at < now() - interval '15 minutes'
         AND worker_type='acquisition') AS stuck_over_15min,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE started_at >= $1::timestamptz AND worker_config LIKE 'accommodation:%'
         AND summary ? 'discovery_stats' AND records_new = 0) AS records_new_zero_honest,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE started_at >= $1::timestamptz AND worker_config LIKE 'accommodation:%'
         AND summary ? 'discovery_stats' AND records_new > 0) AS records_new_positive_honest
`, [CUTOVER_5]));

console.log(banner("§C9 · Legacy surface='default' rows · preserved · NOT cleaned"));
pretty(await q(`
  SELECT count(*) AS legacy_default_rows,
         count(*) FILTER (WHERE state='saturated') AS legacy_saturated,
         count(*) FILTER (WHERE state='build')     AS legacy_build,
         array_agg(city || ':' || category ORDER BY city, category)
           FILTER (WHERE state='saturated') AS legacy_saturated_combos
    FROM nex.discovery_rotation_state
   WHERE surface = 'default'
`));

await pool.end();
console.log(banner("END · cutover 5 live observation complete"));

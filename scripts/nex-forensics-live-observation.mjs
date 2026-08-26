// scripts/nex-forensics-live-observation.mjs
// §9 small live window post-cutover-3 + post records_new fix.
// Confirms: no fixed-cron bypass · no saturation violations · no serialization
// errors · geographic diversity · records_new truthful · orchestrator sole authority.

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

console.log(banner("§L1 · Bypass invariant · every acquisition cycle traces to an orchestrator pick"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) AS acquisition_cycles,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at >= $1::timestamptz) AS orchestrator_picks,
    (SELECT count(*) FROM nex.worker_cycle_run WHERE worker_type='acquisition' AND started_at >= $1::timestamptz) -
    (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at >= $1::timestamptz) AS orphan_bypass`,
  [CUTOVER_3],
));

console.log(banner("§L2 · Saturation violation check · uses PRECISE state_entered_at (not updated_at)"));
// 2026-08-24 · Philip P1 · fixed to use nex.discovery_rotation_state.state_entered_at
// which is only bumped on real transitions (not on every rotation tick refresh).
// This eliminates the earlier timestamp-accounting artifact that flagged
// Bantul + Sleman as "1 post-saturation cycle each" when in fact the picker
// had respected state AT PICK TIME · the previous updated_at column made the
// invariant unmeasurable with precision.
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
  FROM sat s ORDER BY post_saturation_cycles DESC`,
  [CUTOVER_3],
));

console.log(banner("§L3 · Serialization errors since cutover 3"));
pretty(await q(`
  SELECT count(*) AS serialization_errors_since_cutover
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
     AND summary->>'unexpected_error' ILIKE 'could not serialize%'`,
  [CUTOVER_3],
));

console.log(banner("§L4 · Geographic diversity · unique cities in last window"));
pretty(await q(`
  SELECT count(DISTINCT city) AS distinct_cities_picked_since_cutover
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= $1::timestamptz`,
  [CUTOVER_3],
));

console.log(banner("§L5 · records_new truthfulness · scoring-only cycles report 0 · with vs without new summary.discovery_stats"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_config LIKE 'accommodation:%'
         AND started_at >= $1::timestamptz
         AND records_new > 0
         AND summary ? 'discovery_stats') AS post_fix_records_new_positive,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_config LIKE 'accommodation:%'
         AND started_at >= $1::timestamptz
         AND records_new = 0
         AND summary ? 'discovery_stats') AS post_fix_records_new_zero`,
  [CUTOVER_3],
));

console.log(banner("§L6 · Orchestrator sole authority · scheduler config check via last 10 minutes activity"));
pretty(await q(`
  SELECT
    (SELECT count(DISTINCT worker_id) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= now() - interval '10 minutes'
         AND worker_id LIKE 'acquisition:%:Yogyakarta') AS yogyakarta_fixed_cron_worker_ids_10min,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick WHERE picked_at >= now() - interval '10 minutes') AS orchestrator_picks_10min`,
));

await pool.end();
console.log(banner("END"));

// scripts/nex-forensics-geographic-progression.mjs
//
// P0 · 2026-08-24 · Long-running geographic-progression observation harness.
// Read-only · walkers keep running · no state mutations · no architecture
// changes. Answers Philip's post-Cutover-5 acceptance question:
//
//   "Does the machine genuinely progress through Indonesia over time, or
//    does it recycle the same city/category/surface while eligible ones
//    are being starved?"
//
// Usage
//   node scripts/nex-forensics-geographic-progression.mjs [--window=24h|72h|Nh]
//
// Runs safely at any cadence. Emits a stable set of sections so time-series
// comparisons are easy (diff two runs).

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const windowArg = process.argv.find((a) => a.startsWith("--window="))?.split("=")[1] ?? "24h";
const WINDOW = /^\d+h$/.test(windowArg) ? `${parseInt(windowArg, 10)} hours` : "24 hours";

const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));
async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner(`NEX geographic-progression forensic · window: last ${WINDOW}`));
pretty([{ generated_at: new Date().toISOString(), window: WINDOW }]);

// ── §G1 · Coverage summary · distinct dimensions selected ────────────
console.log(banner("§G1 · Coverage summary"));
pretty(await q(`
  SELECT
    (SELECT count(DISTINCT city) FROM nex.discovery_orchestrator_pick
      WHERE picked_at >= now() - interval '${WINDOW}') AS distinct_cities,
    (SELECT count(DISTINCT category) FROM nex.discovery_orchestrator_pick
      WHERE picked_at >= now() - interval '${WINDOW}') AS distinct_categories,
    (SELECT count(DISTINCT (city || ':' || category || ':' || coalesce(surface, ''))) FROM nex.discovery_orchestrator_pick
      WHERE picked_at >= now() - interval '${WINDOW}') AS distinct_city_cat_surface,
    (SELECT count(*) FROM nex.discovery_orchestrator_pick
      WHERE picked_at >= now() - interval '${WINDOW}') AS total_picks
`));

// ── §G2 · Selections per city ────────────────────────────────────────
console.log(banner("§G2 · Selections per city (concentration check)"));
pretty(await q(`
  WITH c AS (
    SELECT city, count(*) AS picks FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= now() - interval '${WINDOW}'
     GROUP BY city
  ),
  t AS (SELECT count(*)::float AS total FROM nex.discovery_orchestrator_pick
         WHERE picked_at >= now() - interval '${WINDOW}')
  SELECT city, picks,
         round((picks::numeric * 100 / NULLIF((SELECT total FROM t), 0))::numeric, 1) AS pct
    FROM c ORDER BY picks DESC
`));

// ── §G3 · Selections per (city, category) ────────────────────────────
console.log(banner("§G3 · Selections per (city, category)"));
pretty(await q(`
  SELECT city, category, count(*) AS picks
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= now() - interval '${WINDOW}'
   GROUP BY city, category ORDER BY picks DESC
`));

// ── §G4 · Selections per (city, category, surface) ───────────────────
console.log(banner("§G4 · Selections per (city, category, surface)"));
pretty(await q(`
  SELECT city, category, coalesce(surface,'(null)') AS surface, count(*) AS picks
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= now() - interval '${WINDOW}'
   GROUP BY city, category, surface ORDER BY picks DESC
`));

// ── §G5 · Repeat interval per (city, category, surface) ──────────────
console.log(banner("§G5 · Repeat interval · seconds between same (city, category, surface) picks"));
pretty(await q(`
  WITH picks AS (
    SELECT city, category, coalesce(surface,'(null)') AS surface, picked_at,
           lag(picked_at) OVER (
             PARTITION BY city, category, coalesce(surface,'(null)')
             ORDER BY picked_at
           ) AS prev_picked_at
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= now() - interval '${WINDOW}'
  )
  SELECT city, category, surface,
         count(*) AS picks,
         round(avg(EXTRACT(EPOCH FROM (picked_at - prev_picked_at))) FILTER (WHERE prev_picked_at IS NOT NULL)::numeric, 1) AS avg_interval_s,
         round(min(EXTRACT(EPOCH FROM (picked_at - prev_picked_at))) FILTER (WHERE prev_picked_at IS NOT NULL)::numeric, 1) AS min_interval_s,
         round(max(EXTRACT(EPOCH FROM (picked_at - prev_picked_at))) FILTER (WHERE prev_picked_at IS NOT NULL)::numeric, 1) AS max_interval_s
    FROM picks
   GROUP BY city, category, surface
   ORDER BY picks DESC, avg_interval_s ASC
   LIMIT 40
`));

// ── §G6 · Saturated combinations correctly skipped ───────────────────
console.log(banner("§G6 · Saturated (surface-level) combinations right now · verify skip"));
pretty(await q(`
  WITH sat AS (
    SELECT city, category, surface, state_entered_at
      FROM nex.discovery_rotation_state
     WHERE state='saturated' AND surface != 'default'
  )
  SELECT s.city, s.category, s.surface, s.state_entered_at,
         (SELECT count(*) FROM nex.discovery_orchestrator_pick p
           WHERE p.city = s.city AND p.category = s.category AND p.surface = s.surface
             AND p.picked_at > s.state_entered_at) AS picks_after_saturation
    FROM sat s
   ORDER BY picks_after_saturation DESC, s.city, s.category, s.surface
`));

// ── §G7 · MAINTENANCE combinations · did they re-enter ──────────────
console.log(banner("§G7 · MAINTENANCE combinations · re-entered after cooldown?"));
pretty(await q(`
  WITH m AS (
    SELECT city, category, surface, state_entered_at
      FROM nex.discovery_rotation_state
     WHERE state='maintenance' AND surface != 'default'
  )
  SELECT m.city, m.category, m.surface, m.state_entered_at,
         (SELECT count(*) FROM nex.discovery_orchestrator_pick p
           WHERE p.city = m.city AND p.category = m.category AND p.surface = m.surface
             AND p.picked_at > m.state_entered_at) AS picks_after_maintenance
    FROM m
   ORDER BY picks_after_maintenance DESC, m.city, m.category, m.surface
`));

// ── §G8 · Cities eligible but receiving zero selections ─────────────
console.log(banner("§G8 · Cities with eligible (non-saturated) surfaces but ZERO picks in window"));
pretty(await q(`
  WITH eligible AS (
    SELECT DISTINCT city
      FROM nex.discovery_rotation_state
     WHERE state != 'saturated' AND surface != 'default'
  ),
  picked AS (
    SELECT DISTINCT city
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= now() - interval '${WINDOW}'
  )
  SELECT e.city
    FROM eligible e
   WHERE NOT EXISTS (SELECT 1 FROM picked p WHERE p.city = e.city)
   ORDER BY e.city
`));

// ── §G9 · Category starvation · categories with 0 picks despite eligible combos
console.log(banner("§G9 · Category starvation · categories with 0 picks in window"));
pretty(await q(`
  WITH eligible_cats AS (
    SELECT DISTINCT category
      FROM nex.discovery_rotation_state
     WHERE state != 'saturated' AND surface != 'default'
  ),
  picked_cats AS (
    SELECT DISTINCT category
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= now() - interval '${WINDOW}'
  )
  SELECT ec.category
    FROM eligible_cats ec
   WHERE NOT EXISTS (SELECT 1 FROM picked_cats pc WHERE pc.category = ec.category)
   ORDER BY ec.category
`));

// ── §G10 · Geographic concentration · top-1 / top-3 percentages ──────
console.log(banner("§G10 · Geographic concentration · top-1 and top-3 city percentages"));
pretty(await q(`
  WITH c AS (
    SELECT city, count(*) AS picks
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= now() - interval '${WINDOW}'
     GROUP BY city
     ORDER BY picks DESC
  ),
  t AS (SELECT count(*)::float AS total FROM nex.discovery_orchestrator_pick
         WHERE picked_at >= now() - interval '${WINDOW}')
  SELECT
    (SELECT city FROM c LIMIT 1) AS top_city,
    (SELECT picks FROM c LIMIT 1) AS top_city_picks,
    round((SELECT picks::numeric * 100 / NULLIF((SELECT total FROM t),0) FROM c LIMIT 1)::numeric, 1) AS top_city_pct,
    round((SELECT sum(picks)::numeric * 100 / NULLIF((SELECT total FROM t),0) FROM (SELECT picks FROM c LIMIT 3) x)::numeric, 1) AS top_3_pct,
    (SELECT count(*) FROM c) AS distinct_cities
`));

// ── §G11 · Advance into under-served cities · picks by started_at bucket
console.log(banner("§G11 · Advance progression · picks per hour bucket (last 24h) per city"));
pretty(await q(`
  SELECT date_trunc('hour', picked_at) AS hour_bucket,
         city, count(*) AS picks
    FROM nex.discovery_orchestrator_pick
   WHERE picked_at >= now() - interval '24 hours'
   GROUP BY hour_bucket, city
   ORDER BY hour_bucket DESC, picks DESC
   LIMIT 60
`));

// ── §G12 · Dominance regression check · any city > 60% of picks? ─────
console.log(banner("§G12 · Dominance check · any city > 60% of picks?"));
pretty(await q(`
  WITH c AS (
    SELECT city, count(*) AS picks FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= now() - interval '${WINDOW}'
     GROUP BY city
  ),
  t AS (SELECT count(*)::float AS total FROM nex.discovery_orchestrator_pick
         WHERE picked_at >= now() - interval '${WINDOW}')
  SELECT city, picks,
         round((picks::numeric * 100 / NULLIF((SELECT total FROM t), 0))::numeric, 1) AS pct
    FROM c
   WHERE (picks::numeric * 100 / NULLIF((SELECT total FROM t), 0)) > 60
   ORDER BY pct DESC
`));

// ── §G13 · Regression sentinels · protection-invariant checks ────────
console.log(banner("§G13 · Regression sentinels · protections still in force"));
pretty(await q(`
  SELECT
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
         AND summary->>'unexpected_error' ILIKE 'could not serialize%')             AS serialization_errors,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE status='aborted' AND finished_at >= now() - interval '${WINDOW}'
         AND summary->>'reconciler_reason'='exceeded_configured_timeout')            AS zombies_reconciled,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
         AND worker_config LIKE '%prambanan%' AND worker_config NOT LIKE '%Yogyakarta%') AS non_yogya_prambanan_leaks,
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}')
    - (SELECT count(*) FROM nex.discovery_orchestrator_pick
         WHERE picked_at >= now() - interval '${WINDOW}')                             AS orphan_bypass
`));

await pool.end();
console.log(banner(`END · geographic-progression forensic complete · window ${WINDOW}`));

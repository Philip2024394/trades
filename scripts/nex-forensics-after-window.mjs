// scripts/nex-forensics-after-window.mjs
//
// P0 verification · BEFORE → AFTER metrics for the 2026-08-24 concurrency fix.
// Reads real DB only · no mutations · walker keeps running.
//
// BEFORE reference = 7-hour window prior to cutover 07:56 UTC
// AFTER window     = every cycle started_at >= cutover-2 (08:28:23 UTC scheduler
//                    restart · when reconciler + fresh walker processes align)

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const CUTOVER_2  = process.env.CUTOVER_2_UTC ?? "2026-08-24 08:28:23+00";
const BEFORE_END = "2026-08-24 07:56:00+00"; // pre-fix code
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));

console.log(banner(`Cutover 1 · code deploy: 07:56 UTC (lease retry helper)`));
console.log(`Cutover 2 · scheduler restart: ${CUTOVER_2} (reconciler + fresh processes)`);

// ── 1 · Headline BEFORE / AFTER ────────────────────────────────────────
console.log(banner("§1 · Headline BEFORE (last 7h before cutover 1)"));
pretty((await pool.query(
  `SELECT
     count(*) AS cycles,
     count(*) FILTER (WHERE status='completed') AS completed,
     count(*) FILTER (WHERE status='failed')    AS failed,
     count(*) FILTER (WHERE status='aborted')   AS aborted,
     round(
       count(*) FILTER (WHERE status IN ('failed','aborted'))::numeric
       / NULLIF(count(*) FILTER (WHERE finished_at IS NOT NULL),0), 4
     ) AS failure_rate,
     count(*) FILTER (WHERE summary->>'unexpected_error' ILIKE 'could not serialize%') AS serialization_errors,
     coalesce(sum(records_new),0) AS records_new,
     coalesce(sum(records_processed),0) AS records_processed
   FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'
     AND started_at BETWEEN $1::timestamptz - interval '7 hours' AND $1::timestamptz`,
  [BEFORE_END],
)).rows);

console.log(banner(`§2 · Headline AFTER (all cycles since cutover 2 ${CUTOVER_2})`));
pretty((await pool.query(
  `SELECT
     count(*) AS cycles,
     count(*) FILTER (WHERE status='completed') AS completed,
     count(*) FILTER (WHERE status='failed')    AS failed,
     count(*) FILTER (WHERE status='aborted')   AS aborted,
     count(*) FILTER (WHERE finished_at IS NULL) AS still_open,
     round(
       count(*) FILTER (WHERE status IN ('failed','aborted'))::numeric
       / NULLIF(count(*) FILTER (WHERE finished_at IS NOT NULL),0), 4
     ) AS failure_rate,
     count(*) FILTER (WHERE summary->>'unexpected_error' ILIKE 'could not serialize%') AS serialization_errors,
     coalesce(sum(records_new),0) AS records_new,
     coalesce(sum(records_processed),0) AS records_processed,
     round(avg(duration_ms) FILTER (WHERE status='completed')::numeric,0) AS avg_completed_ms
   FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'
     AND started_at >= $1::timestamptz`,
  [CUTOVER_2],
)).rows);

// ── 2 · Per-walker BEFORE / AFTER ──────────────────────────────────────
console.log(banner("§3 · Transport walker BEFORE (7h pre-cutover)"));
pretty((await pool.query(
  `SELECT
     count(*) AS cycles,
     count(*) FILTER (WHERE status='completed') AS completed,
     count(*) FILTER (WHERE status='failed')    AS failed,
     round(count(*) FILTER (WHERE status='failed')::numeric
           / NULLIF(count(*),0), 4) AS failure_rate,
     coalesce(sum(records_new),0) AS records_new,
     coalesce(sum(records_processed),0) AS records_processed
   FROM nex.worker_cycle_run
   WHERE worker_config LIKE 'transport:%'
     AND started_at BETWEEN $1::timestamptz - interval '7 hours' AND $1::timestamptz`,
  [BEFORE_END],
)).rows);

console.log(banner("§4 · Transport walker AFTER (since cutover 2)"));
pretty((await pool.query(
  `SELECT worker_config,
     count(*) AS cycles,
     count(*) FILTER (WHERE status='completed') AS completed,
     count(*) FILTER (WHERE status='failed')    AS failed,
     count(*) FILTER (WHERE status='aborted')   AS aborted,
     count(*) FILTER (WHERE finished_at IS NULL) AS still_open,
     round(count(*) FILTER (WHERE status IN ('failed','aborted'))::numeric
           / NULLIF(count(*) FILTER (WHERE finished_at IS NOT NULL),0), 4) AS failure_rate,
     count(*) FILTER (WHERE summary->>'unexpected_error' ILIKE 'could not serialize%') AS serialization_errors,
     coalesce(sum(records_new),0) AS records_new,
     coalesce(sum(records_processed),0) AS records_processed
   FROM nex.worker_cycle_run
   WHERE worker_config LIKE 'transport:%'
     AND started_at >= $1::timestamptz
   GROUP BY worker_config
   ORDER BY cycles DESC`,
  [CUTOVER_2],
)).rows);

console.log(banner("§5 · Market walker BEFORE (7h pre-cutover)"));
pretty((await pool.query(
  `SELECT
     count(*) AS cycles,
     count(*) FILTER (WHERE status='completed') AS completed,
     count(*) FILTER (WHERE status='failed')    AS failed,
     round(count(*) FILTER (WHERE status='failed')::numeric
           / NULLIF(count(*),0), 4) AS failure_rate,
     sum(errors_count) AS total_errors,
     coalesce(sum(records_new),0) AS records_new,
     coalesce(sum(records_processed),0) AS records_processed
   FROM nex.worker_cycle_run
   WHERE worker_config LIKE 'market:%'
     AND started_at BETWEEN $1::timestamptz - interval '7 hours' AND $1::timestamptz`,
  [BEFORE_END],
)).rows);

console.log(banner("§6 · Market walker AFTER (since cutover 2)"));
pretty((await pool.query(
  `SELECT worker_config,
     count(*) AS cycles,
     count(*) FILTER (WHERE status='completed') AS completed,
     count(*) FILTER (WHERE status='failed')    AS failed,
     count(*) FILTER (WHERE status='aborted')   AS aborted,
     round(count(*) FILTER (WHERE status IN ('failed','aborted'))::numeric
           / NULLIF(count(*) FILTER (WHERE finished_at IS NOT NULL),0), 4) AS failure_rate,
     sum(errors_count) AS total_errors,
     coalesce(sum(records_processed),0) AS returned_from_provider,
     coalesce(sum(records_new),0) AS truly_new_sellers,
     count(*) FILTER (WHERE summary->>'unexpected_error' ILIKE 'could not serialize%') AS serialization_errors
   FROM nex.worker_cycle_run
   WHERE worker_config LIKE 'market:%'
     AND started_at >= $1::timestamptz
   GROUP BY worker_config
   ORDER BY cycles DESC`,
  [CUTOVER_2],
)).rows);

// ── 3 · Persistence proof · did the DB actually gain rows ──────────────
console.log(banner("§7 · Persistence proof · rows added since cutover 2"));
pretty((await pool.query(
  `SELECT 'mp_seller'                        AS tbl,
          count(*) AS rows_added
     FROM nex.mp_seller
    WHERE created_at >= $1::timestamptz
   UNION ALL
   SELECT 'food_business',       count(*)
     FROM nex.food_business
    WHERE created_at >= $1::timestamptz
   UNION ALL
   SELECT 'accommodation_business', count(*)
     FROM nex.accommodation_business
    WHERE created_at >= $1::timestamptz
   UNION ALL
   SELECT 'food_snapshot',       count(*)
     FROM nex.food_business_source_snapshot
    WHERE source_ingested_at >= $1::timestamptz
   UNION ALL
   SELECT 'accommodation_snapshot', count(*)
     FROM nex.accommodation_business_source_snapshot
    WHERE captured_at >= $1::timestamptz`,
  [CUTOVER_2],
)).rows);

// ── 4 · Zombie reconciler observability ────────────────────────────────
console.log(banner("§8 · Reconciler activity since cutover 2"));
pretty((await pool.query(
  `SELECT
     count(*) FILTER (WHERE status='aborted'
                        AND summary->>'reconciler_reason'='exceeded_configured_timeout')
       AS zombies_reconciled_since_cutover,
     count(*) FILTER (WHERE status='running' AND finished_at IS NULL
                        AND started_at < now() - interval '15 minutes')
       AS current_stuck_over_15min
   FROM nex.worker_cycle_run
   WHERE finished_at >= $1::timestamptz OR (finished_at IS NULL AND started_at >= $1::timestamptz)`,
  [CUTOVER_2],
)).rows);

// ── 5 · Provider observability from real summary.provider_results[] ────
console.log(banner("§9 · Provider outcomes from summary.provider_results[] (since cutover 2)"));
pretty((await pool.query(
  `SELECT provider,
          count(*) AS cycles,
          sum((pr->>'returned')::int)   AS returned,
          sum((pr->>'persisted')::int)  AS persisted
     FROM nex.worker_cycle_run wcr,
          jsonb_array_elements(coalesce(wcr.summary->'provider_results', '[]'::jsonb)) AS pr,
          LATERAL (SELECT (pr->>'provider') AS provider) x
    WHERE started_at >= $1::timestamptz
      AND worker_type='acquisition'
    GROUP BY provider
    ORDER BY cycles DESC`,
  [CUTOVER_2],
)).rows);

await pool.end();
console.log(banner("END"));

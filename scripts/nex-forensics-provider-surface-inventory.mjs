// scripts/nex-forensics-provider-surface-inventory.mjs
//
// P0 · 2026-08-24 · Provider-surface phase · read-only forensic inventory.
// Answers Philip's Task #1 · every (city × category × surface) combo with
// full metrics so the state-model design has real evidence to reason from.
//
// This script produces:
//   §S1 · every distinct worker_config seen in cycle history (surface = 3rd segment)
//   §S2 · per-worker_config metrics · cycles, records_persisted, zero-cycles, error rate
//   §S3 · per-(city, category) surface count · how many surfaces has each combo tried
//   §S4 · rotation_state grain check · does the state row cover surface or just (city,cat)
//   §S5 · Provider Rate Governor telemetry per provider
//   §S6 · summary.provider_results[] extract per worker_config (what each surface returned)
//   §S7 · alternative surface visibility (from summary.provider_ladder)
//
// No mutations · walkers keep running · read-only queries.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const WINDOW = "48 hours";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));
async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner(`§S1 · Every distinct worker_config seen in the last ${WINDOW}`));
pretty(await q(`
  SELECT worker_config,
         split_part(worker_config,':',1) AS category,
         split_part(worker_config,':',2) AS city_token,
         split_part(worker_config,':',3) AS surface_token,
         count(*) AS cycles,
         min(started_at) AS first_seen,
         max(started_at) AS last_seen
  FROM nex.worker_cycle_run
  WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  GROUP BY worker_config
  ORDER BY split_part(worker_config,':',1), split_part(worker_config,':',2), split_part(worker_config,':',3)`,
));

console.log(banner(`§S2 · Per-worker_config metrics (last ${WINDOW})`));
pretty(await q(`
  SELECT worker_config,
         count(*) AS cycles,
         count(*) FILTER (WHERE status='completed') AS completed,
         count(*) FILTER (WHERE status='failed')    AS failed,
         count(*) FILTER (WHERE status='aborted')   AS aborted,
         coalesce(sum(records_processed),0) AS records_processed,
         coalesce(sum(records_new),0)       AS records_persisted,
         count(*) FILTER (WHERE coalesce(records_new,0)=0 AND status='completed') AS zero_new_completed,
         round(count(*) FILTER (WHERE status IN ('failed','aborted'))::numeric
               / NULLIF(count(*) FILTER (WHERE finished_at IS NOT NULL),0), 4) AS error_rate,
         count(*) FILTER (WHERE summary->>'unexpected_error' ILIKE 'could not serialize%') AS serialization_errors,
         max(started_at) AS last_started_at
  FROM nex.worker_cycle_run
  WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  GROUP BY worker_config
  ORDER BY split_part(worker_config,':',1), split_part(worker_config,':',2), split_part(worker_config,':',3)`,
));

console.log(banner(`§S3 · Per-(city, category) surface count · how many distinct surfaces each combo has walked`));
pretty(await q(`
  SELECT split_part(worker_config,':',1) AS category,
         split_part(worker_config,':',2) AS city,
         count(DISTINCT split_part(worker_config,':',3)) AS distinct_surfaces_walked,
         array_agg(DISTINCT split_part(worker_config,':',3) ORDER BY split_part(worker_config,':',3)) AS surfaces
  FROM nex.worker_cycle_run
  WHERE worker_type='acquisition' AND started_at >= now() - interval '${WINDOW}'
  GROUP BY 1, 2
  ORDER BY 1, 2`,
));

console.log(banner("§S4 · Rotation state grain check · state key is (city, category, round) — NOT surface-aware"));
pretty(await q(`
  SELECT city, category, round, state, state_entered_at, last_cycle_started_at,
         last_productive_at, updated_at
  FROM nex.discovery_rotation_state
  ORDER BY city, category`,
));

console.log(banner(`§S5 · Provider Rate Governor telemetry · leases per provider (last ${WINDOW})`));
pretty(await q(`
  SELECT provider,
         count(*) AS total_leases,
         count(*) FILTER (WHERE released_at IS NOT NULL) AS released,
         count(*) FILTER (WHERE released_at IS NULL)     AS still_open,
         min(acquired_at) AS first_lease,
         max(acquired_at) AS last_lease
  FROM nex.provider_rate_lease
  WHERE acquired_at >= now() - interval '${WINDOW}'
  GROUP BY provider ORDER BY total_leases DESC`,
));

console.log(banner("§S6 · summary.provider_results[] · per (worker_config × provider) since last cutover"));
pretty(await q(`
  SELECT wcr.worker_config,
         (pr->>'provider') AS provider,
         (pr->>'status')   AS status,
         count(*)                                AS cycles_touching_provider,
         sum((pr->>'returned')::int)             AS total_returned,
         sum((pr->>'persisted')::int)            AS total_persisted
  FROM nex.worker_cycle_run wcr,
       LATERAL jsonb_array_elements(coalesce(wcr.summary->'provider_results', '[]'::jsonb)) AS pr
  WHERE wcr.worker_type='acquisition'
    AND wcr.started_at >= now() - interval '${WINDOW}'
  GROUP BY wcr.worker_config, pr->>'provider', pr->>'status'
  ORDER BY wcr.worker_config`,
));

console.log(banner("§S7 · Alternative-surface visibility · summary.provider_ladder (transport walker canonical shape)"));
pretty(await q(`
  SELECT DISTINCT
         (pl->>'id')     AS provider_id,
         (pl->>'status') AS integration_status,
         (pl->'bestFor') AS best_for
  FROM nex.worker_cycle_run wcr,
       LATERAL jsonb_array_elements(coalesce(wcr.summary->'provider_ladder', '[]'::jsonb)) AS pl
  WHERE wcr.worker_type='acquisition'
    AND wcr.started_at >= now() - interval '${WINDOW}'
  ORDER BY provider_id`,
));

console.log(banner("§S8 · Category-level saturation summary · where can NEX still discover?"));
pretty(await q(`
  SELECT category, state, count(*) AS combos
  FROM nex.discovery_rotation_state
  GROUP BY category, state ORDER BY category, state`,
));

await pool.end();
console.log(banner("END · forensic inventory complete · design phase next"));

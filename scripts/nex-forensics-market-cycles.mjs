// scripts/nex-forensics-market-cycles.mjs
// Read-only. Investigate why Solo/market + Yogyakarta/market look
// "never-run" in the observability helper. Suspicion: market walker
// writes worker_config with slug segment (lowercase-with-hyphens) but
// observability compares against city name (PropCase).

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

async function q(sql, p=[]) { return (await pool.query(sql, p)).rows; }

console.log("=== Every distinct market: worker_config (48h) ===");
console.log(JSON.stringify(await q(`
  SELECT DISTINCT worker_config,
         count(*) OVER (PARTITION BY worker_config) AS n,
         min(started_at) OVER (PARTITION BY worker_config) AS first_seen,
         max(started_at) OVER (PARTITION BY worker_config) AS last_seen
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'
     AND started_at >= now() - interval '48 hours'
     AND split_part(worker_config,':',1)='market'
   ORDER BY worker_config`), null, 2));

console.log("\n=== Latest market cycle per second-segment (any case) ===");
console.log(JSON.stringify(await q(`
  SELECT DISTINCT ON (split_part(worker_config,':',2))
         split_part(worker_config,':',2) AS second_segment,
         worker_config, status, started_at, records_processed, records_new,
         summary->>'unexpected_error' AS err
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition'
     AND split_part(worker_config,':',1)='market'
   ORDER BY split_part(worker_config,':',2), started_at DESC`), null, 2));

console.log("\n=== rotation_state for Solo/market + Yogyakarta/market ===");
console.log(JSON.stringify(await q(`
  SELECT city, category, surface, state, state_entered_at,
         saturation_streak, cycles_completed
    FROM nex.discovery_rotation_state
   WHERE category='market' AND city IN ('Solo','Yogyakarta')`), null, 2));

console.log("\n=== mp_seller rows for city='Yogyakarta' ===");
console.log(JSON.stringify(await q(`
  SELECT id, business_name, city, discovered_by_walker, first_discovered_at
    FROM nex.mp_seller WHERE city='Yogyakarta' LIMIT 5`), null, 2));

await pool.end();

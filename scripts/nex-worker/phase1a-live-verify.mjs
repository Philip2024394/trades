// scripts/nex-worker/phase1a-live-verify.mjs
//
// NEX Phase 1a · live-test verifier · Philip 2026-08-27.
//
// READ-ONLY snapshot for the controlled 1-hour food+accommodation test.
// Emits one JSON line per invocation to stdout so callers can append to
// a running log. Zero writes to the DB. Zero mutations.

import pg from "pg";
import { readFileSync } from "node:fs";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

async function scalar(sql, params = []) {
  const r = await pool.query(sql, params);
  const row = r.rows[0] ?? {};
  return Object.values(row)[0];
}

async function main() {
  const baseline = JSON.parse(readFileSync("data/nex-run-logs/phase1a-baseline.json", "utf8"));

  const now = new Date().toISOString();

  // Row counts
  const food = Number(await scalar("SELECT COUNT(*) FROM nex.food_business"));
  const accom = Number(await scalar("SELECT COUNT(*) FROM nex.accommodation_business"));
  const service = Number(await scalar("SELECT COUNT(*) FROM nex.service_business"));
  const mp_seller = Number(await scalar("SELECT COUNT(*) FROM nex.mp_seller"));

  // Deltas since baseline (verifies no deletions + tracks growth from unpaused walkers)
  const deltas = {
    food: food - Number(baseline.food),
    accom: accom - Number(baseline.accom),
    service: service - Number(baseline.service),
    mp_seller: mp_seller - Number(baseline.mp_seller),
  };

  // Duplicate excess (name+city, informational — will be replaced by (source,ref) after Phase 2)
  const foodDup = Number(await scalar(`SELECT COALESCE((SELECT SUM(k-1) FROM (SELECT COUNT(*) k FROM nex.food_business WHERE business_name IS NOT NULL AND city IS NOT NULL GROUP BY LOWER(TRIM(business_name)), LOWER(TRIM(city)) HAVING COUNT(*)>1) x), 0)::int`));
  const accomDup = Number(await scalar(`SELECT COALESCE((SELECT SUM(k-1) FROM (SELECT COUNT(*) k FROM nex.accommodation_business WHERE business_name IS NOT NULL AND city IS NOT NULL GROUP BY LOWER(TRIM(business_name)), LOWER(TRIM(city)) HAVING COUNT(*)>1) x), 0)::int`));

  // Duplicate on (source, source_reference) — the strong-identity dedup key
  const foodStrongDup = Number(await scalar(`SELECT COALESCE((SELECT SUM(k-1) FROM (SELECT COUNT(*) k FROM nex.food_business WHERE source IS NOT NULL AND source_reference IS NOT NULL GROUP BY source, source_reference HAVING COUNT(*)>1) x), 0)::int`));
  const accomStrongDup = Number(await scalar(`SELECT COALESCE((SELECT SUM(k-1) FROM (SELECT COUNT(*) k FROM nex.accommodation_business WHERE source IS NOT NULL AND source_reference IS NOT NULL GROUP BY source, source_reference HAVING COUNT(*)>1) x), 0)::int`));

  // Merge-log activity
  const mergeTotal = Number(await scalar("SELECT COUNT(*) FROM nex.identity_merge_log"));
  const mergeEnriched = Number(await scalar("SELECT COUNT(*) FROM nex.identity_merge_log WHERE array_length(enriched_fields, 1) > 0"));
  const mergeSkipped = Number(await scalar("SELECT COUNT(*) FROM nex.identity_merge_log WHERE skipped_reason IS NOT NULL"));
  const mergeCandidates = Number(await scalar("SELECT COUNT(*) FROM nex.identity_merge_log WHERE match_layer = 'name_city' AND array_length(enriched_fields, 1) IS NULL"));

  // Layer distribution
  const layerRows = (await pool.query(`
    SELECT match_layer, COUNT(*) as n
    FROM nex.identity_merge_log
    GROUP BY match_layer
    ORDER BY 1
  `)).rows;
  const layers = Object.fromEntries(layerRows.map((r) => [r.match_layer, Number(r.n)]));

  // Cycles in test window (last 15 min)
  const cyclesLast15m = (await pool.query(`
    SELECT worker_type, status, COUNT(*) as n
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '15 minutes'
      AND worker_type IN ('acquisition')
    GROUP BY worker_type, status
    ORDER BY worker_type, status
  `)).rows.map((r) => ({ worker_type: r.worker_type, status: r.status, n: Number(r.n) }));

  const snapshot = {
    at: now,
    baseline_at: baseline.captured_at,
    row_counts: { food, accom, service, mp_seller },
    deltas_vs_baseline: deltas,
    duplicate_excess_name_city: { food: foodDup, accom: accomDup },
    duplicate_excess_source_ref: { food: foodStrongDup, accom: accomStrongDup },
    merge_log: {
      total: mergeTotal,
      enriched: mergeEnriched,
      skipped_owner_verified: mergeSkipped,
      candidates_only_logged: mergeCandidates,
      by_layer: layers,
    },
    acquisition_cycles_last_15m: cyclesLast15m,
  };
  console.log(JSON.stringify(snapshot));
  await pool.end();
}

main().catch((e) => { console.error(JSON.stringify({ error: e.message, at: new Date().toISOString() })); pool.end(); process.exit(1); });

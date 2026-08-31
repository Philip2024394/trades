// scripts/nex-worker/hourly-walker-report.mjs
//
// NEX · hourly wall-clock walker findings report · Philip 2026-08-27.
//
// Fires from nex-dev-scheduler at the top of every hour. Read-only. Emits
// one JSON line per hour to data/nex-run-logs/hourly-walker-report.jsonl
// covering:
//   · row deltas per business table (last 1h, cumulative)
//   · cycles by worker_type (last 1h · completed/running/failed/aborted)
//   · outcomes by category (ALL_DEDUPED / PROVIDER_EMPTY / PROVIDER_ERROR / etc.)
//   · identity_merge_log growth (last 1h · by layer · enriched vs candidate-only)
//   · errors / zombies / stuck cycles last 1h
//   · image enrichment (business_image growth · hero_image_url coverage)
//   · missing-image backlog per card-surface table
//   · which categories were picked / silent (rotation health)
//
// One append-only JSONL row per invocation · monotonic timeline. Zero writes
// to business tables.

import pg from "pg";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

const OUT_DIR = "data/nex-run-logs";
const JSONL = `${OUT_DIR}/hourly-walker-report.jsonl`;

async function scalar(sql, params = []) {
  const r = await pool.query(sql, params);
  return Number(Object.values(r.rows[0] ?? {})[0] ?? 0);
}

async function rows(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const at = new Date().toISOString();

  // Row totals + last-hour delta per table.
  const businessTables = ["food_business", "accommodation_business", "service_business", "mp_seller"];
  const tableStats = {};
  for (const t of businessTables) {
    tableStats[t] = {
      total: await scalar(`SELECT COUNT(*) FROM nex.${t}`),
      new_last_1h: await scalar(`SELECT COUNT(*) FROM nex.${t} WHERE created_at > now() - interval '1 hour'`),
    };
  }

  // Missing-image backlog per table (for the "cards need an image" counter).
  // food/accommodation/service_business have `hero_image_url`; mp_seller has
  // `logo_image_ref` + `cover_image_ref`.
  const missingImages = {
    food_business: await scalar(`SELECT COUNT(*) FROM nex.food_business WHERE hero_image_url IS NULL OR hero_image_url = ''`),
    accommodation_business: await scalar(`SELECT COUNT(*) FROM nex.accommodation_business WHERE hero_image_url IS NULL OR hero_image_url = ''`),
    service_business: await scalar(`SELECT COUNT(*) FROM nex.service_business WHERE hero_image_url IS NULL OR hero_image_url = ''`),
    mp_seller: await scalar(`SELECT COUNT(*) FROM nex.mp_seller WHERE (logo_image_ref IS NULL OR logo_image_ref = '') AND (cover_image_ref IS NULL OR cover_image_ref = '')`),
  };

  // Image enrichment growth (business_image inserts last 1h).
  const businessImageGrowth = await scalar(`SELECT COUNT(*) FROM nex.business_image WHERE created_at > now() - interval '1 hour'`).catch(() => 0);

  // Cycles by worker_type + status (last 1h).
  const cyclesByType = await rows(`
    SELECT worker_type, status, COUNT(*)::int AS n
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '1 hour'
    GROUP BY 1, 2 ORDER BY 1, 2
  `);

  // Outcomes by category (extracted from worker_config prefix and summary).
  const outcomesByOutcome = await rows(`
    SELECT
      COALESCE(summary->>'cycle_outcome', 'unknown') AS outcome,
      COUNT(*)::int AS n
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '1 hour'
      AND status = 'completed'
    GROUP BY 1 ORDER BY 2 DESC
  `);

  // Failure / zombie / stuck.
  const failures = {
    failed_last_1h: await scalar(`SELECT COUNT(*) FROM nex.worker_cycle_run WHERE started_at > now() - interval '1 hour' AND status IN ('failed', 'failed_zombie', 'aborted')`),
    stuck_running_gt_30min: await scalar(`SELECT COUNT(*) FROM nex.worker_cycle_run WHERE status = 'running' AND started_at < now() - interval '30 minutes'`),
    provider_error_last_1h: await scalar(`SELECT COUNT(*) FROM nex.worker_cycle_run WHERE started_at > now() - interval '1 hour' AND summary->>'cycle_outcome' = 'PROVIDER_ERROR'`),
  };

  // Identity resolver activity last 1h.
  const mergeStats = {
    total_last_1h: await scalar(`SELECT COUNT(*) FROM nex.identity_merge_log WHERE merged_at > now() - interval '1 hour'`),
    enriched_last_1h: await scalar(`SELECT COUNT(*) FROM nex.identity_merge_log WHERE merged_at > now() - interval '1 hour' AND array_length(enriched_fields, 1) > 0`),
    candidate_only_last_1h: await scalar(`SELECT COUNT(*) FROM nex.identity_merge_log WHERE merged_at > now() - interval '1 hour' AND (array_length(enriched_fields, 1) IS NULL) AND match_layer = 'name_city'`),
    owner_verified_skips_last_1h: await scalar(`SELECT COUNT(*) FROM nex.identity_merge_log WHERE merged_at > now() - interval '1 hour' AND skipped_reason IS NOT NULL`),
    by_layer_last_1h: Object.fromEntries((await rows(`SELECT match_layer, COUNT(*)::int AS n FROM nex.identity_merge_log WHERE merged_at > now() - interval '1 hour' GROUP BY 1 ORDER BY 1`)).map((r) => [r.match_layer, r.n])),
  };

  // Category coverage · silent vs producing (last 1h).
  const categoryCoverage = await rows(`
    SELECT
      SPLIT_PART(worker_config, ':', 1) AS category_prefix,
      COUNT(*)::int AS cycles_last_1h
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '1 hour'
    GROUP BY 1 ORDER BY 2 DESC
  `);

  // Rotation state summary.
  const rotationState = await rows(`
    SELECT state, COUNT(*)::int AS n
    FROM nex.discovery_rotation_state
    GROUP BY state ORDER BY n DESC
  `);

  // ─── Geographic coverage axis · Philip 2026-08-30 ────────────────────
  // Category-only telemetry hid whether walkers were reaching the whole
  // Indonesian city universe. City lives in worker_cycle_run.summary->>'city'
  // (see _category-walker.mjs line 386) and as the middle token of
  // worker_config ("<slug>:<city>:<provider>"). Fall through to worker_config
  // when summary is missing so old rows still bucket.
  const cityCoverage = await rows(`
    SELECT
      COALESCE(NULLIF(summary->>'city', ''),
               NULLIF(SPLIT_PART(worker_config, ':', 2), ''),
               '(unknown)')                                AS city,
      COUNT(*)::int                                        AS cycles,
      SUM(COALESCE((summary->>'persisted_new')::int, 0))::int AS rows_added,
      COUNT(DISTINCT SPLIT_PART(worker_config, ':', 1))::int  AS distinct_categories,
      MAX(finished_at)                                     AS last_cycle_at
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '1 hour'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 30
  `);

  // Cities in the catalogue that saw ZERO cycles in the last 24h. Loaded
  // from disk so this works even if a future rotation_state table split
  // moves city ownership around. Truncated to first 60 names to keep the
  // hourly report line size sane · full list is what coverage-check.mjs
  // is for.
  let citiesZero24h = [];
  let catalogueSize = 0;
  let citiesActive24h = 0;
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const cataloguePath = join(__dir, "..", "..", "data", "nex-city-catalogue.json");
    const raw = JSON.parse(readFileSync(cataloguePath, "utf8"));
    // Canonical shape: { _doc, _schema, ..., cities: [{ canonical, province, ... }] }
    const catalogue = Array.isArray(raw.cities)
      ? raw.cities.filter((x) => x && typeof x === "object" && typeof x.canonical === "string")
      : [];
    catalogueSize = catalogue.length;
    const active = new Set((await rows(`
      SELECT DISTINCT COALESCE(NULLIF(summary->>'city', ''),
                               NULLIF(SPLIT_PART(worker_config, ':', 2), ''),
                               '(unknown)') AS city
      FROM nex.worker_cycle_run
      WHERE started_at > now() - interval '24 hours'
    `)).map((r) => r.city));
    citiesActive24h = catalogue.filter((c) => active.has(c.canonical)).length;
    citiesZero24h = catalogue
      .filter((c) => !active.has(c.canonical))
      .map((c) => c.canonical)
      .slice(0, 60);
  } catch (e) {
    // Non-fatal · continue emitting the rest of the report.
    console.warn(`city-catalogue diff failed: ${e.message}`);
  }

  // mp_seller default-jurisdiction rate · detects the false-positive coverage
  // case where marketplace rows are inflating because the persister could not
  // infer a city (see _marketplace-persister.mjs buildJurisdiction · null city
  // → 'ID/DIY/Yogyakarta'). If this rate is high the mp_seller counter is
  // lying about geographic reach.
  const mpSellerLast1h = await scalar(`SELECT COUNT(*) FROM nex.mp_seller WHERE created_at > now() - interval '1 hour'`);
  const mpSellerUnknownCity1h = await scalar(`SELECT COUNT(*) FROM nex.mp_seller WHERE created_at > now() - interval '1 hour' AND (city IS NULL OR city = '')`);
  const mpSellerUnknownCityRate1h = mpSellerLast1h > 0 ? +(mpSellerUnknownCity1h / mpSellerLast1h).toFixed(3) : 0;

  const report = {
    at,
    hour_bucket: at.slice(0, 13) + ":00:00Z",
    table_stats: tableStats,
    missing_image_backlog: missingImages,
    business_image_growth_last_1h: businessImageGrowth,
    cycles_by_worker_type_last_1h: cyclesByType,
    outcomes_last_1h: outcomesByOutcome,
    failures_last_1h: failures,
    identity_merge_log_last_1h: mergeStats,
    category_coverage_last_1h: categoryCoverage,
    rotation_state: rotationState,
    // Philip 2026-08-30 · city axis added so the ongoing question
    // "are walkers moving across all cities" is answered every hour.
    city_coverage_last_1h: cityCoverage,
    catalogue_city_count: catalogueSize,
    cities_active_24h: citiesActive24h,
    cities_zero_activity_24h: citiesZero24h,
    mp_seller_unknown_city_rate_1h: mpSellerUnknownCityRate1h,
  };

  appendFileSync(JSONL, JSON.stringify(report) + "\n");
  console.log(`hourly-walker-report · ${at} · food+${tableStats.food_business.new_last_1h} accom+${tableStats.accommodation_business.new_last_1h} service+${tableStats.service_business.new_last_1h} mp_seller+${tableStats.mp_seller.new_last_1h} · failures=${failures.failed_last_1h} · merges=${mergeStats.total_last_1h} · missing_images_food=${missingImages.food_business} · cities_active_24h=${citiesActive24h}/${catalogueSize} · mp_seller_unknown_city_rate=${mpSellerUnknownCityRate1h}`);
  await pool.end();
}

main().catch((e) => {
  console.error("hourly-walker-report failed:", e.message);
  pool.end();
  process.exit(1);
});

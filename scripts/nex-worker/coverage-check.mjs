// scripts/nex-worker/coverage-check.mjs
//
// NEX · geographic coverage check for the workforce walkers · Philip 2026-08-30.
//
// Answers ONE question conclusively:
//   "Are walkers moving across all cities and locations in Indonesia?"
//
// Reads nex.worker_cycle_run for the last 24h, buckets by city (via
// summary->>'city' with fallthrough to worker_config's middle token), diffs
// against the SINGLE SOURCE OF TRUTH city list at
// data/nex-city-catalogue.json (518 cities · 42 provinces).
//
// Emits pretty console output by default. Pass --json for a machine-readable
// artifact suitable for `data/nex-run-logs/*.jsonl` archival. Exit code:
//   0 = HEALTHY (coverage + concentration + unknown-city thresholds met)
//   1 = ANOMALY (any threshold breached)
//
// Thresholds (tunable via env or CLI):
//   MIN_CITY_COVERAGE_PCT (default 60)      — % of catalogue cities active in 24h
//   MIN_PROVINCE_COVERAGE_PCT (default 90)  — % of provinces active in 24h
//   MAX_SINGLE_CITY_CONCENTRATION_PCT (25)  — top city may not exceed % of rows
//   MAX_MP_SELLER_UNKNOWN_CITY_PCT (20)     — mp_seller null-city rate ceiling
//
// Pure read · zero writes. Wire alongside walkers-proof.mjs in nightly CI.

import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

const cli = new Set(process.argv.slice(2));
const asJson = cli.has("--json");

const T = {
  MIN_CITY_COVERAGE_PCT:      Number(process.env.MIN_CITY_COVERAGE_PCT ?? 60),
  MIN_PROVINCE_COVERAGE_PCT:  Number(process.env.MIN_PROVINCE_COVERAGE_PCT ?? 90),
  MAX_SINGLE_CITY_CONCENTRATION_PCT: Number(process.env.MAX_SINGLE_CITY_CONCENTRATION_PCT ?? 25),
  MAX_MP_SELLER_UNKNOWN_CITY_PCT: Number(process.env.MAX_MP_SELLER_UNKNOWN_CITY_PCT ?? 20),
};

async function scalar(sql, params = []) {
  const r = await pool.query(sql, params);
  return Number(Object.values(r.rows[0] ?? {})[0] ?? 0);
}
async function rows(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

function loadCatalogue() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const p = join(__dir, "..", "..", "data", "nex-city-catalogue.json");
  const raw = JSON.parse(readFileSync(p, "utf8"));
  // Canonical shape: { _doc, _schema, ..., cities: [{ canonical, province, ... }] }
  const list = Array.isArray(raw.cities)
    ? raw.cities.filter((x) => x && typeof x === "object" && typeof x.canonical === "string")
    : [];
  const byCity = new Map(list.map((c) => [c.canonical, c]));
  const provinces = new Set(list.map((c) => c.province || c.admin1 || "(unknown-province)"));
  return { list, byCity, provinces };
}

async function main() {
  const catalogue = loadCatalogue();
  const cataloguedCities = catalogue.list.length;
  const cataloguedProvinces = catalogue.provinces.size;

  // ─── City × row activity in last 24h ───────────────────────────────
  const cityRowsQ = await rows(`
    SELECT
      COALESCE(NULLIF(summary->>'city', ''),
               NULLIF(SPLIT_PART(worker_config, ':', 2), ''),
               '(unknown)') AS city,
      COUNT(*)::int         AS cycles,
      SUM(COALESCE((summary->>'persisted_new')::int, 0))::int AS rows_added,
      COUNT(DISTINCT SPLIT_PART(worker_config, ':', 1))::int  AS distinct_categories,
      MAX(finished_at)      AS last_cycle_at
    FROM nex.worker_cycle_run
    WHERE started_at > now() - interval '24 hours'
    GROUP BY 1
    ORDER BY cycles DESC
  `);

  const activeCities = new Set(cityRowsQ.map((r) => r.city).filter((c) => c && c !== "(unknown)"));
  const activeCatalogueCities = catalogue.list.filter((c) => activeCities.has(c.canonical));
  const inactiveCatalogueCities = catalogue.list.filter((c) => !activeCities.has(c.canonical));

  const activeProvinces = new Set(activeCatalogueCities.map((c) => c.province || c.admin1 || "(unknown-province)"));
  const inactiveProvinces = [...catalogue.provinces].filter((p) => !activeProvinces.has(p));

  // Concentration · what % of total rows_added does the top city account for?
  const totalRowsAdded = cityRowsQ.reduce((n, r) => n + Number(r.rows_added || 0), 0);
  const topRowsCity = [...cityRowsQ].sort((a, b) => (b.rows_added || 0) - (a.rows_added || 0))[0];
  const topCityConcentrationPct = totalRowsAdded > 0 && topRowsCity
    ? +(100 * (topRowsCity.rows_added || 0) / totalRowsAdded).toFixed(1)
    : 0;

  // Unknown-city cycle rows (leakage · worker_cycle_run without a city stamp)
  const unknownCityCycles = cityRowsQ.find((r) => r.city === "(unknown)")?.cycles ?? 0;
  const totalCycles = cityRowsQ.reduce((n, r) => n + r.cycles, 0);
  const unknownCityCyclePct = totalCycles > 0 ? +(100 * unknownCityCycles / totalCycles).toFixed(1) : 0;

  // mp_seller inflation check
  const mpTotal1h = await scalar(`SELECT COUNT(*) FROM nex.mp_seller WHERE created_at > now() - interval '1 hour'`);
  const mpUnknown1h = await scalar(`SELECT COUNT(*) FROM nex.mp_seller WHERE created_at > now() - interval '1 hour' AND (city IS NULL OR city = '')`);
  const mpUnknownRate1hPct = mpTotal1h > 0 ? +(100 * mpUnknown1h / mpTotal1h).toFixed(1) : 0;

  // Verdicts
  const cityCoveragePct = cataloguedCities > 0 ? +(100 * activeCatalogueCities.length / cataloguedCities).toFixed(1) : 0;
  const provinceCoveragePct = cataloguedProvinces > 0 ? +(100 * activeProvinces.size / cataloguedProvinces).toFixed(1) : 0;

  const failures = [];
  if (cityCoveragePct < T.MIN_CITY_COVERAGE_PCT) failures.push(`city_coverage ${cityCoveragePct}% < ${T.MIN_CITY_COVERAGE_PCT}%`);
  if (provinceCoveragePct < T.MIN_PROVINCE_COVERAGE_PCT) failures.push(`province_coverage ${provinceCoveragePct}% < ${T.MIN_PROVINCE_COVERAGE_PCT}%`);
  if (topCityConcentrationPct > T.MAX_SINGLE_CITY_CONCENTRATION_PCT) failures.push(`top_city_concentration ${topCityConcentrationPct}% > ${T.MAX_SINGLE_CITY_CONCENTRATION_PCT}%`);
  if (mpUnknownRate1hPct > T.MAX_MP_SELLER_UNKNOWN_CITY_PCT) failures.push(`mp_seller_unknown_city ${mpUnknownRate1hPct}% > ${T.MAX_MP_SELLER_UNKNOWN_CITY_PCT}%`);

  const status = failures.length === 0 ? "HEALTHY" : "ANOMALY";

  const artifact = {
    at: new Date().toISOString(),
    status,
    failures,
    thresholds: T,
    catalogue: { cities: cataloguedCities, provinces: cataloguedProvinces },
    coverage: {
      cities_active_24h: activeCatalogueCities.length,
      city_coverage_pct: cityCoveragePct,
      provinces_active_24h: activeProvinces.size,
      province_coverage_pct: provinceCoveragePct,
      inactive_provinces: inactiveProvinces,
      inactive_city_count: inactiveCatalogueCities.length,
      inactive_cities_sample: inactiveCatalogueCities.slice(0, 40).map((c) => c.canonical),
    },
    concentration: {
      total_rows_added_24h: totalRowsAdded,
      top_city: topRowsCity ? { city: topRowsCity.city, rows_added: topRowsCity.rows_added, cycles: topRowsCity.cycles } : null,
      top_city_concentration_pct: topCityConcentrationPct,
      unknown_city_cycle_pct: unknownCityCyclePct,
    },
    mp_seller_inflation: {
      total_new_1h: mpTotal1h,
      unknown_city_1h: mpUnknown1h,
      unknown_city_rate_pct: mpUnknownRate1hPct,
    },
    top_10_cities: [...cityRowsQ]
      .sort((a, b) => (b.rows_added || 0) - (a.rows_added || 0))
      .slice(0, 10)
      .map((r) => ({ city: r.city, cycles: r.cycles, rows_added: r.rows_added, distinct_categories: r.distinct_categories })),
  };

  if (asJson) {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    const ok = (b) => b ? "✅" : "❌";
    console.log(`\nNEX walker coverage · ${artifact.at} · status=${status}`);
    console.log("─".repeat(72));
    console.log(`${ok(cityCoveragePct >= T.MIN_CITY_COVERAGE_PCT)} cities active / catalogue    ${activeCatalogueCities.length} / ${cataloguedCities}    (${cityCoveragePct}% · floor ${T.MIN_CITY_COVERAGE_PCT}%)`);
    console.log(`${ok(provinceCoveragePct >= T.MIN_PROVINCE_COVERAGE_PCT)} provinces active / catalogue  ${activeProvinces.size} / ${cataloguedProvinces}      (${provinceCoveragePct}% · floor ${T.MIN_PROVINCE_COVERAGE_PCT}%)`);
    console.log(`${ok(topCityConcentrationPct <= T.MAX_SINGLE_CITY_CONCENTRATION_PCT)} top-city concentration        ${topCityConcentrationPct}%    (ceiling ${T.MAX_SINGLE_CITY_CONCENTRATION_PCT}%${topRowsCity ? ` · ${topRowsCity.city}` : ""})`);
    console.log(`${ok(mpUnknownRate1hPct <= T.MAX_MP_SELLER_UNKNOWN_CITY_PCT)} mp_seller unknown-city rate   ${mpUnknownRate1hPct}%    (ceiling ${T.MAX_MP_SELLER_UNKNOWN_CITY_PCT}% · last hour)`);
    console.log(`   unknown-city cycles           ${unknownCityCyclePct}%    (rows without city stamp)`);
    console.log(`   total rows added last 24h     ${totalRowsAdded}`);
    console.log("─".repeat(72));

    console.log(`\nTop 10 cities by rows added (24h):`);
    for (const r of artifact.top_10_cities) {
      console.log(`  ${String(r.city).padEnd(28)} rows=${String(r.rows_added).padStart(6)} · cycles=${String(r.cycles).padStart(4)} · cats=${r.distinct_categories}`);
    }

    if (inactiveProvinces.length) {
      console.log(`\nProvinces with ZERO cycles (24h):`);
      console.log("  " + inactiveProvinces.join(", "));
    }

    if (inactiveCatalogueCities.length) {
      console.log(`\nCities with ZERO cycles (24h) · ${inactiveCatalogueCities.length} of ${cataloguedCities} · first 20:`);
      console.log("  " + inactiveCatalogueCities.slice(0, 20).map((c) => c.canonical).join(", "));
    }

    if (failures.length) {
      console.log(`\n${ok(false)} FAILING THRESHOLDS:`);
      for (const f of failures) console.log(`   · ${f}`);
    } else {
      console.log(`\n${ok(true)} All coverage thresholds passed.`);
    }
  }

  await pool.end();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("coverage-check failed:", e.message);
  pool.end();
  process.exit(2);
});

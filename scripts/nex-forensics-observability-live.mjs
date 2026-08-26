// scripts/nex-forensics-observability-live.mjs
// Prove what loadCityCategoryObservability returns for the 13 cities.
// If the SQL is broken, this errors. If it's fine, we see the totals.
import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const DIRECTORY_CATEGORIES = ["food","accommodation","market","transport"];
const TBL = { food:"nex.food_business", accommodation:"nex.accommodation_business", market:"nex.mp_seller", transport:"nex.transport_acquisition_record" };

// 1) Combos in rotation_state
const combos = (await pool.query(`
  SELECT DISTINCT city, category FROM nex.discovery_rotation_state
  WHERE category = ANY($1::text[]) ORDER BY city, category`,
  [DIRECTORY_CATEGORIES])).rows;

console.log(`Distinct (city, category) combos in rotation_state: ${combos.length}`);

// 2) Latest cycle per combo (mirroring loadCityCategoryObservability SQL)
const latest = await pool.query(`
  SELECT DISTINCT ON (city, category)
    split_part(worker_config,':',2) AS city,
    split_part(worker_config,':',1) AS category,
    started_at, status, records_processed, records_new,
    (summary->'provider_results'->0->>'provider') AS provider,
    (summary->'provider_results'->0->>'status')   AS provider_status,
    NULLIF(summary->'provider_results'->0->>'returned','')::int AS provider_returned,
    NULLIF(summary->'discovery_stats'->>'records_persisted','')::int AS persisted,
    NULLIF(summary->'discovery_stats'->>'candidates_examined','')::int AS candidates,
    NULLIF(summary->'scoring_stats'->>'matched_exact','')::int AS matched_exact,
    NULLIF(summary->'scoring_stats'->>'matched_high','')::int  AS matched_high
  FROM nex.worker_cycle_run
  WHERE worker_type='acquisition' AND started_at >= now() - interval '48 hours'
    AND split_part(worker_config,':',1) = ANY($1::text[])
  ORDER BY city, category, started_at DESC`,
  [DIRECTORY_CATEGORIES]);
const byKey = new Map(latest.rows.map((r) => [`${r.city}:${r.category}`, r]));

// 3) Per-(city, category) directory total from real business tables
const totals = {};
for (const cat of DIRECTORY_CATEGORIES) {
  const r = await pool.query(`SELECT city, count(*)::int AS n FROM ${TBL[cat]} GROUP BY city`);
  totals[cat] = new Map(r.rows.filter((x) => x.city).map((x) => [x.city, x.n]));
}

console.log(`\n${"CITY".padEnd(14)} ${"CATEGORY".padEnd(15)} ${"STATUS".padEnd(10)} PROC MATCHED NEW SAVED DIRECTORY  PROV`);
console.log("-".repeat(110));
for (const c of combos) {
  const L = byKey.get(`${c.city}:${c.category}`);
  const dir = totals[c.category]?.get(c.city) ?? 0;
  const matched = (L?.matched_exact ?? 0) + (L?.matched_high ?? 0);
  console.log(
    `${c.city.padEnd(14)} ${c.category.padEnd(15)} ${(L?.status ?? '—').padEnd(10)} ` +
    `${String(L?.candidates ?? L?.records_processed ?? '—').padStart(4)} ` +
    `${String(matched || '—').padStart(7)} ` +
    `${String(L?.records_new ?? '—').padStart(3)} ` +
    `${String(L?.persisted ?? L?.records_new ?? '—').padStart(5)} ` +
    `${String(dir).padStart(9)}  ${L?.provider ?? ''}`
  );
}

await pool.end();

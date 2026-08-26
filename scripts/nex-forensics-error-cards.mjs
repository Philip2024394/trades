// scripts/nex-forensics-error-cards.mjs
//
// P0 · 2026-08-24 · Forensic investigation of 🟠 Error cards on /discovery.
//
// Reads the actual latest cycle per (city, category) from nex.worker_cycle_run
// and prints the raw error text so Philip can see exactly WHY each card shows
// Error. Read-only. No mutations.

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });

const COMBOS = [
  ["Bantul",       "transport"],
  ["Gunungkidul",  "transport"],
  ["Klaten",       "transport"],
  ["Kulon Progo",  "transport"],
  ["Semarang",     "transport"],
  ["Sleman",       "transport"],
  ["Yogyakarta",   "transport"],
  ["Solo",         "market"],
  ["Yogyakarta",   "market"],
];

const CITY_TABLE = {
  food:          "nex.food_business",
  accommodation: "nex.accommodation_business",
  market:        "nex.mp_seller",
  transport:     "nex.transport_acquisition_record",
};

const banner = (t) => `\n${"═".repeat(78)}\n  ${t}\n${"═".repeat(78)}`;

async function latestCycleFor(city, category) {
  // Match on split_part like observability helper does. City segment must match
  // the city name written into worker_config (transport/market walkers write
  // city name second segment).
  const r = await pool.query(
    `SELECT id, worker_config, status, started_at, finished_at,
            records_processed, records_new, errors_count, duration_ms,
            summary->>'unexpected_error'                  AS unexpected_error,
            summary->'provider_results'->0->>'provider'   AS primary_provider,
            summary->'provider_results'                   AS provider_results,
            summary->'discovery_stats'                    AS discovery_stats,
            summary->'reconciler_reason'                  AS reconciler_reason,
            audit_report_path
       FROM nex.worker_cycle_run
      WHERE worker_type='acquisition'
        AND split_part(worker_config,':',1) = $1
        AND split_part(worker_config,':',2) = $2
      ORDER BY started_at DESC
      LIMIT 1`,
    [category, city],
  );
  return r.rows[0] ?? null;
}

async function directoryTotal(city, category) {
  const tbl = CITY_TABLE[category];
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM ${tbl} WHERE city=$1`,
    [city],
  );
  return r.rows[0]?.n ?? 0;
}

async function lastSuccessfulSave(city, category) {
  const r = await pool.query(
    `SELECT started_at, finished_at, records_new,
            NULLIF(summary->'discovery_stats'->>'records_persisted','')::int AS persisted
       FROM nex.worker_cycle_run
      WHERE worker_type='acquisition'
        AND status='completed'
        AND split_part(worker_config,':',1) = $1
        AND split_part(worker_config,':',2) = $2
        AND COALESCE(NULLIF(summary->'discovery_stats'->>'records_persisted','')::int, records_new, 0) > 0
      ORDER BY started_at DESC
      LIMIT 1`,
    [category, city],
  );
  return r.rows[0] ?? null;
}

async function providerErrorHistogram(city, category, hours = 48) {
  const r = await pool.query(
    `SELECT summary->>'unexpected_error' AS err,
            count(*) AS n
       FROM nex.worker_cycle_run
      WHERE worker_type='acquisition'
        AND started_at >= now() - ($3::text || ' hours')::interval
        AND split_part(worker_config,':',1) = $1
        AND split_part(worker_config,':',2) = $2
        AND summary->>'unexpected_error' IS NOT NULL
      GROUP BY 1 ORDER BY n DESC LIMIT 5`,
    [category, city, String(hours)],
  );
  return r.rows;
}

console.log(banner(`Error-card forensics · ${new Date().toISOString()}`));

for (const [city, category] of COMBOS) {
  const [latest, dirTotal, lastGood, hist] = await Promise.all([
    latestCycleFor(city, category),
    directoryTotal(city, category),
    lastSuccessfulSave(city, category),
    providerErrorHistogram(city, category, 48),
  ]);

  console.log(banner(`${city} · ${category}`));
  console.log(`Directory total (persisted rows in table):  ${dirTotal}`);
  if (lastGood) {
    console.log(`Last productive cycle: ${lastGood.started_at?.toISOString?.() ?? lastGood.started_at}` +
                ` · persisted=${lastGood.persisted ?? lastGood.records_new}`);
  } else {
    console.log(`Last productive cycle: NONE`);
  }
  if (!latest) {
    console.log(`Latest cycle:          NONE FOUND`);
    continue;
  }
  console.log(`Latest cycle @ ${latest.started_at?.toISOString?.() ?? latest.started_at}`);
  console.log(`  worker_config:      ${latest.worker_config}`);
  console.log(`  status:             ${latest.status}`);
  console.log(`  errors_count:       ${latest.errors_count}`);
  console.log(`  duration_ms:        ${latest.duration_ms}`);
  console.log(`  processed:          ${latest.records_processed}`);
  console.log(`  records_new:        ${latest.records_new}`);
  console.log(`  primary_provider:   ${latest.primary_provider ?? "(none)"}`);
  console.log(`  reconciler_reason:  ${latest.reconciler_reason ?? "(none)"}`);
  console.log(`  unexpected_error:   ${latest.unexpected_error ?? "(none)"}`);
  if (latest.provider_results) {
    console.log(`  provider_results:   ${JSON.stringify(latest.provider_results)}`);
  }
  if (latest.discovery_stats) {
    console.log(`  discovery_stats:    ${JSON.stringify(latest.discovery_stats)}`);
  }
  if (hist.length) {
    console.log(`  48h error histogram:`);
    for (const h of hist) console.log(`    ${h.n.toString().padStart(3)} × ${h.err}`);
  }
}

await pool.end();

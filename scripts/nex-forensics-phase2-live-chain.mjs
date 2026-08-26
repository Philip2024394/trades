// scripts/nex-forensics-phase2-live-chain.mjs
//
// P0 · 2026-08-24 · Phase 2 live acceptance observation.
//
// Proves (or honestly reports the gap on) the full chain per new city:
//   NEW CITY → ORCHESTRATOR PICK → WALKER CYCLE → PERSISTED ROW → HQ DIRECTORY COUNT
//
// Read-only. No mutations. No side effects on the workforce.
//
// Usage: node scripts/nex-forensics-phase2-live-chain.mjs [--label=BEFORE|AFTER]

import pg from "pg";
const { Pool } = pg;
const url = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new Pool({ connectionString: url });
const CUTOVER_8 = "2026-08-24 10:41:47+00";
const NEW_CITIES = ["Jakarta", "Denpasar", "Surabaya", "Bandung", "Semarang"];
const label = process.argv.find((a) => a.startsWith("--label="))?.split("=")[1] ?? "SNAPSHOT";
const banner = (t) => `\n${"═".repeat(72)}\n  ${t}\n${"═".repeat(72)}`;
const pretty = (r) => console.log(JSON.stringify(r, null, 2));
async function q(sql, params = []) {
  try { return (await pool.query(sql, params)).rows; }
  catch (e) { return [{ __query_error: e.message }]; }
}

console.log(banner(`Phase 2 live chain observation · ${label} @ ${new Date().toISOString()}`));
console.log(`Cutover 8 boundary: ${CUTOVER_8} · new cities: ${NEW_CITIES.join(", ")}`);

// ── §1 · Per-new-city chain evidence ─────────────────────────────────
console.log(banner("§1 · Per-new-city chain · pick → cycle → persist → directory count"));
for (const city of NEW_CITIES) {
  const [picks, cycles, food, accom, market, transport] = await Promise.all([
    q(`SELECT count(*) AS n FROM nex.discovery_orchestrator_pick
        WHERE city=$1 AND picked_at >= $2::timestamptz`, [city, CUTOVER_8]),
    q(`SELECT worker_config, status, records_processed, records_new,
              EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::int AS age_or_dur
         FROM nex.worker_cycle_run
        WHERE worker_type='acquisition' AND started_at >= $2::timestamptz
          AND worker_config ILIKE $1
        ORDER BY started_at DESC`, [`%:${city}:%`, CUTOVER_8]),
    q(`SELECT count(*) AS n FROM nex.food_business WHERE city=$1`, [city]),
    q(`SELECT count(*) AS n FROM nex.accommodation_business WHERE city=$1`, [city]),
    q(`SELECT count(*) AS n FROM nex.mp_seller WHERE city=$1`, [city]),
    q(`SELECT count(*) AS n FROM nex.transport_acquisition_record WHERE city=$1`, [city]).catch(() => [{ n: 0 }]),
  ]);
  pretty([{
    city,
    picked_since_cutover8: Number(picks[0]?.n ?? 0),
    cycles_since_cutover8: cycles.length,
    cycles_detail: cycles,
    directory_row_counts: {
      food:          Number(food[0]?.n ?? 0),
      accommodation: Number(accom[0]?.n ?? 0),
      market:        Number(market[0]?.n ?? 0),
      transport:     Number(transport[0]?.n ?? 0),
    },
  }]);
}

// ── §2 · Old-city loop invariants ────────────────────────────────────
console.log(banner("§2 · Old-city loop invariants"));
pretty(await q(`
  SELECT
    -- Saturation protection · post-saturation cycles per surface
    (SELECT count(*) FROM nex.discovery_rotation_state s
       JOIN nex.worker_cycle_run w
         ON split_part(w.worker_config,':',1) = s.category
        AND split_part(w.worker_config,':',2) = s.city
       WHERE s.state='saturated' AND s.surface != 'default'
         AND w.started_at > s.state_entered_at
         AND w.started_at >= $1::timestamptz)                              AS post_saturation_cycles,
    -- Orphan bypass · cycles that started with no orchestrator pick backing
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= $1::timestamptz)
    - (SELECT count(*) FROM nex.discovery_orchestrator_pick
         WHERE picked_at >= $1::timestamptz)                                 AS orphan_bypass,
    -- Serialization errors
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
         AND summary->>'unexpected_error' ILIKE 'could not serialize%')    AS serialization_errors,
    -- Autonomous reconciler activity
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE status='aborted' AND finished_at >= $1::timestamptz
         AND summary->>'reconciler_reason'='exceeded_configured_timeout')  AS zombies_reconciled,
    -- Market slug fix · non-Yogyakarta legacy-format cycles still emitted?
    (SELECT count(*) FROM nex.worker_cycle_run
       WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
         AND (worker_config LIKE 'market:yogyakarta-city:%'
              OR worker_config LIKE 'market:central-java-%'))                AS legacy_market_worker_configs
`, [CUTOVER_8]));

// ── §3 · Non-Yogya prambanan leak sentinel ───────────────────────────
console.log(banner("§3 · Non-Yogyakarta prambanan leak sentinel"));
pretty(await q(`
  SELECT count(*) AS non_yogya_prambanan_leaks_since_cutover8
    FROM nex.worker_cycle_run
   WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
     AND worker_config LIKE '%prambanan%'
     AND worker_config NOT LIKE '%Yogyakarta%'`,
  [CUTOVER_8],
));

// ── §4 · SKIP_DUPLICATE storm sentinel ───────────────────────────────
// SKIP_DUPLICATE inside walker doesn't produce a cycle row · we detect
// by comparing orchestrator picks to actual cycles created.
console.log(banner("§4 · SKIP_DUPLICATE storm sentinel · picks vs cycle creations by combo"));
pretty(await q(`
  WITH picks AS (
    SELECT city, category, count(*) AS picks
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at >= $1::timestamptz
     GROUP BY city, category
  ),
  cycles AS (
    SELECT split_part(worker_config,':',2) AS city_token,
           split_part(worker_config,':',1) AS category,
           count(*) AS cycles
      FROM nex.worker_cycle_run
     WHERE worker_type='acquisition' AND started_at >= $1::timestamptz
     GROUP BY 1, 2
  )
  SELECT p.city, p.category, p.picks,
         COALESCE(c.cycles, 0) AS actual_cycles,
         p.picks - COALESCE(c.cycles, 0) AS skip_duplicates_estimate
    FROM picks p
    LEFT JOIN cycles c ON c.city_token = p.city OR c.city_token = replace(lower(p.city),' ','-')
   WHERE (p.picks - COALESCE(c.cycles, 0)) > 0
   ORDER BY skip_duplicates_estimate DESC LIMIT 20`,
  [CUTOVER_8],
));

// ── §5 · Current picker view ─────────────────────────────────────────
console.log(banner("§5 · Current in-flight cycles + new-city rotation state"));
pretty(await q(`
  SELECT worker_config, EXTRACT(EPOCH FROM (now() - started_at))::int AS age_s
    FROM nex.worker_cycle_run
   WHERE finished_at IS NULL AND status='running' AND worker_type='acquisition'
   ORDER BY started_at`,
));
pretty(await q(`
  SELECT city, category, surface, state, state_entered_at
    FROM nex.discovery_rotation_state
   WHERE city = ANY($1::text[])
   ORDER BY city, category`,
  [NEW_CITIES],
));

// ── §6 · Directory count snapshot per category for all 13 cities ─────
console.log(banner("§6 · Full directory count snapshot (all 13 cities × 4 categories)"));
pretty(await q(`
  SELECT 'food' AS category, city, count(*) AS rows FROM nex.food_business GROUP BY city
  UNION ALL
  SELECT 'accommodation', city, count(*) FROM nex.accommodation_business GROUP BY city
  UNION ALL
  SELECT 'market', city, count(*) FROM nex.mp_seller GROUP BY city
  UNION ALL
  SELECT 'transport', city, count(*) FROM nex.transport_acquisition_record GROUP BY city
  ORDER BY category, rows DESC`,
));

await pool.end();
console.log(banner(`END · ${label}`));

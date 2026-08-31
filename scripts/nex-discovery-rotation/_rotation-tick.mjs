#!/usr/bin/env node
// scripts/nex-discovery-rotation/_rotation-tick.mjs
//
// NEX Discovery Rotation tick worker (2026-08-24 MVP).
//
// Fires from scripts/nex-dev-scheduler.mjs every 10 minutes.
//
// Purpose: reads recent nex.worker_cycle_run history · recomputes rotation
// state per (city, category, round) · upserts nex.discovery_rotation_state.
//
// MVP scope: state INFORMATIONAL · this tick does NOT spawn walker child
// processes · existing individual walker cron entries continue firing on
// their fixed schedules. Auto-spawn based on state is a next-session unit.
//
// Doctrine anchor: project_nex_discovery_rotation_controller_2026_08_24

import pg from "pg";
import { fileURLToPath } from "node:url";
import {
  cooldownHoursFor,
  computeCooldownUntil,
  assessReactivationOutcome,
} from "./_reactivation-policy.mjs";
import { isSaturationCountable } from "../nex-worker/persistence-contract.mjs";

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 3 });

// 2026-08-24 · Phase 1 refactor · TRACKED_CITIES derived from the shared
// data/nex-city-catalogue.json (loaded via the shared catalogue loader).
// Adding a city = one entry in the JSON · this file automatically picks it up.
import { trackedCityNames } from "../nex-city-catalogue/loader.mjs";
// Workforce Phase 1 (Philip 2026-08-27) · new category-jobs loaded from
// data/nex-job-registry.json. Legacy categories (food/accommodation/market/
// transport) stay untouched · new job categories are ADDED · both coexist.
import { jobCategorySlugs, allJobs } from "../nex-workforce/_job-registry.mjs";
const LEGACY_CATEGORIES = ["accommodation", "food", "transport", "market"];
const JOB_CATEGORIES = jobCategorySlugs();
const WALKED_CATEGORIES = [...LEGACY_CATEGORIES, ...JOB_CATEGORIES];
const TRACKED_CITIES = trackedCityNames();

// 2026-08-24 · P0 atomic · surface-aware. MUST mirror src/lib/nex-hq/discovery-rotation.ts.
const YOGYAKARTA_FOOD_SURFACES = ["prambanan", "sleman-north", "bantul-south", "klaten-east", "gamping-west"];
const YOGYAKARTA_ACCOMMODATION_SURFACES = ["malioboro", "prawirotaman", "kaliurang", "borobudur", "yogya-wider"];
function citySlug(c) { return c.toLowerCase().replace(/\s+/g, "-"); }
function surfacesFor(city, category) {
  if (category === "market")    return ["nominatim"];
  if (category === "transport") return ["query-universe-v1"];
  if (city === "Yogyakarta") {
    if (category === "food")          return YOGYAKARTA_FOOD_SURFACES;
    if (category === "accommodation") return YOGYAKARTA_ACCOMMODATION_SURFACES;
  }
  // Workforce Phase 1 · new category jobs use provider name as the surface.
  // Enables future multi-provider expansion per category (e.g. 'overpass' +
  // 'wikipedia' + 'own-website') as independent rotation state rows.
  if (JOB_CATEGORIES.includes(category)) {
    // Each strategy provider becomes a distinct surface · Phase 1 = 'overpass'.
    const job = allJobs().find((j) => j.category_slug === category);
    const providers = [...new Set(job.strategies.map((s) => s.provider))];
    return providers;
  }
  return [citySlug(city)];
}

function workItems() {
  const items = [];
  for (const city of TRACKED_CITIES) {
    for (const category of WALKED_CATEGORIES) {
      let workerAvailable = false;
      if (LEGACY_CATEGORIES.includes(category) || JOB_CATEGORIES.includes(category)) {
        workerAvailable = true;
      }
      // 2026-08-24 · P0 atomic · one work-item per SURFACE. Rotation tick now
      // evaluates saturation independently per (city, category, surface).
      for (const surface of surfacesFor(city, category)) {
        let workerConfigLike = null;
        if (category === "market") {
          // Market walker configs today: `market:{cityToken}:nominatim` where cityToken
          // is either citySlug OR the legacy `central-java-{slug}` form. We match on
          // (category, city) prefix and the specific surface suffix.
          workerConfigLike = `market:${citySlug(city)}:${surface}`;
        } else if (category === "transport") {
          workerConfigLike = `transport:${city}:${surface}`;
        } else if (JOB_CATEGORIES.includes(category)) {
          // Phase 1 workforce · worker_config = `<slug>:<City>:<surface>`.
          workerConfigLike = `${category}:${city}:${surface}`;
        } else {
          // food / accommodation
          workerConfigLike = `${category}:${city}:${surface}`;
        }
        items.push({ city, category, surface, workerAvailable, workerConfigLike });
      }
    }
  }
  return items;
}

// Constants MUST match src/lib/nex-hq/discovery-rotation.ts
const SATURATION_THRESHOLD_CYCLES = 3;

// ── State evaluator · reactivation policy P3 (Philip 2026-08-26) ──────
//
// State machine:
//   build --(3 consecutive zero cycles)--> saturated (set cooldown_until)
//   saturated + cooldown_until IS NULL --> saturated (backfill cooldown, reason='cooldown-defaulted')
//   saturated + NOW >= cooldown_until --> reactivate (reason='cooldown-expired', reactivation_count++)
//   reactivate + cycle-since-reactivation productive --> build (consecutive_unproductive_reactivations = 0)
//   reactivate + cycle-since-reactivation zero --> build (consecutive_unproductive_reactivations++)
//   reactivate + no cycle yet --> reactivate (wait)
//
// Cooldown duration follows _reactivation-policy.mjs · doubles after 3
// consecutive unproductive reactivations · reset on any productive cycle.
export function evaluate(cyclesNewestFirst, existing, category, nowMs = Date.now()) {
  const currentState = existing?.state ?? null;
  const stateEnteredAt = existing?.state_entered_at ? new Date(existing.state_entered_at).getTime() : null;
  const cooldownUntil = existing?.cooldown_until ? new Date(existing.cooldown_until).getTime() : null;
  const reactivationReason = existing?.reactivation_reason ?? null;
  const reactivationCount = existing?.reactivation_count ?? 0;
  const consecutiveUnproductive = existing?.consecutive_unproductive_reactivations ?? 0;

  const base = {
    consecutiveZero: 0,
    totalLast: null, newLast: null, lastStarted: null, lastProductiveAt: null,
    reactivationCount,
    consecutiveUnproductiveReactivations: consecutiveUnproductive,
    reactivationReason,
    cooldownUntil: cooldownUntil ? new Date(cooldownUntil) : null,
  };

  if (cyclesNewestFirst.length === 0) {
    return { state: currentState ?? "build", reason: "no cycle history yet", ...base };
  }

  const latest = cyclesNewestFirst[0];
  base.totalLast = latest.records_processed ?? 0;
  base.newLast = latest.records_new ?? 0;
  base.lastStarted = latest.started_at;

  // Filter out both:
  //   · failed cycles (infrastructural noise · never counted historically)
  //   · PROVIDER_ERROR / FATAL cycles (P5 addition · Philip 2026-08-26)
  //     A provider outage should not consume a saturation attempt.
  const saturationCountable = cyclesNewestFirst.filter(
    (c) => c.status === "completed" && isSaturationCountable(c.cycle_outcome)
  );
  let consecutiveZero = 0;
  for (const c of saturationCountable) {
    if ((c.records_new ?? 0) === 0) consecutiveZero += 1;
    else break;
  }
  base.consecutiveZero = consecutiveZero;
  const productive = saturationCountable.find((c) => (c.records_new ?? 0) > 0);
  base.lastProductiveAt = productive ? productive.started_at : null;

  // ── Backfill · saturated with no cooldown ────────────────────────────
  // Existing pre-P3 saturated rows have cooldown_until IS NULL. Give them
  // an explicit cooldown so they enter the reactivation loop naturally.
  if (currentState === "saturated" && !cooldownUntil) {
    const cd = computeCooldownUntil(category, consecutiveUnproductive, new Date(nowMs));
    return {
      state: "saturated",
      reason: `cooldown backfilled · was NULL · now ${cooldownHoursFor(category, consecutiveUnproductive)}h from now`,
      ...base,
      reactivationReason: "cooldown-defaulted",
      cooldownUntil: cd,
    };
  }

  // ── Auto-transition · saturated → reactivate when cooldown expires ──
  if (currentState === "saturated" && cooldownUntil && nowMs >= cooldownUntil) {
    return {
      state: "reactivate",
      reason: `cooldown expired · promoted to reactivate (attempt #${reactivationCount + 1})`,
      ...base,
      reactivationReason: "cooldown-expired",
      reactivationCount: reactivationCount + 1,
      cooldownUntil: null,   // clear until next saturation
    };
  }

  // ── Sliding-cooldown fix · Philip 2026-08-27 ─────────────────────────
  // If a surface is already saturated AND cooldown is still in the
  // future, preserve the existing cooldown_until unchanged. Without this
  // pass-through, the "fresh saturation" branch below fires on every tick
  // (because saturated surfaces trivially satisfy consecutiveZero >= 3)
  // and refreshes cooldown_until to now()+6h — a sliding timer that
  // never expires. The 6h policy is correct; the mistake was restarting
  // the timer every time the controller looked at the surface.
  //
  // Evidence: at 2026-08-27T23:02Z, all 34 food+accom surfaces had
  // cooldown_until = last_evaluated_at + 6h exactly, regardless of
  // state_entered_at (which ranged from 2 days to 5h ago). No surface
  // had entered "reactivate" for >5h. Fix keeps the cooldown anchored
  // to the moment saturation actually began.
  if (currentState === "saturated" && cooldownUntil && nowMs < cooldownUntil) {
    return {
      state: "saturated",
      reason: `cooldown active until ${new Date(cooldownUntil).toISOString()} · no change`,
      ...base,
      // cooldownUntil already preserved via ...base (line ~108)
    };
  }

  // ── Reactivate state · check if a cycle has run since ────────────────
  if (currentState === "reactivate") {
    const cyclesSinceReactivation = stateEnteredAt
      ? cyclesNewestFirst.filter((c) => new Date(c.started_at).getTime() > stateEnteredAt)
      : [];
    if (cyclesSinceReactivation.length === 0) {
      return { state: "reactivate", reason: "awaiting first cycle after reactivation", ...base };
    }
    // Assess whether that first post-reactivation cycle was productive.
    const firstSince = cyclesSinceReactivation[cyclesSinceReactivation.length - 1];
    const outcome = assessReactivationOutcome({
      reactivationReason,
      consecutiveUnproductive,
      lastCycleRecordsNew: firstSince.records_new ?? 0,
      hasCycleSinceReactivation: true,
    });
    return {
      state: "build",
      reason: (firstSince.records_new ?? 0) > 0
        ? `reactivate produced ${firstSince.records_new} new · promote to build · unproductive counter reset`
        : `reactivate produced 0 · consecutive_unproductive = ${outcome.newConsecutive} · promote to build`,
      ...base,
      consecutiveUnproductiveReactivations: outcome.newConsecutive,
      reactivationReason: null,  // consumed
      cooldownUntil: null,
    };
  }

  // ── Fresh saturation from build/maintenance ──────────────────────────
  if (consecutiveZero >= SATURATION_THRESHOLD_CYCLES) {
    const cd = computeCooldownUntil(category, consecutiveUnproductive, new Date(nowMs));
    const cdHours = cooldownHoursFor(category, consecutiveUnproductive);
    return {
      state: "saturated",
      reason: `${consecutiveZero} consecutive zero-new · saturated · cooldown ${cdHours}h${consecutiveUnproductive >= 3 ? " (2× backoff after 3 unproductive)" : ""}`,
      ...base,
      cooldownUntil: cd,
      reactivationReason: null,
    };
  }

  // ── Productive build cycle ───────────────────────────────────────────
  if (base.newLast > 0) {
    return {
      state: "build",
      reason: `latest cycle produced ${base.newLast} new · reset unproductive counter`,
      ...base,
      consecutiveUnproductiveReactivations: 0,   // any productive cycle resets
      reactivationReason: null,
      cooldownUntil: null,
    };
  }

  // ── Below threshold · continue current state ─────────────────────────
  return {
    state: currentState === "maintenance" ? "maintenance" : "build",
    reason: `${consecutiveZero} zero-new · below saturation threshold`,
    ...base,
    cooldownUntil: null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  NEX DISCOVERY ROTATION TICK · state refresh · 2026-08-24                 ║");
  console.log("║  Reads worker_cycle_run history · upserts discovery_rotation_state        ║");
  console.log("║  MVP · does NOT spawn walkers · walkers continue on their own schedule    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");

  const items = workItems();
  let evaluated = 0;
  let upserted = 0;
  const stateCounts = { build: 0, saturated: 0, maintenance: 0, reactivate: 0 };

  for (const wi of items) {
    if (!wi.workerAvailable) continue;

    // 2026-08-24 · P0 atomic · surface-aware · query cycles for the EXACT
    // (category, city, surface) worker_config, not a broad LIKE across all
    // surfaces. Each surface now evaluated independently.
    // 2026-08-26 · P5 · also fetch cycle_outcome to filter PROVIDER_ERROR
    // and FATAL out of saturation counting (per Philip's P4 finding).
    const cycles = await pool.query(
      `SELECT id, started_at, finished_at, records_processed, records_new, status,
              summary->>'cycle_outcome' AS cycle_outcome
         FROM nex.worker_cycle_run
        WHERE worker_config = $1
        ORDER BY started_at DESC
        LIMIT 20`,
      [wi.workerConfigLike],
    );

    // Load current state row for this (city, category, surface, round=1).
    // P3 (2026-08-26) also loads cooldown_until, reactivation_count,
    // consecutive_unproductive_reactivations so the evaluator can auto-
    // transition saturated → reactivate when cooldown expires.
    const existing = await pool.query(
      `SELECT state, state_entered_at, reactivation_reason, cooldown_until,
              reactivation_count, consecutive_unproductive_reactivations
         FROM nex.discovery_rotation_state
        WHERE city=$1 AND category=$2 AND surface=$3 AND round=1
        LIMIT 1`,
      [wi.city, wi.category, wi.surface],
    );
    const existingRow = existing.rows[0] ?? null;
    const currentState = existingRow?.state ?? null;

    const evalResult = evaluate(cycles.rows, existingRow, wi.category);
    evaluated += 1;
    stateCounts[evalResult.state] = (stateCounts[evalResult.state] ?? 0) + 1;

    const stateChanged = currentState !== evalResult.state;
    const nowIso = new Date().toISOString();
    const stateEnteredIso = stateChanged ? nowIso : (existingRow?.state_entered_at ? new Date(existingRow.state_entered_at).toISOString() : nowIso);
    const cooldownIso = evalResult.cooldownUntil ? evalResult.cooldownUntil.toISOString() : null;

    await pool.query(
      `INSERT INTO nex.discovery_rotation_state
         (city, category, surface, round, state, consecutive_zero_new_cycles,
          total_records_last_cycle, records_new_last_cycle,
          last_cycle_started_at, last_productive_at, last_evaluated_at,
          state_entered_at, next_action_hint, updated_at,
          cooldown_until, reactivation_count, reactivation_reason,
          consecutive_unproductive_reactivations)
       VALUES ($1, $2, $3, 1, $4::nex.discovery_rotation_state_kind, $5, $6, $7, $8, $9, now(), $10, $11, now(),
               $12, $13, $14, $15)
       ON CONFLICT (city, category, surface, round) DO UPDATE SET
         state = EXCLUDED.state,
         consecutive_zero_new_cycles = EXCLUDED.consecutive_zero_new_cycles,
         total_records_last_cycle = EXCLUDED.total_records_last_cycle,
         records_new_last_cycle = EXCLUDED.records_new_last_cycle,
         last_cycle_started_at = EXCLUDED.last_cycle_started_at,
         last_productive_at = COALESCE(EXCLUDED.last_productive_at, nex.discovery_rotation_state.last_productive_at),
         last_evaluated_at = EXCLUDED.last_evaluated_at,
         state_entered_at = CASE WHEN nex.discovery_rotation_state.state <> EXCLUDED.state THEN EXCLUDED.state_entered_at ELSE nex.discovery_rotation_state.state_entered_at END,
         next_action_hint = EXCLUDED.next_action_hint,
         updated_at = now(),
         cooldown_until = EXCLUDED.cooldown_until,
         reactivation_count = EXCLUDED.reactivation_count,
         reactivation_reason = EXCLUDED.reactivation_reason,
         consecutive_unproductive_reactivations = EXCLUDED.consecutive_unproductive_reactivations`,
      [
        wi.city, wi.category, wi.surface, evalResult.state, evalResult.consecutiveZero,
        evalResult.totalLast, evalResult.newLast, evalResult.lastStarted, evalResult.lastProductiveAt,
        stateEnteredIso, evalResult.reason,
        cooldownIso, evalResult.reactivationCount, evalResult.reactivationReason,
        evalResult.consecutiveUnproductiveReactivations,
      ],
    );
    upserted += 1;
    const cdSuffix = cooldownIso ? ` cd=${cooldownIso.slice(11, 19)}Z` : "";
    const rrSuffix = evalResult.reactivationReason ? ` reason=${evalResult.reactivationReason}` : "";
    console.log(`  ${wi.city.padEnd(14)} ${wi.category.padEnd(14)} ${wi.surface.padEnd(18)} ${evalResult.state.padEnd(12)} zero=${evalResult.consecutiveZero} last=${evalResult.newLast ?? 0} new · rc=${evalResult.reactivationCount} up=${evalResult.consecutiveUnproductiveReactivations}${cdSuffix}${rrSuffix} · ${evalResult.reason}`);
  }

  console.log("\n── ROTATION TICK SUMMARY ──");
  console.log(`  combos evaluated : ${evaluated}`);
  console.log(`  combos upserted  : ${upserted}`);
  console.log(`  by state         : build=${stateCounts.build} · saturated=${stateCounts.saturated} · maintenance=${stateCounts.maintenance} · reactivate=${stateCounts.reactivate}`);
  console.log(`  runtime          : ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await pool.end();
}

// Only run main() when invoked as a CLI · lets tests import evaluate()
// without opening a DB pool or running the tick.
const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

#!/usr/bin/env node
// scripts/nex-discovery-orchestrator/_orchestrator-tick.mjs
//
// NEX Auto Walker Orchestrator · tick worker (2026-08-24).
//
// Doctrine anchor: project_nex_auto_walker_orchestrator_2026_08_24
//
// Fires from scripts/nex-dev-scheduler.mjs every 5 minutes when
// NEX_ORCHESTRATOR_ENABLED=true. Otherwise logs disabled state and exits.
//
// Behaviour when enabled:
//   1. Loads rotation state + work-item registry
//   2. Reads currently-running worker_cycle_run rows (in-flight tracking)
//   3. Reads recent orchestrator picks (fairness tracking)
//   4. Builds queue via buildDiscoveryQueue-style logic (inline copy)
//   5. If a slot is free, spawns the picked walker as a detached child
//   6. Records the pick for fairness

import pg from "pg";
import { spawn } from "node:child_process";

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const ORCH_ENABLED = process.env.NEX_ORCHESTRATOR_ENABLED === "true";
const MAX_SLOTS = 10;                       // Stage 10 (2026-08-24) · MUST match src/lib/nex-hq/auto-orchestrator.ts
const FAIRNESS_CONSECUTIVE_CAP = 2;         // MUST match same file
// Phase 1a dedup freeze · Philip 2026-08-27. Comma-separated category slugs.
// When set, orchestrator skips these categories entirely (no work items generated,
// no picks, no spawns). Reversible: clear the env var. Doctrine anchor:
// project_nex_dedup_and_identity_resolution_doctrine_2026_08_27.md.
//
// 2026-08-28 · Philip approved (Fix A · Walker Yield Diagnosis) · food +
// accommodation legacy categories are now DEFAULT-paused because they walk
// Yogyakarta bboxes only, produce 100% ALL_DEDUPED, and waste Overpass budget.
// New job-registry categories restaurants/cafes/hotels/guesthouses walk all
// 13 Indonesian cities and do the same job cleanly. Env override still wins
// (set NEX_ORCHESTRATOR_PAUSED_CATEGORIES to any value — even empty — to
// take control back).
const DEFAULT_PAUSED_CATEGORIES = "food,accommodation";
const PAUSED_CATEGORIES = new Set(
  (process.env.NEX_ORCHESTRATOR_PAUSED_CATEGORIES ?? DEFAULT_PAUSED_CATEGORIES)
    .split(",").map((s) => s.trim()).filter(Boolean),
);
// Per-vertical concurrency cap · Chief Architect 2026-08-26. MUST match
// src/lib/nex-hq/auto-orchestrator.ts::PER_VERTICAL_CONCURRENCY. Evidence:
// 78% of failed cycles come from transport walkers competing for
// nominatim-public's 1 rps single-choke via 5-min lease timeout. Cap
// transport to 1 concurrent walker · verticals absent are uncapped.
const PER_VERTICAL_CONCURRENCY = Object.freeze({ transport: 1 });
const FAIRNESS_LOOKBACK_MINUTES = 60;       // recent picks considered "recent"

const pool = new pg.Pool({ connectionString: NEX_POSTGRES_URL, max: 3 });

// Work-item registry · MUST mirror src/lib/nex-hq/discovery-rotation.ts.
// 2026-08-24 · Phase 1 refactor · TRACKED_CITIES derived from the shared
// data/nex-city-catalogue.json. One JSON entry = one new city in rotation.
import { trackedCityNames } from "../nex-city-catalogue/loader.mjs";
// Workforce Phase 1 (Philip 2026-08-27) · new category-jobs from the shared
// Job Registry (data/nex-job-registry.json). Legacy categories preserved.
import { jobCategorySlugs, allJobs } from "../nex-workforce/_job-registry.mjs";
const LEGACY_CATEGORIES = ["accommodation", "food", "transport", "market"];
const JOB_CATEGORIES = jobCategorySlugs();
const WALKED_CATEGORIES = [...LEGACY_CATEGORIES, ...JOB_CATEGORIES];
const TRACKED_CITIES = trackedCityNames();

function workItems() {
  const items = [];
  // 2026-08-24 · P0 atomic · surface enumerator · MUST mirror
  // src/lib/nex-hq/discovery-rotation.ts (kept inline · .mjs cannot import .ts).
  const YOGYAKARTA_FOOD_SURFACES = ["prambanan", "sleman-north", "bantul-south", "klaten-east", "gamping-west"];
  const YOGYAKARTA_ACCOMMODATION_SURFACES = ["malioboro", "prawirotaman", "kaliurang", "borobudur", "yogya-wider"];
  const citySlug = (c) => c.toLowerCase().replace(/\s+/g, "-");
  const jobList = allJobs();
  const surfacesFor = (city, category) => {
    if (category === "market")    return ["nominatim"];
    if (category === "transport") return ["query-universe-v1"];
    if (city === "Yogyakarta") {
      if (category === "food")          return YOGYAKARTA_FOOD_SURFACES;
      if (category === "accommodation") return YOGYAKARTA_ACCOMMODATION_SURFACES;
    }
    // Phase 1 workforce · one surface per unique provider in the job's strategies.
    if (JOB_CATEGORIES.includes(category)) {
      const job = jobList.find((j) => j.category_slug === category);
      return [...new Set(job.strategies.map((s) => s.provider))];
    }
    return [citySlug(city)];
  };

  for (const city of TRACKED_CITIES) {
    for (const category of WALKED_CATEGORIES) {
      // Phase 1a dedup freeze · Philip 2026-08-27. Categories in the paused
      // set are excluded from the work-item registry entirely so the picker
      // cannot select them and no walker spawns. Zero row is generated in
      // discovery_orchestrator_pick for paused categories, keeping the audit
      // trail clean. Reversible: unset NEX_ORCHESTRATOR_PAUSED_CATEGORIES.
      if (PAUSED_CATEGORIES.has(category)) continue;
      let script = null;
      let workerAvailable = false;
      if (category === "market") {
        workerAvailable = true;
        script = "scripts/nex-shop/_market-walker-discover.mjs";
      } else if (category === "transport") {
        workerAvailable = true;
        script = "scripts/nex-transport-acquisition/_transport-walker-cycle.mjs";
      } else if (category === "food" || category === "accommodation") {
        workerAvailable = true;
        script = "scripts/nex-acquisition/run-live-cycle.mjs";
      } else if (JOB_CATEGORIES.includes(category)) {
        // Phase 1 workforce · one generic walker serves all category jobs.
        workerAvailable = true;
        script = "scripts/nex-workforce/_category-walker.mjs";
      }
      // 2026-08-24 · P0 atomic · one work item PER SURFACE. Rotation state now
      // tracks saturation per surface · a saturated surface for a (city,
      // category) doesn't block other surfaces of the same combo.
      for (const surface of surfacesFor(city, category)) {
        let workerConfigExpected = null;
        let spawnArgs = null;
        if (category === "market") {
          workerConfigExpected = `market:${citySlug(city)}:${surface}`;
          spawnArgs = [`--city=${city}`];
        } else if (category === "transport") {
          workerConfigExpected = `transport:${city}:${surface}`;
          spawnArgs = [`--city=${city}`];
        } else if (category === "food") {
          workerConfigExpected = `food:${city}:${surface}`;
          spawnArgs = [`--vertical=food`, `--city=${city}`, `--bbox=${surface}`, `--apply`];
        } else if (category === "accommodation") {
          workerConfigExpected = `accommodation:${city}:${surface}`;
          spawnArgs = [`--vertical=accommodation`, `--city=${city}`, `--bbox=${surface}`, `--apply`];
        } else if (JOB_CATEGORIES.includes(category)) {
          // Phase 1 workforce · walker infers strategy from job registry by category slug.
          workerConfigExpected = `${category}:${city}:${surface}`;
          spawnArgs = [`--category=${category}`, `--city=${city}`];
        }
        items.push({ city, category, surface, workerAvailable, script, workerConfigExpected, spawnArgs });
      }
    }
  }
  return items;
}

async function loadRotationSnapshot() {
  // 2026-08-24 · P0 atomic · include surface column.
  const r = await pool.query(`
    SELECT city, category, surface, round, state, last_cycle_started_at, last_productive_at,
           consecutive_zero_new_cycles, records_new_last_cycle
      FROM nex.discovery_rotation_state
     ORDER BY city, category, surface
  `);
  return r.rows;
}

async function loadInFlight(workItemsList) {
  // Any worker_cycle_run currently 'running' with a config matching any known combo.
  // In-flight is tracked at (city, category) grain · one walker process per combo
  // regardless of surface (walker's isAlreadyRunning guard).
  const r = await pool.query(`
    SELECT id, worker_config, started_at
      FROM nex.worker_cycle_run
     WHERE status='running' AND started_at > now() - interval '2 hours'
  `);
  const out = [];
  for (const row of r.rows) {
    const cfg = String(row.worker_config ?? "");
    for (const wi of workItemsList) {
      // Match by (category, city) prefix · ignore surface for in-flight since
      // one walker cycle blocks all surfaces of the combo.
      const comboPrefix = wi.category === "market"
        ? `market:${wi.city.toLowerCase().replace(/\s+/g, "-")}:`
        : `${wi.category}:${wi.city}:`;
      if (cfg.startsWith(comboPrefix)) {
        out.push({ cycleId: row.id, city: wi.city, category: wi.category, startedAt: row.started_at });
        break;
      }
    }
  }
  return out;
}

async function loadRecentPicks() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nex.discovery_orchestrator_pick (
      pick_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      city text NOT NULL, category text NOT NULL,
      picked_at timestamptz NOT NULL DEFAULT now(),
      script text, note text
    )
  `);
  // 2026-08-24 · P0 atomic · add surface column (nullable so historical rows OK).
  await pool.query(`ALTER TABLE nex.discovery_orchestrator_pick ADD COLUMN IF NOT EXISTS surface text`);
  const r = await pool.query(`
    SELECT city, category, picked_at
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at > now() - interval '${FAIRNESS_LOOKBACK_MINUTES} minutes'
     ORDER BY picked_at ASC
     LIMIT 20
  `);
  return r.rows.map((r) => ({ city: r.city, category: r.category, pickedAt: r.picked_at }));
}

// Phase Ca (Philip 2026-08-27 · walkers-never-stuck doctrine). Category-level
// fairness: return the most-recent pick timestamp PER CATEGORY over the last
// FAIRNESS_LOOKBACK_MINUTES. Categories NOT in the map have not been picked
// recently and get priority in the sort tiebreak. This unsticks starved
// categories (retail-*, guesthouses, hotels, etc.) whose (city, category)
// surfaces get monopolised by the (state × timestamp) sort.
async function loadCategoryFreshness() {
  const r = await pool.query(`
    SELECT category, MAX(picked_at) AS latest
      FROM nex.discovery_orchestrator_pick
     WHERE picked_at > now() - interval '${FAIRNESS_LOOKBACK_MINUTES} minutes'
     GROUP BY category
  `);
  const m = new Map();
  for (const row of r.rows) m.set(row.category, new Date(row.latest).getTime());
  return m;
}

// Priority scoring · MUST match src/lib/nex-hq/auto-orchestrator.ts
// Philip 2026-08-30 · saturated raised from 0 → 5 so saturated combos are
// still WORK-eligible (never permanently locked out). Build/reactivate/
// maintenance still win the queue; saturated cities get walked once
// higher-priority work is exhausted, honoring the "all locations always
// active · free to walk any area" doctrine.
function priority(state) {
  return { reactivate: 40, build: 30, maintenance: 20, saturated: 5 }[state] ?? 0;
}

// Philip 2026-08-30 · "all locations must be active when walkers start walking".
// Defaults to true. Set NEX_WALKER_SKIP_SATURATED=1 to restore the old
// behavior (permanently skip saturated combos · pre-2026-08-30 default).
const ALL_LOCATIONS_ALWAYS_ACTIVE = process.env.NEX_WALKER_SKIP_SATURATED !== "1";

function buildQueue(snapshot, workItemsList, inFlight, recentPicks, categoryFreshness) {
  // 2026-08-24 · P0 atomic · state keyed at surface grain now.
  const stateByKey = new Map(snapshot.map((s) => [`${s.city}:${s.category}:${s.surface}`, s]));
  // In-flight remains at (city, category) grain · one walker per combo.
  const inFlightKeys = new Set(inFlight.map((f) => `${f.city}:${f.category}`));

  // Per-vertical in-flight count (Chief Architect 2026-08-26 · transport lease cap).
  const inFlightByVertical = new Map();
  for (const f of inFlight) {
    inFlightByVertical.set(f.category, (inFlightByVertical.get(f.category) ?? 0) + 1);
  }

  // Fairness cap remains at (city, category) grain · surface-level cap would
  // starve single-surface combos.
  const consecutive = new Map();
  if (recentPicks.length > 0) {
    let i = recentPicks.length - 1;
    const lastKey = `${recentPicks[i].city}:${recentPicks[i].category}`;
    let count = 0;
    while (i >= 0) {
      const key = `${recentPicks[i].city}:${recentPicks[i].category}`;
      if (key !== lastKey) break;
      count += 1; i -= 1;
    }
    consecutive.set(lastKey, count);
  }

  const items = workItemsList.map((wi) => {
    const surfKey = `${wi.city}:${wi.category}:${wi.surface}`;
    const comboKey = `${wi.city}:${wi.category}`;
    const st = stateByKey.get(surfKey);
    const state = st?.state ?? "build";
    let status, reason;
    if (!wi.workerAvailable) {
      status = "skipped-not-city-configurable"; reason = "walker not city-configurable";
    } else if (inFlightKeys.has(comboKey)) {
      status = "in-flight"; reason = "currently running";
    } else if (state === "saturated" && !ALL_LOCATIONS_ALWAYS_ACTIVE) {
      status = "skipped-saturated"; reason = `surface ${wi.surface} saturated (${st?.consecutive_zero_new_cycles ?? 0} zero-new streak) · restore by unsetting NEX_WALKER_SKIP_SATURATED`;
    } else if (PER_VERTICAL_CONCURRENCY[wi.category] !== undefined
            && (inFlightByVertical.get(wi.category) ?? 0) >= PER_VERTICAL_CONCURRENCY[wi.category]) {
      status = "waiting-vertical-cap";
      reason = `vertical ${wi.category} at concurrency cap ${PER_VERTICAL_CONCURRENCY[wi.category]} · avoids nominatim lease starvation`;
    } else if ((consecutive.get(comboKey) ?? 0) >= FAIRNESS_CONSECUTIVE_CAP) {
      status = "waiting-cooldown"; reason = `fairness cap · combo picked ${consecutive.get(comboKey)}× in a row`;
    } else {
      status = "eligible"; reason = `eligible · surface ${wi.surface}`;
    }
    return {
      wi, state, status, reason,
      priorityScore: priority(state),
      lastCycleStartedAt: st?.last_cycle_started_at ?? null,
      // Phase Ca · category freshness (Philip 2026-08-27 walkers-never-stuck).
      // A category never picked in FAIRNESS_LOOKBACK_MINUTES → 0 (top priority).
      // A category picked recently → its most-recent pick ms (older = wins tiebreak).
      categoryLastPickMs: categoryFreshness.get(wi.category) ?? 0,
    };
  });

  items.sort((a, b) => {
    const orderRank = { "would-pick": 0, "in-flight": 1, eligible: 2, "waiting-cooldown": 3, "waiting-vertical-cap": 3, "skipped-saturated": 4, "skipped-gated-provider": 5, "skipped-not-city-configurable": 6 };
    const rs = (orderRank[a.status] ?? 9) - (orderRank[b.status] ?? 9);
    if (rs !== 0) return rs;
    const p = b.priorityScore - a.priorityScore;
    if (p !== 0) return p;
    // Phase Ca · CATEGORY-level freshness beats surface-level freshness. A
    // category that hasn't been picked in the last FAIRNESS_LOOKBACK_MINUTES
    // (categoryLastPickMs=0) wins over a category actively being cycled. This
    // is the specific fix for the retail-*/hotels/guesthouses/salons/dentists
    // starvation observed 2026-08-27T13:19Z after the full unpause.
    if (a.categoryLastPickMs !== b.categoryLastPickMs) {
      return a.categoryLastPickMs - b.categoryLastPickMs;
    }
    const aMs = a.lastCycleStartedAt ? new Date(a.lastCycleStartedAt).getTime() : 0;
    const bMs = b.lastCycleStartedAt ? new Date(b.lastCycleStartedAt).getTime() : 0;
    return aMs - bMs;
  });

  const idx = items.findIndex((i) => i.status === "eligible");
  if (idx >= 0) items[idx].status = "would-pick";
  return items;
}

async function recordPick(item) {
  await pool.query(
    `INSERT INTO nex.discovery_orchestrator_pick (city, category, surface, script, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [item.wi.city, item.wi.category, item.wi.surface, item.wi.script, item.reason],
  );
}

function spawnWalker(item) {
  console.log(`   → spawning ${item.wi.script} for ${item.wi.city} / ${item.wi.category} / ${item.wi.surface}`);
  const child = spawn("node", [item.wi.script, ...(item.wi.spawnArgs ?? [])], {
    env: process.env,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.unref();
}

async function main() {
  const started = Date.now();
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  NEX AUTO WALKER ORCHESTRATOR TICK · 2026-08-24                           ║");
  console.log(`║  Env gate: NEX_ORCHESTRATOR_ENABLED=${(process.env.NEX_ORCHESTRATOR_ENABLED ?? "").padEnd(6)}                              ║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");

  if (!ORCH_ENABLED) {
    console.log("  Orchestrator disabled · set NEX_ORCHESTRATOR_ENABLED=true to activate");
    console.log("  Existing walker scheduler entries continue firing on their own schedule.");
    await pool.end();
    return;
  }

  const wis = workItems();
  const snapshot = await loadRotationSnapshot();
  const inFlight = await loadInFlight(wis);
  const recentPicks = await loadRecentPicks();
  const categoryFreshness = await loadCategoryFreshness();
  const queue = buildQueue(snapshot, wis, inFlight, recentPicks, categoryFreshness);

  const counts = { "would-pick": 0, "in-flight": 0, eligible: 0, "waiting-cooldown": 0, "skipped-saturated": 0, "skipped-not-city-configurable": 0 };
  for (const q of queue) counts[q.status] = (counts[q.status] ?? 0) + 1;

  console.log(`\n  In-flight: ${inFlight.length} / ${MAX_SLOTS}`);
  console.log(`  Queue: would-pick=${counts["would-pick"]} · in-flight=${counts["in-flight"]} · eligible=${counts.eligible} · waiting=${counts["waiting-cooldown"]} · saturated=${counts["skipped-saturated"]} · unavailable=${counts["skipped-not-city-configurable"]}`);

  const freeSlots = Math.max(0, MAX_SLOTS - inFlight.length);
  if (freeSlots === 0) {
    console.log("  Slots full · waiting for current walkers to finish.");
    await pool.end();
    return;
  }

  // Multi-slot pick (Phase A · 2026-08-24). Prefer diverse cities on same tick
  // for per-tick fairness. Provider Rate Governor serialises actual Nominatim
  // requests across all spawned children · workforce capacity != request rate.
  const eligible = queue.filter((q) => q.status === "would-pick" || q.status === "eligible");
  const picked = [];
  const pickedKeys = new Set();
  const pickedCities = new Set();
  const alternativeCityAvailable = new Set(eligible.map((i) => i.wi.city)).size > 1;
  for (const it of eligible) {
    if (picked.length >= freeSlots) break;
    const key = `${it.wi.city}:${it.wi.category}`;
    if (pickedKeys.has(key)) continue;
    if (alternativeCityAvailable && pickedCities.has(it.wi.city)) continue;
    picked.push(it); pickedKeys.add(key); pickedCities.add(it.wi.city);
  }
  if (picked.length < freeSlots) {
    for (const it of eligible) {
      if (picked.length >= freeSlots) break;
      const key = `${it.wi.city}:${it.wi.category}`;
      if (pickedKeys.has(key)) continue;
      picked.push(it); pickedKeys.add(key);
    }
  }

  if (picked.length === 0) {
    console.log("  No eligible work · all combos saturated/in-flight/waiting.");
    await pool.end();
    return;
  }

  console.log(`  Spawning ${picked.length} walker${picked.length === 1 ? "" : "s"} this tick (freeSlots=${freeSlots}):`);
  for (const p of picked) {
    await recordPick(p);
    spawnWalker(p);
  }
  console.log(`  ✓ ${picked.length} spawned in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

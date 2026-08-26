// src/lib/nex-hq/discovery-rotation.ts
//
// NEX Discovery Rotation Controller · CONSTITUTIONAL (2026-08-24).
//
// Doctrine anchor: project_nex_discovery_rotation_controller_2026_08_24
//
// Central rotation state model + evaluator + picker. Runs at HQ + inside the
// rotation tick worker. Pure functions where possible · one thin DB adapter
// for reads/writes. The lib does NOT spawn walker child processes in this
// MVP · it makes state EVALUABLE and DECISIONS ADDRESSABLE. Spawning is a
// separate concern deferred to the next architectural pass.

export type RotationStateKind = "build" | "saturated" | "maintenance" | "reactivate";

// Threshold for transition to SATURATED. Kept modest so a genuinely
// exhausted combo stops being hammered quickly · large enough that random
// zero-cycles from provider hiccups don't flip a healthy combo prematurely.
export const SATURATION_THRESHOLD_CYCLES = 3;

// 2026-08-26 · P3 reactivation policy (Philip approved cooldowns).
// TS mirror of scripts/nex-discovery-rotation/_reactivation-policy.mjs · runtime
// is authoritative · these values MUST stay in sync (test in this file's siblings
// enforces via constant comparison).
export const COOLDOWN_HOURS_BY_CATEGORY: Readonly<Record<string, number>> = Object.freeze({
  food:          6,
  accommodation: 6,
  transport:     6,
  market:       12,
});
export const DEFAULT_COOLDOWN_HOURS         = 6;
export const UNPRODUCTIVE_BACKOFF_THRESHOLD = 3;
export const UNPRODUCTIVE_BACKOFF_MULTIPLIER = 2;

/** TS-side mirror of the cooldown formula · used by HQ dashboards to render
 *  countdown timers. Runtime is authoritative for actual state transitions. */
export function cooldownHoursFor(category: string, consecutiveUnproductive = 0): number {
  const base = COOLDOWN_HOURS_BY_CATEGORY[category] ?? DEFAULT_COOLDOWN_HOURS;
  return consecutiveUnproductive >= UNPRODUCTIVE_BACKOFF_THRESHOLD
    ? base * UNPRODUCTIVE_BACKOFF_MULTIPLIER
    : base;
}

/** TS-side mirror of the P5 saturation-counter filter (Philip 2026-08-26 P4 finding).
 *  Cycles with cycle_outcome=PROVIDER_ERROR or FATAL are infrastructural noise and
 *  must NOT count toward consecutive_zero_new_cycles. Runtime enforces this in
 *  scripts/nex-discovery-rotation/_rotation-tick.mjs. */
const INFRASTRUCTURAL_NOISE_OUTCOMES = new Set(["PROVIDER_ERROR", "FATAL"]);
export function isSaturationCountable(cycleOutcome: string | null | undefined): boolean {
  if (!cycleOutcome) return true;   // legacy pre-Phase-1 cycles count
  return !INFRASTRUCTURAL_NOISE_OUTCOMES.has(cycleOutcome);
}

// DEPRECATED · retained for backward-compat with any HQ code that reads it.
// The 72h maintenance cooldown was the pre-P3 design · replaced by per-category
// cooldown_until timestamps (see COOLDOWN_HOURS_BY_CATEGORY above).
export const MAINTENANCE_COOLDOWN_HOURS = 72;

// Categories NEX currently walks (has a live walker script). Any (city, category)
// combo referencing a category not in this set will have `walkerAvailable=false`.
export const WALKED_CATEGORIES = ["accommodation", "food", "transport", "market"] as const;
export type WalkedCategory = typeof WALKED_CATEGORIES[number];

// 2026-08-24 · Phase 1 refactor · TRACKED_CITIES now DERIVED from the single
// source of truth (data/nex-city-catalogue.json via CITY_REGISTRY). Adding a
// city is one edit in the JSON · every rotation surface, every walker, every
// picker automatically sees the new city on next tick. No manual mirror sync.
import { CITY_REGISTRY } from "@/lib/nex/city-registry";
export const TRACKED_CITIES: readonly string[] = CITY_REGISTRY.map((c) => c.canonical);
export type TrackedCity = string;

// Work-item registry · maps (city, category) → walker-script + args.
// `walkerAvailable=false` combos surface honestly on HQ as "walker not yet
// city-configurable" · they never fake activity.
export interface WorkItem {
  city: string;
  category: WalkedCategory;
  walkerAvailable: boolean;      // true when a walker actually exists for this combo
  script?: string;               // e.g. "scripts/nex-shop/_market-walker-discover.mjs"
  workerConfigLikePrefix?: string; // e.g. "market:%" to match cycle_run rows
  note?: string;
  // 2026-08-24 · P0 atomic · list of discovery surfaces this walker can
  // execute for this (city, category). Non-Yogyakarta cities: single city
  // slug. Yogyakarta food/accommodation: 5 hand-tuned zone slugs. Market:
  // ['nominatim']. Transport: ['query-universe-v1']. Rotation state tracks
  // saturation independently per surface · the combo is fully exhausted only
  // when ALL surfaces saturate simultaneously.
  surfaces: string[];
}

// 2026-08-24 · P0 atomic · Yogyakarta's hand-tuned zone names live in
// scripts/nex-acquisition/configs/{food,accommodation}-yogyakarta.mjs. Mirrored
// here so the rotation controller can enumerate per-surface state without a
// runtime import cycle. Kept in sync via tests in this file's siblings.
const YOGYAKARTA_FOOD_SURFACES = ["prambanan", "sleman-north", "bantul-south", "klaten-east", "gamping-west"];
const YOGYAKARTA_ACCOMMODATION_SURFACES = ["malioboro", "prawirotaman", "kaliurang", "borobudur", "yogya-wider"];

function citySlug(city: string): string {
  return city.toLowerCase().replace(/\s+/g, "-");
}

/** All discovery surfaces available for a (city, category) combo. */
export function surfacesFor(city: string, category: WalkedCategory): string[] {
  if (category === "market")       return ["nominatim"];
  if (category === "transport")    return ["query-universe-v1"];
  if (city === "Yogyakarta") {
    if (category === "food")          return YOGYAKARTA_FOOD_SURFACES;
    if (category === "accommodation") return YOGYAKARTA_ACCOMMODATION_SURFACES;
  }
  // Non-Yogyakarta food/accommodation · single honest surface named after city slug.
  return [citySlug(city)];
}

export function buildWorkItemRegistry(): WorkItem[] {
  const items: WorkItem[] = [];
  for (const city of TRACKED_CITIES) {
    for (const category of WALKED_CATEGORIES) {
      let walkerAvailable = false;
      let script: string | undefined;
      let workerConfigLikePrefix: string | undefined;
      let note: string | undefined;

      if (category === "market") {
        walkerAvailable = true;
        script = "scripts/nex-shop/_market-walker-discover.mjs";
        workerConfigLikePrefix = `market:${citySlug(city)}%`;
      } else if (category === "transport") {
        walkerAvailable = true;
        script = "scripts/nex-transport-acquisition/_transport-walker-cycle.mjs";
        workerConfigLikePrefix = `transport:${city}:%`;
      } else if (category === "food") {
        walkerAvailable = true;
        script = "scripts/nex-acquisition/run-live-cycle.mjs";
        workerConfigLikePrefix = `food:${city}:%`;
      } else if (category === "accommodation") {
        walkerAvailable = true;
        script = "scripts/nex-acquisition/run-live-cycle.mjs";
        workerConfigLikePrefix = `accommodation:${city}:%`;
      } else {
        note = "Walker not yet city-configurable for this combo";
      }

      const surfaces = surfacesFor(city, category);
      items.push({ city, category, walkerAvailable, script, workerConfigLikePrefix, note, surfaces });
    }
  }
  return items;
}

// ── State evaluator (pure) ─────────────────────────────────────────────

export interface CycleSummary {
  cycleId?: string;
  startedAt: Date;
  finishedAt: Date | null;
  recordsProcessed: number | null;
  recordsNew: number | null;
  status: string;   // 'completed' · 'failed' · 'running' · etc.
  // 2026-08-26 · P5 · cycle_outcome from Phase 1 rejection telemetry. When
  // present, isSaturationCountable() filters PROVIDER_ERROR/FATAL out of the
  // consecutive-zero counter.
  cycleOutcome?: string | null;
}

export interface EvaluationResult {
  state: RotationStateKind;
  reason: string;
  consecutiveZeroNewCycles: number;
  lastProductiveAt: Date | null;
  totalRecordsLastCycle: number | null;
  recordsNewLastCycle: number | null;
  lastCycleStartedAt: Date | null;
}

/**
 * Evaluate a rotation state from a chronological cycle history · most-recent-
 * first. Uses only what's honestly in the history · never invents state.
 *
 * @param cyclesNewestFirst  array of cycles sorted DESC by started_at
 * @param currentState       existing state (if any) · lets us honor cooldown transitions
 * @param stateEnteredAt     when the current state was entered (for cooldown timing)
 */
export function evaluateRotationState(
  cyclesNewestFirst: CycleSummary[],
  currentState: RotationStateKind | null = null,
  stateEnteredAt: Date | null = null,
): EvaluationResult {
  if (cyclesNewestFirst.length === 0) {
    return {
      state: currentState ?? "build",
      reason: "no cycle history yet · assume build until evidence otherwise",
      consecutiveZeroNewCycles: 0,
      lastProductiveAt: null,
      totalRecordsLastCycle: null,
      recordsNewLastCycle: null,
      lastCycleStartedAt: null,
    };
  }

  const latest = cyclesNewestFirst[0];
  const totalRecordsLastCycle = latest.recordsProcessed ?? 0;
  const recordsNewLastCycle   = latest.recordsNew ?? 0;
  const lastCycleStartedAt    = latest.startedAt;

  // Failed cycles are NOT saturation signals · they're infrastructural noise
  // (Philip 2026-08-24: "A failure should record the failure · avoid counting
  // the cycle as productive · allow another eligible work item to run").
  // 2026-08-26 · P5 · also filter PROVIDER_ERROR / FATAL cycle_outcomes so
  // upstream provider outages don't consume saturation attempts (matches
  // scripts/nex-discovery-rotation/_rotation-tick.mjs behavior).
  const saturationCountable = cyclesNewestFirst.filter(
    (c) => c.status === "completed" && isSaturationCountable(c.cycleOutcome ?? null)
  );

  // Count consecutive zero-new saturation-countable cycles from the top.
  let consecutiveZero = 0;
  for (const c of saturationCountable) {
    if ((c.recordsNew ?? 0) === 0) consecutiveZero += 1;
    else break;
  }

  // Find the most recent productive cycle.
  const productive = saturationCountable.find((c) => (c.recordsNew ?? 0) > 0);
  const lastProductiveAt = productive ? productive.startedAt : null;

  const base = { consecutiveZeroNewCycles: consecutiveZero, lastProductiveAt, totalRecordsLastCycle, recordsNewLastCycle, lastCycleStartedAt };

  // Reactivate wins if it's the current state · caller sets that intent externally.
  if (currentState === "reactivate") {
    // Reactivate for exactly one BUILD cycle after promotion · caller may
    // reset by writing a productive cycle. Otherwise return reactivate so
    // the tick loop keeps this combo hot.
    return { state: "reactivate", reason: "reactivate flag set · one BUILD cycle promised", ...base };
  }

  // If we've been SATURATED for the cooldown period · promote to MAINTENANCE.
  if (currentState === "saturated" && stateEnteredAt) {
    const hoursInSaturated = (Date.now() - stateEnteredAt.getTime()) / 36e5;
    if (hoursInSaturated >= MAINTENANCE_COOLDOWN_HOURS) {
      return { state: "maintenance", reason: `saturated for ${Math.round(hoursInSaturated)}h · cooldown reached · promote to maintenance for light re-check`, ...base };
    }
  }

  // Fresh evaluation from cycle counts.
  if (consecutiveZero >= SATURATION_THRESHOLD_CYCLES) {
    return { state: "saturated", reason: `${consecutiveZero} consecutive cycles with records_new=0 · saturated`, ...base };
  }

  if (recordsNewLastCycle > 0) {
    return { state: "build", reason: `latest cycle produced ${recordsNewLastCycle} new · aggressive build continues`, ...base };
  }

  // Zero new, but not yet at saturation threshold.
  return {
    state: currentState === "maintenance" ? "maintenance" : "build",
    reason: `${consecutiveZero} zero-new cycle${consecutiveZero === 1 ? "" : "s"} · below saturation threshold (${SATURATION_THRESHOLD_CYCLES}) · continue current state`,
    ...base,
  };
}

// ── Picker (pure) ──────────────────────────────────────────────────────

export interface RotationStateRow {
  city: string;
  category: WalkedCategory;
  round: number;
  // 2026-08-24 · P0 atomic · surface dimension. Non-Yogyakarta cities: city
  // slug (e.g. `bantul`). Yogyakarta accommodation: 5 hand-tuned zones
  // (borobudur/kaliurang/malioboro/prawirotaman/yogya-wider). Market: zone
  // slug. Transport: query-universe-v1. Existing pre-migration rows may still
  // carry surface='default' until the tick worker rewrites them.
  surface: string;
  state: RotationStateKind;
  lastCycleStartedAt: Date | null;
  lastProductiveAt: Date | null;
  // 2026-08-26 · P3 reactivation policy fields. Runtime is authoritative
  // (scripts/nex-discovery-rotation/_rotation-tick.mjs) · these fields exist
  // on the DB row and can be surfaced by HQ dashboards.
  cooldownUntil?: Date | null;
  reactivationCount?: number;
  consecutiveUnproductiveReactivations?: number;
  reactivationReason?: string | null;
}

/**
 * Pick the next work item to promote based on state priority:
 *   1. REACTIVATE  (new provider/query added · resume immediately)
 *   2. BUILD       (already productive · keep going)
 *   3. MAINTENANCE (cooldown light re-check)
 *   4. SATURATED   (skip · don't hammer)
 *
 * Within a priority tier · prefer the combo whose lastCycleStartedAt is
 * oldest (least recently walked) so rotation is fair across combos.
 *
 * Returns null when nothing is eligible (all saturated · no work available).
 */
export function pickNextWorkItem(
  states: RotationStateRow[],
  workItems: WorkItem[],
): WorkItem | null {
  // 2026-08-24 · P0 atomic · surface-aware key.
  // Preserved as a legacy single-slot picker for tests. Production picking
  // happens in auto-orchestrator.pickForFreeSlots at surface granularity.
  const byKey = new Map(states.map((s) => [`${s.city}:${s.category}:${s.surface}:${s.round}`, s]));
  const priority: Record<RotationStateKind, number> = {
    reactivate: 4, build: 3, maintenance: 2, saturated: 1,
  };
  const eligible = workItems.filter((w) => w.walkerAvailable);
  if (eligible.length === 0) return null;

  let best: WorkItem | null = null;
  let bestPriority = 0;
  let bestLastRun = Infinity;

  for (const wi of eligible) {
    // Match ANY surface row for this (city, category, round=1) · if the combo
    // has multiple surfaces, prefer the least recently walked non-saturated one.
    let bestForCombo: RotationStateRow | null = null;
    for (const s of states) {
      if (s.city !== wi.city || s.category !== wi.category || s.round !== 1) continue;
      if (s.state === "saturated") continue;
      if (!bestForCombo) { bestForCombo = s; continue; }
      const aMs = s.lastCycleStartedAt?.getTime() ?? 0;
      const bMs = bestForCombo.lastCycleStartedAt?.getTime() ?? 0;
      if (aMs < bMs) bestForCombo = s;
    }
    // No row yet for this combo = fresh BUILD (never observed).
    const stateKind: RotationStateKind = bestForCombo?.state ?? "build";
    if (stateKind === "saturated") continue;
    const p = priority[stateKind];
    const lastRunMs = bestForCombo?.lastCycleStartedAt ? bestForCombo.lastCycleStartedAt.getTime() : 0;
    if (p > bestPriority || (p === bestPriority && lastRunMs < bestLastRun)) {
      best = wi;
      bestPriority = p;
      bestLastRun = lastRunMs;
    }
  }
  return best;
}

// ── Rotation snapshot for HQ display ────────────────────────────────────

export interface RotationSnapshotRow {
  city: string;
  category: WalkedCategory;
  // 2026-08-24 · P0 atomic · surface identifies the specific discovery surface.
  // Multiple surface rows may exist for the same (city, category) · a combo is
  // considered "fully exhausted" only when ALL its surfaces are simultaneously
  // SATURATED. Until then the combo remains eligible via at least one surface.
  surface: string;
  round: number;
  state: RotationStateKind;
  walkerAvailable: boolean;
  script: string | null;
  lastCycleStartedAt: Date | null;
  lastProductiveAt: Date | null;
  consecutiveZeroNewCycles: number;
  totalRecordsLastCycle: number | null;
  recordsNewLastCycle: number | null;
  reactivationReason: string | null;
  nextActionHint: string | null;
  stateEnteredAt: Date | null;
  updatedAt: Date | null;
  note: string | null;
}

/**
 * Build a full grid of work-items × latest-state so the HQ page can render
 * badges honestly. Missing state rows are surfaced with state='build' and
 * empty timestamps · they represent combos we haven't observed yet.
 */
export function buildRotationSnapshot(
  states: RotationStateRow[],
  workItems: WorkItem[],
  extras?: Map<string, { consecutiveZero: number; totalLast: number | null; newLast: number | null; reactivation: string | null; hint: string | null; stateEnteredAt: Date | null; updatedAt: Date | null; }>,
): RotationSnapshotRow[] {
  // 2026-08-24 · P0 atomic · one snapshot row PER SURFACE. Key format is now
  // `${city}:${category}:${surface}:${round}` so a Yogyakarta:accommodation
  // combo with 5 zones produces 5 rows · each with independent state.
  const byKey = new Map(states.map((s) => [`${s.city}:${s.category}:${s.surface}:${s.round}`, s]));
  const out: RotationSnapshotRow[] = [];
  for (const wi of workItems) {
    for (const surface of wi.surfaces) {
      const key = `${wi.city}:${wi.category}:${surface}:1`;
      const st = byKey.get(key);
      const ex = extras?.get(key);
      out.push({
        city:                     wi.city,
        category:                 wi.category,
        surface,
        round:                    1,
        state:                    st?.state ?? "build",
        walkerAvailable:          wi.walkerAvailable,
        script:                   wi.script ?? null,
        lastCycleStartedAt:       st?.lastCycleStartedAt ?? null,
        lastProductiveAt:         st?.lastProductiveAt ?? null,
        consecutiveZeroNewCycles: ex?.consecutiveZero ?? 0,
        totalRecordsLastCycle:    ex?.totalLast ?? null,
        recordsNewLastCycle:      ex?.newLast ?? null,
        reactivationReason:       ex?.reactivation ?? null,
        nextActionHint:           ex?.hint ?? null,
        stateEnteredAt:           ex?.stateEnteredAt ?? null,
        updatedAt:                ex?.updatedAt ?? null,
        note:                     wi.note ?? null,
      });
    }
  }
  return out;
}

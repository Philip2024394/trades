// src/lib/nex-hq/auto-orchestrator.ts
//
// NEX Auto Walker Orchestrator · CONSTITUTIONAL (2026-08-24).
//
// Rotation Controller becomes the BOSS · walkers execute what the brain
// assigns · this lib is the pure queue-building + picker layer. The tick
// worker consumes these functions to decide what to spawn next.
//
// Doctrine anchor: project_nex_auto_walker_orchestrator_2026_08_24

import type { RotationSnapshotRow, WorkItem } from "./discovery-rotation";

// Central concurrency limit · MUST match _orchestrator-tick.mjs runtime.
// Scaling ladder (Philip 2026-08-24): 1 → 5 → 10 → 25 → 50 → 100.
// Phase A: 1 → 5 (Provider Rate Governor shipped)
// Stage 10 (2026-08-24 · same day): 5 → 10 after Phase C (transport city-
// configurability) shipped · every tracked city has all 4 categories walkable ·
// governor still authoritative on Nominatim (1500ms) + Overpass (2000ms).
// Do NOT bump above 10 in one step · Stage 25 requires observation of Stage 10
// throughput / provider failures / duplicate rates / cycle durations.
export const MAX_SLOTS = 10;

// Fairness · orchestrator refuses to pick the same (city, category) combo
// more than N consecutive times · forces rotation once cap hits.
export const FAIRNESS_CONSECUTIVE_CAP = 2;

// Per-vertical concurrency caps · Chief Architect 2026-08-26.
// Evidence: 1,378 failed transport:Yogyakarta cycles in 7d, all "Failed to
// acquire nominatim lease within 300000ms" · 78% of ALL failed cycles come
// from transport walkers competing for nominatim-public's 1 rps single-choke.
// Cap transport to 1 concurrent walker · other 7 transport cities wait rather
// than starve on the lease queue. Freshness stays fine (1 city per ~2 min ·
// full 8-city rotation in ~16 min). Verticals absent from this map are
// uncapped (bounded only by global MAX_SLOTS).
export const PER_VERTICAL_CONCURRENCY: Readonly<Record<string, number>> = Object.freeze({
  transport: 1,
});

// Status vocabulary · distinct from rotation-state kind · reflects what
// happens INSIDE the orchestrator (not what happened outside in walker land).
export type OrchestratorItemStatus =
  | "eligible"                  // could be picked next
  | "would-pick"                // would be the next pick if a slot were free
  | "in-flight"                 // currently being walked
  | "waiting-cooldown"          // eligible but throttled behind fairness
  | "waiting-vertical-cap"      // eligible but vertical concurrency cap reached
  | "skipped-saturated"         // combo state = saturated · we do not walk
  | "skipped-gated-provider"    // provider unavailable
  | "skipped-not-city-configurable" // walker doesn't support this city yet
  | "skipped-duplicate";        // in-flight already for this combo

export interface QueueItem {
  city: string;
  category: string;
  // 2026-08-24 · P0 atomic · surface dimension. Each queue item represents
  // a specific discovery surface for a (city, category). A saturated surface
  // does NOT block the combo · other surfaces for the same combo remain
  // pickable.
  surface: string;
  round: number;
  state: RotationSnapshotRow["state"];
  walkerAvailable: boolean;
  script: string | null;
  lastCycleStartedAt: Date | null;
  recordsNewLastCycle: number | null;
  reason: string;
  status: OrchestratorItemStatus;
}

// ── In-flight tracking · from worker_cycle_run rows with status='running' ──
export interface InFlightCycle {
  cycleId: string;
  city: string;               // parsed from worker_config
  category: string;           // parsed from worker_config
  startedAt: Date;
}

// ── Recent-pick tracking for fairness ──
export interface RecentPick {
  city: string;
  category: string;
  pickedAt: Date;
}

// ── Priority scoring (pure) ──────────────────────────────────────────────

function priorityScore(state: RotationSnapshotRow["state"]): number {
  switch (state) {
    case "reactivate":  return 40;
    case "build":       return 30;
    case "maintenance": return 20;
    case "saturated":   return 0;  // never picked
  }
}

/**
 * Build the full queue view · ordered NOW/NEXT/THEN...WAITING.
 *
 * @param snapshot        rotation snapshot (all combos)
 * @param inFlight        currently-running cycles
 * @param recentPicks     recent orchestrator picks (newest last · for fairness)
 * @param providerGated   set of "city:category" strings marked gated by provider
 */
export function buildDiscoveryQueue(
  snapshot: RotationSnapshotRow[],
  inFlight: InFlightCycle[],
  recentPicks: RecentPick[],
  providerGated: Set<string> = new Set(),
): QueueItem[] {
  // 2026-08-24 · P0 atomic · in-flight tracked at (city, category) grain still.
  // A single walker cycle blocks the whole combo (its walker is busy) · other
  // surfaces of the same combo cannot spawn a second walker into the same
  // isAlreadyRunning guard. This is correct behaviour · one walker process
  // per (city, category, worker_id).
  const inFlightKeys = new Set(inFlight.map((f) => `${f.city}:${f.category}`));

  // Per-vertical in-flight count (Chief Architect 2026-08-26 · transport lease cap).
  const inFlightByVertical = new Map<string, number>();
  for (const f of inFlight) {
    inFlightByVertical.set(f.category, (inFlightByVertical.get(f.category) ?? 0) + 1);
  }

  // Count last consecutive picks per combo (from end of recentPicks · newest last).
  // Fairness cap still at (city, category) grain · surface-level cap would
  // starve single-surface combos (non-Yogyakarta cities all have 1 surface).
  const consecutiveByKey = new Map<string, number>();
  if (recentPicks.length > 0) {
    let i = recentPicks.length - 1;
    const lastKey = `${recentPicks[i].city}:${recentPicks[i].category}`;
    let count = 0;
    while (i >= 0) {
      const key = `${recentPicks[i].city}:${recentPicks[i].category}`;
      if (key !== lastKey) break;
      count += 1; i -= 1;
    }
    consecutiveByKey.set(lastKey, count);
  }

  const items: QueueItem[] = snapshot.map((s) => {
    const comboKey = `${s.city}:${s.category}`;
    let status: OrchestratorItemStatus;
    let reason: string;

    if (!s.walkerAvailable) {
      status = "skipped-not-city-configurable"; reason = s.note ?? "walker not yet city-configurable for this combo";
    } else if (inFlightKeys.has(comboKey)) {
      status = "in-flight"; reason = "worker cycle currently running for this combo";
    } else if (providerGated.has(comboKey)) {
      status = "skipped-gated-provider"; reason = "provider unavailable for this combo";
    } else if (s.state === "saturated") {
      // Surface-level saturation · does NOT globally exhaust the combo · other
      // surfaces of the same (city, category) may still be pickable.
      status = "skipped-saturated"; reason = `surface ${s.surface} saturated (${s.consecutiveZeroNewCycles} consecutive zero-new cycles)`;
    } else if (PER_VERTICAL_CONCURRENCY[s.category] !== undefined
            && (inFlightByVertical.get(s.category) ?? 0) >= PER_VERTICAL_CONCURRENCY[s.category]) {
      status = "waiting-vertical-cap";
      reason = `vertical ${s.category} at concurrency cap ${PER_VERTICAL_CONCURRENCY[s.category]} · avoids nominatim lease starvation`;
    } else {
      const consecutive = consecutiveByKey.get(comboKey) ?? 0;
      if (consecutive >= FAIRNESS_CONSECUTIVE_CAP) {
        status = "waiting-cooldown"; reason = `fairness cap · combo picked ${consecutive}× in a row · yielding to another combo`;
      } else {
        status = "eligible"; reason = `eligible next pick · surface ${s.surface}`;
      }
    }

    return {
      city:                s.city,
      category:            s.category,
      surface:             s.surface,
      round:               s.round,
      state:               s.state,
      walkerAvailable:     s.walkerAvailable,
      script:              s.script,
      lastCycleStartedAt:  s.lastCycleStartedAt,
      recordsNewLastCycle: s.recordsNewLastCycle,
      reason,
      status,
    };
  });

  // Sort · eligibility first (would-pick candidates surface at top), then priority,
  // then oldest lastCycleStartedAt for fairness.
  items.sort((a, b) => {
    const orderStatus = statusOrder(a.status) - statusOrder(b.status);
    if (orderStatus !== 0) return orderStatus;
    const priorityDiff = priorityScore(b.state) - priorityScore(a.state);
    if (priorityDiff !== 0) return priorityDiff;
    const aMs = a.lastCycleStartedAt ? a.lastCycleStartedAt.getTime() : 0;
    const bMs = b.lastCycleStartedAt ? b.lastCycleStartedAt.getTime() : 0;
    return aMs - bMs;
  });

  // Mark the first eligible as would-pick (the item the next tick would spawn).
  const firstEligibleIdx = items.findIndex((i) => i.status === "eligible");
  if (firstEligibleIdx >= 0) items[firstEligibleIdx].status = "would-pick";

  return items;
}

function statusOrder(s: OrchestratorItemStatus): number {
  switch (s) {
    case "would-pick":                  return 0;
    case "in-flight":                   return 1;
    case "eligible":                    return 2;
    case "waiting-cooldown":            return 3;
    case "waiting-vertical-cap":        return 3;
    case "skipped-saturated":           return 4;
    case "skipped-gated-provider":      return 5;
    case "skipped-not-city-configurable": return 6;
    case "skipped-duplicate":           return 7;
  }
}

// ── Slot picker (pure) ──────────────────────────────────────────────────

/**
 * Given the queue + current in-flight count · return the next item to spawn
 * or null when nothing should be spawned this tick.
 *
 * Single-slot variant · kept for MVP tests + backward compatibility. New
 * callers should prefer pickForFreeSlots() which returns up to N picks.
 */
export function pickForNextSlot(queue: QueueItem[], currentInFlight: number, maxSlots: number = MAX_SLOTS): QueueItem | null {
  if (currentInFlight >= maxSlots) return null;      // slots full · wait
  const wp = queue.find((i) => i.status === "would-pick");
  if (!wp) return null;
  // Defence in depth · would-pick should only be set on eligible-shaped rows
  if (!wp.walkerAvailable) return null;
  return wp;
}

/**
 * Multi-slot picker (Phase A · 2026-08-24). Returns up to N distinct picks
 * respecting all constraints from buildDiscoveryQueue plus:
 *   · never picks two (city, category) combos for the same city IF there is
 *     an alternative city available (per-tick city fairness · a single tick
 *     never assigns all slots to one city when other cities have work)
 *   · never re-picks the same combo within the same tick (list dedup)
 *   · respects MAX_SLOTS - currentInFlight as the ceiling
 */
export function pickForFreeSlots(queue: QueueItem[], currentInFlight: number, maxSlots: number = MAX_SLOTS): QueueItem[] {
  const freeSlots = Math.max(0, maxSlots - currentInFlight);
  if (freeSlots === 0) return [];
  const eligible = queue.filter((i) => (i.status === "would-pick" || i.status === "eligible") && i.walkerAvailable);
  const picked: QueueItem[] = [];
  const pickedKeys = new Set<string>();
  const pickedCities = new Set<string>();
  const alternativeCityAvailable = new Set(eligible.map((i) => i.city)).size > 1;

  // First pass · prefer diverse cities when possible.
  for (const it of eligible) {
    if (picked.length >= freeSlots) break;
    const key = `${it.city}:${it.category}`;
    if (pickedKeys.has(key)) continue;
    if (alternativeCityAvailable && pickedCities.has(it.city)) continue;
    picked.push(it); pickedKeys.add(key); pickedCities.add(it.city);
  }

  // Second pass · fill remaining slots with any eligible (city may repeat here).
  if (picked.length < freeSlots) {
    for (const it of eligible) {
      if (picked.length >= freeSlots) break;
      const key = `${it.city}:${it.category}`;
      if (pickedKeys.has(key)) continue;
      picked.push(it); pickedKeys.add(key);
    }
  }
  return picked;
}

// ── Small helpers used by the tick worker + HQ view ─────────────────────

/** Parse a worker_config like "market:sleman:overpass" into city/category. */
export function parseWorkerConfig(cfg: string | null | undefined, workItems: WorkItem[]): { city: string; category: string } | null {
  if (!cfg) return null;
  const parts = cfg.split(":");
  if (parts.length < 2) return null;
  const category = parts[0];
  const cityToken = parts[1];
  // Match against known cities · tolerant of casing + hyphen forms.
  for (const wi of workItems) {
    if (wi.category !== category) continue;
    const cityForm = wi.city.replace(" ", "-").toLowerCase();
    if (cityToken.toLowerCase() === wi.city.toLowerCase() || cityToken.toLowerCase() === cityForm) {
      return { city: wi.city, category: wi.category };
    }
  }
  return null;
}

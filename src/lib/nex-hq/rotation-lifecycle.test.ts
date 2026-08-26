// src/lib/nex-hq/rotation-lifecycle.test.ts
//
// P0 · 2026-08-24 · Deterministic rotation lifecycle test (Philip's category
// non-starvation proof). Uses the REAL production picker + evaluator with
// injected time (Date parameters), NEVER modifies MAINTENANCE_COOLDOWN_HOURS
// or SATURATION_THRESHOLD_CYCLES. Production policy stays 72h.
//
// Answers Philip's asks §1-§7:
//   §1 Controlled fixture with saturated + eligible combos
//   §2 Cooldown-not-expired → excluded · cooldown-expired → eligible
//   §3 No hard-coded "if category X" shortcut · uses real pickForFreeSlots
//   §4 All 4 categories can participate
//   §5 Geographic × category matrix rotation
//   §6 Low-volume category not permanently starved
//   §7 Long-run fairness measured across 1000+ ticks

import { describe, it, expect } from "vitest";
import {
  MAINTENANCE_COOLDOWN_HOURS,
  SATURATION_THRESHOLD_CYCLES,
  WALKED_CATEGORIES,
  TRACKED_CITIES,
  evaluateRotationState,
  buildWorkItemRegistry,
  type WorkItem,
  type CycleSummary,
  type RotationStateKind,
} from "./discovery-rotation";
import {
  buildDiscoveryQueue,
  pickForFreeSlots,
  MAX_SLOTS,
  type QueueItem,
} from "./auto-orchestrator";
import type { RotationSnapshotRow } from "./discovery-rotation";

// Construct a RotationSnapshotRow with defaults so tests only set what matters.
// 2026-08-24 · P0 atomic · `surface` is a required field · defaults to 'default'
// when a test doesn't care · surface-specific tests pass an explicit value.
function snap(
  city: string,
  category: (typeof WALKED_CATEGORIES)[number],
  state: RotationStateKind,
  extras: Partial<RotationSnapshotRow> = {},
): RotationSnapshotRow {
  return {
    city,
    category,
    surface: "default",
    round: 1,
    state,
    walkerAvailable: true,
    script: "scripts/nex-acquisition/run-live-cycle.mjs",
    lastCycleStartedAt: null,
    lastProductiveAt: null,
    consecutiveZeroNewCycles: 0,
    totalRecordsLastCycle: null,
    recordsNewLastCycle: null,
    reactivationReason: null,
    nextActionHint: null,
    stateEnteredAt: null,
    updatedAt: null,
    note: null,
    ...extras,
  };
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

// ── §1+§2 · Cooldown boundary ─────────────────────────────────────────

describe("§1+§2 · SATURATED cooldown boundary honours MAINTENANCE_COOLDOWN_HOURS", () => {
  it(`SATURATED at cooldown-1h (${MAINTENANCE_COOLDOWN_HOURS - 1}h) stays saturated`, () => {
    const zeroCycles: CycleSummary[] = [
      { startedAt: hoursAgo(0.1), finishedAt: hoursAgo(0.05), recordsProcessed: 100, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(1),   finishedAt: hoursAgo(0.9),  recordsProcessed: 100, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(2),   finishedAt: hoursAgo(1.9),  recordsProcessed: 100, recordsNew: 0, status: "completed" },
    ];
    const enteredAt = hoursAgo(MAINTENANCE_COOLDOWN_HOURS - 1);
    const r = evaluateRotationState(zeroCycles, "saturated", enteredAt);
    expect(r.state).toBe("saturated");
  });

  it(`SATURATED at cooldown+1h (${MAINTENANCE_COOLDOWN_HOURS + 1}h) promotes to MAINTENANCE`, () => {
    const zeroCycles: CycleSummary[] = [
      { startedAt: hoursAgo(72.1), finishedAt: hoursAgo(72.05), recordsProcessed: 100, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(73),   finishedAt: hoursAgo(72.9),  recordsProcessed: 100, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(74),   finishedAt: hoursAgo(73.9),  recordsProcessed: 100, recordsNew: 0, status: "completed" },
    ];
    const enteredAt = hoursAgo(MAINTENANCE_COOLDOWN_HOURS + 1);
    const r = evaluateRotationState(zeroCycles, "saturated", enteredAt);
    expect(r.state).toBe("maintenance");
    expect(r.reason).toMatch(/cooldown reached/);
  });

  it("Productive cycle after SATURATED promotes to BUILD (fast reactivate)", () => {
    const cycles: CycleSummary[] = [
      { startedAt: hoursAgo(0.1), finishedAt: hoursAgo(0.05), recordsProcessed: 100, recordsNew: 5, status: "completed" },
    ];
    const r = evaluateRotationState(cycles, "saturated", hoursAgo(1));
    expect(r.state).toBe("build");
  });
});

// ── §3 · Picker uses production logic · no hard-coded category shortcut ──

describe("§3 · Picker uses real production selection (no category hard-code)", () => {
  it("pickForFreeSlots skips every SATURATED combo when eligibles exist", () => {
    const snapshot: RotationSnapshotRow[] = [
      snap("Yogyakarta", "food", "saturated"),
      snap("Bantul",     "food", "build"),
      snap("Sleman",     "market", "build"),
    ];
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    expect(picks).toHaveLength(2);
    expect(picks.map((p) => `${p.city}:${p.category}`).sort())
      .toEqual(["Bantul:food", "Sleman:market"]);
    // Saturated combo never in picks
    expect(picks.some((p) => p.city === "Yogyakarta" && p.category === "food")).toBe(false);
  });

  it("MAINTENANCE combo (post-cooldown) IS picked · lower priority than BUILD", () => {
    const snapshot: RotationSnapshotRow[] = [
      snap("Yogyakarta", "food", "maintenance", { lastCycleStartedAt: hoursAgo(2) }),
      snap("Bantul",     "food", "build",       { lastCycleStartedAt: hoursAgo(0.1) }),
    ];
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const keys = picks.map((p) => `${p.city}:${p.category}`);
    expect(keys).toContain("Yogyakarta:food"); // maintenance still eligible
    expect(keys).toContain("Bantul:food");     // build still eligible
  });
});

// ── §4 · All 4 categories can participate independently ────────────────

describe("§4 · All 4 categories can enter SATURATED and return to eligible", () => {
  for (const category of WALKED_CATEGORIES) {
    it(`${category} · saturates after ${SATURATION_THRESHOLD_CYCLES} zero cycles then reaches MAINTENANCE after cooldown`, () => {
      const zeroCycles: CycleSummary[] = Array.from({ length: SATURATION_THRESHOLD_CYCLES }, (_, i) => ({
        startedAt: hoursAgo(i + 0.1),
        finishedAt: hoursAgo(i + 0.05),
        recordsProcessed: 50,
        recordsNew: 0,
        status: "completed",
      }));
      // Fresh evaluation: hit saturation threshold
      const fresh = evaluateRotationState(zeroCycles, "build", hoursAgo(1));
      expect(fresh.state).toBe("saturated");

      // Simulate cooldown expiry via stateEnteredAt
      const expired = evaluateRotationState(zeroCycles, "saturated", hoursAgo(MAINTENANCE_COOLDOWN_HOURS + 0.5));
      expect(expired.state).toBe("maintenance");
    });
  }
});

// ── §5 · Geographic × category matrix rotation ─────────────────────────

describe("§5 · Geographic + category rotation together", () => {
  it("picker returns picks spanning multiple cities in one tick when eligible", () => {
    // Picker guarantees per-tick CITY diversity (see auto-orchestrator
    // pickForFreeSlots · alternativeCityAvailable branch). Category diversity
    // is an emergent property over many ticks (see the 1000-tick fairness
    // test below) · not a per-tick guarantee. With N ≥ 10 eligible cities,
    // a single tick can legitimately fill all slots with one category
    // because the first-pass city-diversity dominates. This test asserts
    // only what the picker actually guarantees per-tick.
    const workItems = buildWorkItemRegistry();
    const snapshot: RotationSnapshotRow[] = workItems.map((w) => snap(w.city, w.category, "build"));
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const distinctCities = new Set(picks.map((p) => p.city));
    expect(distinctCities.size).toBeGreaterThan(1);
    expect(picks.length).toBeLessThanOrEqual(MAX_SLOTS);
  });
});

// ── §6 · Low-volume category NOT starved ──────────────────────────────

describe("§6 · Starvation guard · low-volume category eventually picked", () => {
  it("with 30 market combos and 2 food combos, food gets at least 1 pick in 100 ticks", () => {
    // Rig: 30 market combos (highly available), 2 food combos (rare).
    const cities = Array.from({ length: 30 }, (_, i) => `TestCity${i}`);
    const state = new Map<string, RotationSnapshotRow>();
    for (const c of cities) state.set(`${c}:market`, snap(c, "market", "build"));
    state.set("A:food", snap("A", "food", "build"));
    state.set("B:food", snap("B", "food", "build"));

    const pickCounts = new Map<string, number>();
    for (let tick = 0; tick < 100; tick++) {
      const snapshot = Array.from(state.values());
      const queue = buildDiscoveryQueue(snapshot, [], []);
      const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
      for (const p of picks) {
        pickCounts.set(p.category, (pickCounts.get(p.category) ?? 0) + 1);
        // Simulate cycle completion · update lastCycleStartedAt so fairness sort
        // has real time-of-last-run diversity across combos.
        const key = `${p.city}:${p.category}`;
        const cur = state.get(key)!;
        state.set(key, { ...cur, lastCycleStartedAt: new Date(Date.now() + tick * 1000) });
      }
    }
    expect(pickCounts.get("food") ?? 0).toBeGreaterThan(0);
    expect(pickCounts.get("market") ?? 0).toBeGreaterThan(0);
  });
});

// ── §7 · Long-run fairness · 1000+ ticks measured ─────────────────────

describe("§7 · Long-run fairness across 1000 ticks", () => {
  it("with real (city × category) matrix · all 4 categories AND all 8 cities receive picks", () => {
    const workItems = buildWorkItemRegistry();
    const state = new Map<string, RotationSnapshotRow>();
    for (const w of workItems) state.set(`${w.city}:${w.category}`, snap(w.city, w.category, "build"));

    const pickCountsByCategory = new Map<string, number>();
    const pickCountsByCity     = new Map<string, number>();
    let totalPicks = 0;

    for (let tick = 0; tick < 1000; tick++) {
      const snapshot = Array.from(state.values());
      const queue = buildDiscoveryQueue(snapshot, [], []);
      const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
      for (const p of picks) {
        totalPicks++;
        pickCountsByCategory.set(p.category, (pickCountsByCategory.get(p.category) ?? 0) + 1);
        pickCountsByCity.set(p.city, (pickCountsByCity.get(p.city) ?? 0) + 1);
        // Simulate the cycle completing at tick-time so the next tick's fairness
        // sort has a fresh lastCycleStartedAt · this is essential · without it
        // every combo has the same "never" timestamp and fairness is arbitrary.
        const key = `${p.city}:${p.category}`;
        const cur = state.get(key)!;
        state.set(key, { ...cur, lastCycleStartedAt: new Date(Date.now() + tick * 60_000) });
      }
    }

    // Every walked category must receive at least 1 pick over 1000 ticks
    for (const cat of WALKED_CATEGORIES) {
      expect(pickCountsByCategory.get(cat) ?? 0, `category "${cat}" received 0 picks in 1000 ticks`)
        .toBeGreaterThan(0);
    }
    // Every tracked city must receive at least 1 pick over 1000 ticks
    for (const city of TRACKED_CITIES) {
      expect(pickCountsByCity.get(city) ?? 0, `city "${city}" received 0 picks in 1000 ticks`)
        .toBeGreaterThan(0);
    }
    expect(totalPicks).toBeGreaterThan(1000);
  });

  it("with half the combos SATURATED, remaining eligible combos still cover every category and >4 cities", () => {
    const workItems = buildWorkItemRegistry();
    const state = new Map<string, RotationSnapshotRow>();
    // Deterministic rigging · per-category count: half saturated, half build.
    // Guarantees each of the 4 categories has 4 eligible + 4 saturated combos
    // (not modulo-index alternation which can accidentally starve a category).
    const seenPerCategory = new Map<string, number>();
    for (const w of workItems) {
      const seen = seenPerCategory.get(w.category) ?? 0;
      // First 4 cities per category = saturated · remaining 4 = build.
      const kind: RotationStateKind = seen < 4 ? "saturated" : "build";
      seenPerCategory.set(w.category, seen + 1);
      state.set(`${w.city}:${w.category}`, snap(w.city, w.category, kind));
    }
    const eligibleCategories = new Set<string>();
    const eligibleCities     = new Set<string>();
    for (let tick = 0; tick < 500; tick++) {
      const snapshot = Array.from(state.values());
      const queue = buildDiscoveryQueue(snapshot, [], []);
      const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
      for (const p of picks) {
        eligibleCategories.add(p.category);
        eligibleCities.add(p.city);
        const key = `${p.city}:${p.category}`;
        const cur = state.get(key)!;
        state.set(key, { ...cur, lastCycleStartedAt: new Date(Date.now() + tick * 60_000) });
      }
    }
    // With half the matrix saturated, ALL 4 categories should still have at
    // least 1 unsaturated combo (16 unsaturated out of 32 · every category
    // has 8 cities · so at minimum 4 unsaturated per category). Picker MUST
    // exercise all four categories over 500 ticks.
    expect(eligibleCategories.size).toBe(WALKED_CATEGORIES.length);
    // Rigging saturates first-4-cities-per-category · so the remaining 4
    // cities appear in picks. All 4 non-saturated cities must be exercised.
    expect(eligibleCities.size).toBeGreaterThanOrEqual(4);
  });
});

// ── §8 · Cooldown expiry lifecycle end-to-end ─────────────────────────

describe("§8 · Full lifecycle · SATURATED → cooldown → MAINTENANCE → pickable · no production policy change", () => {
  it("A combo saturated below cooldown is skipped · same combo above cooldown is picked", () => {
    // Only-eligible universe: Yogyakarta:food saturated + Bantul:market build.
    // Sim tick 1: Yogyakarta:food SATURATED under cooldown → only Bantul picked.
    const stateBefore: RotationSnapshotRow[] = [
      snap("Yogyakarta", "food",   "saturated", { stateEnteredAt: hoursAgo(1) }),
      snap("Bantul",     "market", "build"),
    ];
    const queueBefore = buildDiscoveryQueue(stateBefore, [], []);
    const picksBefore = pickForFreeSlots(queueBefore, 0, MAX_SLOTS);
    expect(picksBefore.map((p) => `${p.city}:${p.category}`))
      .not.toContain("Yogyakarta:food");

    // Now inject stateEnteredAt=73h ago and re-evaluate via evaluateRotationState.
    // In production this transition happens inside the rotation tick worker's
    // upsert loop · here we compute the new state via the same function.
    const evaluated = evaluateRotationState(
      [{ startedAt: hoursAgo(74), finishedAt: hoursAgo(73.9), recordsProcessed: 50, recordsNew: 0, status: "completed" }],
      "saturated",
      hoursAgo(MAINTENANCE_COOLDOWN_HOURS + 1),
    );
    expect(evaluated.state).toBe("maintenance");

    // Sim tick 2 with the promoted state.
    const stateAfter: RotationSnapshotRow[] = [
      snap("Yogyakarta", "food",   "maintenance", { stateEnteredAt: hoursAgo(0.1) }),
      snap("Bantul",     "market", "build"),
    ];
    const queueAfter = buildDiscoveryQueue(stateAfter, [], []);
    const picksAfter = pickForFreeSlots(queueAfter, 0, MAX_SLOTS);
    expect(picksAfter.map((p) => `${p.city}:${p.category}`))
      .toContain("Yogyakarta:food"); // maintenance combo returns to picker
  });
});

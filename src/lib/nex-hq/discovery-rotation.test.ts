// src/lib/nex-hq/discovery-rotation.test.ts

import { describe, it, expect } from "vitest";
import {
  buildWorkItemRegistry,
  evaluateRotationState,
  pickNextWorkItem,
  buildRotationSnapshot,
  SATURATION_THRESHOLD_CYCLES,
  MAINTENANCE_COOLDOWN_HOURS,
  WALKED_CATEGORIES,
  TRACKED_CITIES,
  type CycleSummary,
  type RotationStateRow,
} from "./discovery-rotation";

function cycle(started: string, recordsNew: number, recordsProcessed = recordsNew, status = "completed"): CycleSummary {
  return {
    startedAt: new Date(started),
    finishedAt: new Date(started),
    recordsNew, recordsProcessed, status,
  };
}

describe("buildWorkItemRegistry · honest walker-availability map", () => {
  it("produces 8 × 4 = 32 rows (TRACKED_CITIES × WALKED_CATEGORIES)", () => {
    const items = buildWorkItemRegistry();
    expect(items.length).toBe(TRACKED_CITIES.length * WALKED_CATEGORIES.length);
    expect(items.length).toBe(32);
  });

  it("market walker is available for all 8 cities (zone cursor covers them all)", () => {
    const items = buildWorkItemRegistry();
    const marketAvail = items.filter((i) => i.category === "market" && i.walkerAvailable);
    expect(marketAvail.length).toBe(TRACKED_CITIES.length);
  });

  it("food + accommodation are city-configurable across all 8 cities (Phase B 2026-08-24)", () => {
    const items = buildWorkItemRegistry();
    for (const cat of ["food", "accommodation"] as const) {
      const avail = items.filter((i) => i.category === cat && i.walkerAvailable);
      expect(avail.length).toBe(TRACKED_CITIES.length);
    }
  });

  it("transport walker is city-configurable across all 8 cities (Phase C 2026-08-24)", () => {
    const items = buildWorkItemRegistry();
    const avail = items.filter((i) => i.category === "transport" && i.walkerAvailable);
    expect(avail.length).toBe(TRACKED_CITIES.length);
  });

  it("ZERO combos remain NOT_CITY_CONFIGURABLE after Phase C · every city × every category walkable", () => {
    const items = buildWorkItemRegistry();
    const unavailable = items.filter((i) => !i.walkerAvailable);
    expect(unavailable.length).toBe(0);
  });
});

describe("evaluateRotationState · pure state transitions", () => {
  it("empty history returns build with a self-explanatory reason", () => {
    const r = evaluateRotationState([]);
    expect(r.state).toBe("build");
    expect(r.reason).toMatch(/no cycle history/);
    expect(r.consecutiveZeroNewCycles).toBe(0);
    expect(r.lastProductiveAt).toBeNull();
  });

  it("latest cycle has records_new > 0 → build", () => {
    const r = evaluateRotationState([cycle("2026-08-24T10:00:00Z", 5)]);
    expect(r.state).toBe("build");
    expect(r.recordsNewLastCycle).toBe(5);
    expect(r.lastProductiveAt).not.toBeNull();
  });

  it("one zero-new cycle after productive · stays build (below threshold)", () => {
    const r = evaluateRotationState([
      cycle("2026-08-24T10:00:00Z", 0),
      cycle("2026-08-24T08:00:00Z", 3),
    ]);
    expect(r.state).toBe("build");
    expect(r.consecutiveZeroNewCycles).toBe(1);
  });

  it("hits saturated after SATURATION_THRESHOLD_CYCLES consecutive zero-new", () => {
    const cycles: CycleSummary[] = [];
    for (let i = 0; i < SATURATION_THRESHOLD_CYCLES; i++) {
      cycles.push(cycle(`2026-08-24T${(10 - i).toString().padStart(2, "0")}:00:00Z`, 0));
    }
    cycles.push(cycle("2026-08-24T06:00:00Z", 5));  // older productive
    const r = evaluateRotationState(cycles);
    expect(r.state).toBe("saturated");
    expect(r.consecutiveZeroNewCycles).toBe(SATURATION_THRESHOLD_CYCLES);
  });

  it("saturated + cooldown elapsed → maintenance", () => {
    const enteredHoursAgo = MAINTENANCE_COOLDOWN_HOURS + 5;
    const stateEnteredAt = new Date(Date.now() - enteredHoursAgo * 36e5);
    const cycles: CycleSummary[] = [
      cycle(new Date(Date.now() - 60 * 60 * 1000).toISOString(), 0),
    ];
    const r = evaluateRotationState(cycles, "saturated", stateEnteredAt);
    expect(r.state).toBe("maintenance");
    expect(r.reason).toMatch(/cooldown/);
  });

  it("saturated + cooldown NOT yet elapsed → stays saturated", () => {
    const stateEnteredAt = new Date(Date.now() - 2 * 36e5);   // 2h ago
    const cycles: CycleSummary[] = [cycle(new Date().toISOString(), 0), cycle(new Date().toISOString(), 0), cycle(new Date().toISOString(), 0)];
    const r = evaluateRotationState(cycles, "saturated", stateEnteredAt);
    expect(r.state).toBe("saturated");
  });

  it("failed cycles are NOT counted toward saturation streak · infrastructural noise", () => {
    // 3 failed cycles then a productive completed cycle · should be BUILD not SATURATED.
    const cycles: CycleSummary[] = [
      cycle("2026-08-24T10:00:00Z", 0, 0, "failed"),
      cycle("2026-08-24T09:00:00Z", 0, 0, "failed"),
      cycle("2026-08-24T08:00:00Z", 0, 0, "failed"),
      cycle("2026-08-24T07:00:00Z", 5),   // productive completed
    ];
    const r = evaluateRotationState(cycles);
    expect(r.state).toBe("build");
    expect(r.consecutiveZeroNewCycles).toBe(0);
    expect(r.lastProductiveAt).not.toBeNull();
  });

  it("failed cycles interleaved with completed zeros · saturation still counts only completed zeros", () => {
    const cycles: CycleSummary[] = [
      cycle("2026-08-24T10:00:00Z", 0, 0, "failed"),
      cycle("2026-08-24T09:00:00Z", 0, 0, "completed"),
      cycle("2026-08-24T08:00:00Z", 0, 0, "failed"),
      cycle("2026-08-24T07:00:00Z", 0, 0, "completed"),
      cycle("2026-08-24T06:00:00Z", 0, 0, "completed"),
    ];
    const r = evaluateRotationState(cycles);
    // Completed cycles from top: 3 zeros in a row → SATURATED at threshold 3
    expect(r.consecutiveZeroNewCycles).toBe(3);
    expect(r.state).toBe("saturated");
  });

  it("reactivate flag persists for one evaluation (caller expected to reset with productive cycle)", () => {
    const r = evaluateRotationState([cycle("2026-08-24T10:00:00Z", 0)], "reactivate", new Date());
    expect(r.state).toBe("reactivate");
  });

  it("a productive cycle after saturation would re-evaluate to build (SATURATED input ignored when latest has new records)", () => {
    // Note: caller passes currentState=saturated but the latest cycle now
    // shows records_new>0 · saturation is a stale reading.
    // Our evaluator returns 'build' because SATURATION check requires the
    // top-of-history streak (which is 0 here).
    const r = evaluateRotationState([cycle("2026-08-24T10:00:00Z", 4)], "saturated", new Date(Date.now() - 1e6));
    // Not currently 'saturated' since latest is productive · but also not
    // 'reactivate' since we didn't flag it. Returns 'build'.
    expect(r.state).toBe("build");
  });
});

describe("pickNextWorkItem · priority + fairness", () => {
  const items = buildWorkItemRegistry().filter((w) => w.walkerAvailable);

  it("returns null when no walker-available items are supplied", () => {
    expect(pickNextWorkItem([], [])).toBeNull();
  });

  it("prefers REACTIVATE over BUILD over MAINTENANCE · never picks SATURATED", () => {
    const states: RotationStateRow[] = items.slice(0, 4).map((wi, i) => ({
      city: wi.city, category: wi.category, round: 1,
      state: (["saturated", "build", "reactivate", "maintenance"] as const)[i],
      lastCycleStartedAt: new Date("2026-08-24T00:00:00Z"),
      lastProductiveAt:  new Date("2026-08-24T00:00:00Z"),
    }));
    const pick = pickNextWorkItem(states, items.slice(0, 4));
    expect(pick).not.toBeNull();
    // The reactivate item should be picked
    expect(pick!.city).toBe(items[2].city);
    expect(pick!.category).toBe(items[2].category);
  });

  it("within same priority tier · prefers oldest lastCycleStartedAt (fairness)", () => {
    const same = items.filter((w) => w.category === "market").slice(0, 3);
    const states: RotationStateRow[] = same.map((wi, i) => ({
      city: wi.city, category: wi.category, round: 1,
      state: "build",
      lastCycleStartedAt: new Date(`2026-08-2${i + 1}T00:00:00Z`), // oldest = 21st, then 22nd, 23rd
      lastProductiveAt:  new Date(`2026-08-2${i + 1}T00:00:00Z`),
    }));
    const pick = pickNextWorkItem(states, same);
    expect(pick!.city).toBe(same[0].city); // oldest lastCycleStartedAt wins
  });

  it("combos with NO state row default to build → still picked over saturated ones", () => {
    const states: RotationStateRow[] = [
      { city: items[0].city, category: items[0].category, round: 1, state: "saturated", lastCycleStartedAt: new Date(), lastProductiveAt: null },
    ];
    const pick = pickNextWorkItem(states, items.slice(0, 3));
    expect(pick).not.toBeNull();
    // Should NOT be items[0] because that's saturated · should be one of the newer combos
    expect(pick!.city + ":" + pick!.category).not.toBe(items[0].city + ":" + items[0].category);
  });

  it("returns null when ALL walker-available items are saturated", () => {
    const states: RotationStateRow[] = items.map((wi) => ({
      city: wi.city, category: wi.category, round: 1,
      state: "saturated",
      lastCycleStartedAt: new Date(),
      lastProductiveAt: null,
    }));
    expect(pickNextWorkItem(states, items)).toBeNull();
  });
});

describe("buildRotationSnapshot · honest per-combo grid", () => {
  it("produces one row per work item", () => {
    const items = buildWorkItemRegistry();
    const snap = buildRotationSnapshot([], items);
    expect(snap.length).toBe(items.length);
  });

  it("empty states → all rows default to state=build with null timestamps", () => {
    const items = buildWorkItemRegistry();
    const snap = buildRotationSnapshot([], items);
    for (const r of snap) {
      expect(r.state).toBe("build");
      expect(r.lastCycleStartedAt).toBeNull();
    }
  });

  it("state row is merged onto the correct work item by (city, category, round)", () => {
    const items = buildWorkItemRegistry();
    const target = items.find((i) => i.category === "market" && i.city === "Sleman")!;
    const states: RotationStateRow[] = [{
      city: target.city, category: target.category, round: 1,
      state: "saturated",
      lastCycleStartedAt: new Date("2026-08-24T10:00:00Z"),
      lastProductiveAt: new Date("2026-08-20T10:00:00Z"),
    }];
    const snap = buildRotationSnapshot(states, items);
    const merged = snap.find((r) => r.city === "Sleman" && r.category === "market")!;
    expect(merged.state).toBe("saturated");
    expect(merged.lastCycleStartedAt).toEqual(new Date("2026-08-24T10:00:00Z"));
  });

  it("non-available combos preserve their honesty note", () => {
    const items = buildWorkItemRegistry();
    const snap = buildRotationSnapshot([], items);
    const unavailable = snap.filter((r) => !r.walkerAvailable);
    for (const u of unavailable) expect(u.note).toBeTruthy();
  });
});

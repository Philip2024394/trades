// src/lib/nex-hq/auto-orchestrator.test.ts

import { describe, it, expect } from "vitest";
import { buildDiscoveryQueue, pickForNextSlot, pickForFreeSlots, parseWorkerConfig, MAX_SLOTS, FAIRNESS_CONSECUTIVE_CAP } from "./auto-orchestrator";
import { buildWorkItemRegistry, buildRotationSnapshot, type RotationStateRow, type WalkedCategory } from "./discovery-rotation";

const workItems = buildWorkItemRegistry();
const walkable = workItems.filter((w) => w.walkerAvailable);

function stateRow(city: string, category: WalkedCategory, state: RotationStateRow["state"], lastStartedAt = new Date("2026-08-24T00:00:00Z")): RotationStateRow {
  return { city, category, round: 1, state, lastCycleStartedAt: lastStartedAt, lastProductiveAt: lastStartedAt };
}

describe("Constants · Stage 10 ladder (2026-08-24)", () => {
  it("MAX_SLOTS is 10 (Stage 10 · after Phase C transport city-configurability)", () => {
    expect(MAX_SLOTS).toBe(10);
  });
  it("FAIRNESS_CONSECUTIVE_CAP is 2 (no monopolisation)", () => {
    expect(FAIRNESS_CONSECUTIVE_CAP).toBe(2);
  });
});

describe("buildDiscoveryQueue · priority + fairness", () => {
  it("marks the first eligible item as would-pick", () => {
    const snapshot = buildRotationSnapshot(
      walkable.map((w) => stateRow(w.city, w.category, "build")),
      workItems,
    );
    const q = buildDiscoveryQueue(snapshot, [], []);
    const wp = q.filter((i) => i.status === "would-pick");
    expect(wp.length).toBe(1);
  });

  it("never marks saturated items as would-pick", () => {
    const snapshot = buildRotationSnapshot(
      walkable.map((w) => stateRow(w.city, w.category, "saturated")),
      workItems,
    );
    const q = buildDiscoveryQueue(snapshot, [], []);
    expect(q.filter((i) => i.status === "would-pick").length).toBe(0);
    expect(q.every((i) => i.state !== "saturated" || i.status === "skipped-saturated" || i.status === "skipped-not-city-configurable")).toBe(true);
  });

  it("REACTIVATE has higher priority than BUILD (both eligible · reactivate wins the would-pick)", () => {
    const target = walkable[0];
    const other  = walkable[1];
    const states = [
      stateRow(other.city, other.category, "build", new Date("2020-01-01")), // oldest
      stateRow(target.city, target.category, "reactivate", new Date("2026-08-24T00:00:00Z")),
    ];
    const snapshot = buildRotationSnapshot(states, [target, other]);
    const q = buildDiscoveryQueue(snapshot, [], []);
    const wp = q.find((i) => i.status === "would-pick")!;
    expect(wp.city).toBe(target.city);
    expect(wp.category).toBe(target.category);
  });

  it("within same priority · picks OLDEST lastCycleStartedAt (fairness)", () => {
    const [a, b] = walkable.filter((w) => w.category === "market").slice(0, 2);
    const states = [
      stateRow(a.city, a.category, "build", new Date("2026-08-25T00:00:00Z")), // newer
      stateRow(b.city, b.category, "build", new Date("2026-08-20T00:00:00Z")), // older → should win
    ];
    const snapshot = buildRotationSnapshot(states, [a, b]);
    const q = buildDiscoveryQueue(snapshot, [], []);
    const wp = q.find((i) => i.status === "would-pick")!;
    expect(wp.city).toBe(b.city);
  });

  it("marks in-flight items as in-flight and does NOT pick them again", () => {
    const target = walkable[0];
    const snapshot = buildRotationSnapshot([stateRow(target.city, target.category, "build")], [target]);
    const q = buildDiscoveryQueue(snapshot, [{ cycleId: "c1", city: target.city, category: target.category, startedAt: new Date() }], []);
    const row = q.find((i) => i.city === target.city && i.category === target.category)!;
    expect(row.status).toBe("in-flight");
    expect(q.find((i) => i.status === "would-pick")).toBeUndefined();
  });

  it("provider-gated combos are skipped honestly (never picked)", () => {
    const target = walkable[0];
    const snapshot = buildRotationSnapshot([stateRow(target.city, target.category, "build")], [target]);
    const gated = new Set([`${target.city}:${target.category}`]);
    const q = buildDiscoveryQueue(snapshot, [], [], gated);
    const row = q.find((i) => i.city === target.city && i.category === target.category)!;
    expect(row.status).toBe("skipped-gated-provider");
  });

  it("walker-unavailable combos (when present) surface as skipped-not-city-configurable (never fake activity)", () => {
    // Post-Phase-C (2026-08-24) every combo is city-configurable · zero unavailable.
    // Test proves that IF an unavailable combo existed it would surface honestly ·
    // synthesised via a stub item with walkerAvailable=false.
    const stubItem = { city: "Nowhereville", category: "market" as const, walkerAvailable: false, script: undefined, workerConfigLikePrefix: undefined, note: "synthetic unavailable for test" };
    const snapshot = buildRotationSnapshot([], [stubItem]);
    const q = buildDiscoveryQueue(snapshot, [], []);
    const unavailable = q.filter((i) => !i.walkerAvailable);
    expect(unavailable.length).toBeGreaterThan(0);
    for (const u of unavailable) expect(u.status).toBe("skipped-not-city-configurable");
  });

  it("fairness · caps consecutive picks at FAIRNESS_CONSECUTIVE_CAP · yields to another combo", () => {
    const [a, b] = walkable.filter((w) => w.category === "market").slice(0, 2);
    const states = [
      stateRow(a.city, a.category, "build", new Date("2026-08-20T00:00:00Z")),
      stateRow(b.city, b.category, "build", new Date("2026-08-25T00:00:00Z")),
    ];
    const snapshot = buildRotationSnapshot(states, [a, b]);
    const recent = Array.from({ length: FAIRNESS_CONSECUTIVE_CAP }, (_, i) => ({
      city: a.city, category: a.category, pickedAt: new Date(2026, 7, 24, 10, i),
    }));
    const q = buildDiscoveryQueue(snapshot, [], recent);
    const aRow = q.find((i) => i.city === a.city && i.category === a.category)!;
    const bRow = q.find((i) => i.city === b.city && i.category === b.category)!;
    expect(aRow.status).toBe("waiting-cooldown");
    expect(bRow.status).toBe("would-pick");
  });

  it("all-saturated · no would-pick · queue still surfaces every combo honestly", () => {
    const snapshot = buildRotationSnapshot(
      walkable.map((w) => stateRow(w.city, w.category, "saturated")),
      workItems,
    );
    const q = buildDiscoveryQueue(snapshot, [], []);
    expect(q.length).toBe(workItems.length);
    expect(q.find((i) => i.status === "would-pick")).toBeUndefined();
  });
});

describe("pickForNextSlot · concurrency + eligibility", () => {
  it("returns null when slots full", () => {
    const target = walkable[0];
    const snapshot = buildRotationSnapshot([stateRow(target.city, target.category, "build")], [target]);
    const q = buildDiscoveryQueue(snapshot, [], []);
    expect(pickForNextSlot(q, MAX_SLOTS)).toBeNull();
  });

  it("returns null when no would-pick exists (all saturated / all in-flight)", () => {
    const snapshot = buildRotationSnapshot(walkable.map((w) => stateRow(w.city, w.category, "saturated")), workItems);
    const q = buildDiscoveryQueue(snapshot, [], []);
    expect(pickForNextSlot(q, 0)).toBeNull();
  });

  it("returns the would-pick item when a slot is free", () => {
    const target = walkable[0];
    const snapshot = buildRotationSnapshot([stateRow(target.city, target.category, "build")], [target]);
    const q = buildDiscoveryQueue(snapshot, [], []);
    const pick = pickForNextSlot(q, 0);
    expect(pick).not.toBeNull();
    expect(pick!.city).toBe(target.city);
  });

  it("never picks a walker-unavailable item even if flagged would-pick (defence in depth)", () => {
    // Construct a queue where a would-pick has walkerAvailable=false (impossible via
    // buildDiscoveryQueue but pickForNextSlot must still refuse).
    const bad: ReturnType<typeof buildDiscoveryQueue> = [{
      city: "Nowhere", category: "market", round: 1,
      state: "build", walkerAvailable: false, script: null,
      lastCycleStartedAt: null, recordsNewLastCycle: null,
      reason: "forced would-pick", status: "would-pick",
    }];
    expect(pickForNextSlot(bad, 0)).toBeNull();
  });
});

describe("pickForFreeSlots · multi-slot Phase A picker", () => {
  const items = buildWorkItemRegistry().filter((w) => w.walkerAvailable);

  it("returns empty when no free slots", () => {
    const q = buildDiscoveryQueue(buildRotationSnapshot(items.map((w) => stateRow(w.city, w.category, "build")), items), [], []);
    expect(pickForFreeSlots(q, MAX_SLOTS)).toEqual([]);
  });

  it("returns up to N picks when N slots free", () => {
    const q = buildDiscoveryQueue(buildRotationSnapshot(items.map((w) => stateRow(w.city, w.category, "build")), items), [], []);
    const picks = pickForFreeSlots(q, 0);   // all slots free
    expect(picks.length).toBeLessThanOrEqual(MAX_SLOTS);
    expect(picks.length).toBeGreaterThan(0);
  });

  it("never picks two combos with the same (city, category) key", () => {
    const q = buildDiscoveryQueue(buildRotationSnapshot(items.map((w) => stateRow(w.city, w.category, "build")), items), [], []);
    const picks = pickForFreeSlots(q, 0);
    const keys = picks.map((p) => `${p.city}:${p.category}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("prefers diverse cities when alternatives are available (per-tick fairness)", () => {
    const marketItems = items.filter((w) => w.category === "market").slice(0, 5);
    const q = buildDiscoveryQueue(buildRotationSnapshot(marketItems.map((w) => stateRow(w.city, w.category, "build")), marketItems), [], []);
    const picks = pickForFreeSlots(q, 0, 5);
    const cities = picks.map((p) => p.city);
    // With 5 market combos across 5 cities · picker should pick 5 distinct cities.
    expect(new Set(cities).size).toBe(cities.length);
  });

  it("never picks a walker-unavailable combo", () => {
    // Include unavailable items · verify none picked.
    const q = buildDiscoveryQueue(buildRotationSnapshot(items.map((w) => stateRow(w.city, w.category, "build")), buildWorkItemRegistry()), [], []);
    const picks = pickForFreeSlots(q, 0);
    for (const p of picks) expect(p.walkerAvailable).toBe(true);
  });

  it("never picks saturated combos", () => {
    const q = buildDiscoveryQueue(buildRotationSnapshot(items.map((w) => stateRow(w.city, w.category, "saturated")), items), [], []);
    expect(pickForFreeSlots(q, 0)).toEqual([]);
  });

  it("respects the freeSlots ceiling exactly", () => {
    const q = buildDiscoveryQueue(buildRotationSnapshot(items.map((w) => stateRow(w.city, w.category, "build")), items), [], []);
    for (const n of [1, 2, 3, 4, 5]) {
      const picks = pickForFreeSlots(q, MAX_SLOTS - n, MAX_SLOTS);
      expect(picks.length).toBeLessThanOrEqual(n);
    }
  });
});

describe("parseWorkerConfig · maps cycle_run.worker_config back to (city, category)", () => {
  const wi = buildWorkItemRegistry();

  it("resolves 'market:yogyakarta:overpass' to Yogyakarta / market", () => {
    expect(parseWorkerConfig("market:yogyakarta:overpass", wi)).toEqual({ city: "Yogyakarta", category: "market" });
  });

  it("resolves 'market:kulon-progo:overpass' to Kulon Progo / market (hyphenated form)", () => {
    expect(parseWorkerConfig("market:kulon-progo:overpass", wi)).toEqual({ city: "Kulon Progo", category: "market" });
  });

  it("resolves 'accommodation:Yogyakarta:prambanan' to Yogyakarta / accommodation", () => {
    expect(parseWorkerConfig("accommodation:Yogyakarta:prambanan", wi)).toEqual({ city: "Yogyakarta", category: "accommodation" });
  });

  it("returns null on unrecognisable configs", () => {
    expect(parseWorkerConfig("random-garbage", wi)).toBeNull();
    expect(parseWorkerConfig(null, wi)).toBeNull();
    expect(parseWorkerConfig("", wi)).toBeNull();
  });
});

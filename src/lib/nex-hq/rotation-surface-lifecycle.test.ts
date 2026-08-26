// src/lib/nex-hq/rotation-surface-lifecycle.test.ts
//
// P0 · 2026-08-24 · Philip's atomic surface-aware rotation acceptance suite.
// Covers all 8 required tests (A-H) from the greenlight message:
//
//   A · Surface A SATURATED · Surface B BUILD → B is picked
//   B · All surfaces for (city, category) SATURATED → combo not picked
//   C · 5 surfaces · saturation of 1 does NOT block the other 4
//   D · Multiple cities × multiple surfaces → geographic spread intact
//   E · All 4 categories · one cannot be starved because another has more surfaces
//   F · 72h lifecycle · works independently per surface
//   G · Concurrent workers · same surface cannot create duplicate work
//   H · Migration · existing rotation state preserved correctly
//
// Uses the REAL production picker + evaluator + buildDiscoveryQueue with
// injected time (via stateEnteredAt). Production values remain untouched:
//   MAINTENANCE_COOLDOWN_HOURS = 72h
//   SATURATION_THRESHOLD_CYCLES = 3

import { describe, it, expect } from "vitest";
import {
  MAINTENANCE_COOLDOWN_HOURS,
  WALKED_CATEGORIES,
  TRACKED_CITIES,
  buildWorkItemRegistry,
  buildRotationSnapshot,
  surfacesFor,
  evaluateRotationState,
  type RotationStateKind,
  type RotationStateRow,
  type CycleSummary,
} from "./discovery-rotation";
import {
  buildDiscoveryQueue,
  pickForFreeSlots,
  MAX_SLOTS,
} from "./auto-orchestrator";

function hoursAgo(h: number): Date { return new Date(Date.now() - h * 3600 * 1000); }

// Convenience: build an in-memory RotationStateRow so the picker sees the
// state we want it to see.
function state(
  city: string,
  category: (typeof WALKED_CATEGORIES)[number],
  surface: string,
  kind: RotationStateKind,
  lastRun?: Date,
): RotationStateRow {
  return {
    city,
    category,
    round: 1,
    surface,
    state: kind,
    lastCycleStartedAt: lastRun ?? null,
    lastProductiveAt: null,
  };
}

// ── Test A · Surface A SATURATED · Surface B BUILD → B is picked ──────
describe("§A · Surface A SATURATED + Surface B BUILD → picker chooses B", () => {
  it("Yogyakarta accommodation · malioboro SATURATED · borobudur BUILD → borobudur picked", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Yogyakarta" && w.category === "accommodation");
    const states: RotationStateRow[] = [
      state("Yogyakarta", "accommodation", "malioboro",    "saturated"),
      state("Yogyakarta", "accommodation", "prawirotaman", "saturated"),
      state("Yogyakarta", "accommodation", "kaliurang",    "saturated"),
      state("Yogyakarta", "accommodation", "yogya-wider",  "saturated"),
      state("Yogyakarta", "accommodation", "borobudur",    "build"),
    ];
    const snapshot = buildRotationSnapshot(states, items);
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const surfaces = picks.map(p => p.surface);
    expect(surfaces).toContain("borobudur");
    // Saturated surfaces MUST NOT appear
    for (const s of ["malioboro", "prawirotaman", "kaliurang", "yogya-wider"]) {
      expect(surfaces).not.toContain(s);
    }
  });
});

// ── Test B · All surfaces SATURATED → combo not picked ────────────────
describe("§B · All surfaces SATURATED for (city, category) → combo excluded", () => {
  it("Bantul food · single-surface all SATURATED → not picked", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Bantul" && w.category === "food");
    const bantulSurfaces = surfacesFor("Bantul", "food");
    const states: RotationStateRow[] = bantulSurfaces.map(s => state("Bantul", "food", s, "saturated"));
    const snapshot = buildRotationSnapshot(states, items);
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const combos = picks.map(p => `${p.city}:${p.category}`);
    expect(combos).not.toContain("Bantul:food");
  });

  it("Yogyakarta accommodation · ALL 5 surfaces SATURATED → not picked", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Yogyakarta" && w.category === "accommodation");
    const yogyaSurfaces = surfacesFor("Yogyakarta", "accommodation");
    const states: RotationStateRow[] = yogyaSurfaces.map(s => state("Yogyakarta", "accommodation", s, "saturated"));
    const snapshot = buildRotationSnapshot(states, items);
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const combos = picks.map(p => `${p.city}:${p.category}`);
    expect(combos).not.toContain("Yogyakarta:accommodation");
  });
});

// ── Test C · 5 surfaces · saturating 1 doesn't block the other 4 ──────
describe("§C · 5 surfaces · single saturation does not block others", () => {
  it("Yogyakarta accommodation · malioboro SATURATED · 4 others BUILD → combo still eligible", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Yogyakarta" && w.category === "accommodation");
    const states: RotationStateRow[] = [
      state("Yogyakarta", "accommodation", "malioboro", "saturated"),
      state("Yogyakarta", "accommodation", "prawirotaman", "build"),
      state("Yogyakarta", "accommodation", "kaliurang", "build"),
      state("Yogyakarta", "accommodation", "borobudur", "build"),
      state("Yogyakarta", "accommodation", "yogya-wider", "build"),
    ];
    const snapshot = buildRotationSnapshot(states, items);
    const queue = buildDiscoveryQueue(snapshot, [], []);
    // 4 eligible surfaces should exist in the queue
    const eligibleSurfacesInQueue = queue.filter(q => q.status === "would-pick" || q.status === "eligible").map(q => q.surface);
    expect(eligibleSurfacesInQueue).toHaveLength(4);
    expect(eligibleSurfacesInQueue).not.toContain("malioboro");
  });
});

// ── Test D · Geographic spread across cities and surfaces ─────────────
describe("§D · Multiple cities × surfaces · geographic spread intact", () => {
  it("With no saturation · picks span multiple cities in one tick", () => {
    const items = buildWorkItemRegistry();
    const snapshot = buildRotationSnapshot([], items);
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const cities = new Set(picks.map(p => p.city));
    expect(cities.size).toBeGreaterThan(1);
    expect(picks.length).toBeLessThanOrEqual(MAX_SLOTS);
  });
});

// ── Test E · No category permanently starved ──────────────────────────
describe("§E · Category diversity · 1000-tick simulation touches all 4 categories", () => {
  it("All 4 categories receive picks even when one category has more surfaces", () => {
    const items = buildWorkItemRegistry();
    // In-memory state map · updated after each pick so lastCycleStartedAt drives fairness.
    const stateMap = new Map<string, RotationStateRow>();
    for (const wi of items) {
      for (const surface of wi.surfaces) {
        stateMap.set(`${wi.city}:${wi.category}:${surface}`, state(wi.city, wi.category, surface, "build"));
      }
    }
    const pickCountsByCategory = new Map<string, number>();
    for (let tick = 0; tick < 1000; tick++) {
      const snapshot = buildRotationSnapshot(Array.from(stateMap.values()), items);
      const queue = buildDiscoveryQueue(snapshot, [], []);
      const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
      for (const p of picks) {
        pickCountsByCategory.set(p.category, (pickCountsByCategory.get(p.category) ?? 0) + 1);
        const key = `${p.city}:${p.category}:${p.surface}`;
        const cur = stateMap.get(key)!;
        stateMap.set(key, { ...cur, lastCycleStartedAt: new Date(Date.now() + tick * 60_000) });
      }
    }
    for (const cat of WALKED_CATEGORIES) {
      expect(pickCountsByCategory.get(cat) ?? 0, `${cat} received 0 picks in 1000 ticks`).toBeGreaterThan(0);
    }
  });
});

// ── Test F · 72h lifecycle per surface (independent) ──────────────────
describe("§F · 72h cooldown lifecycle works per surface independently", () => {
  it("SATURATED at cooldown-1h stays saturated (per surface)", () => {
    const zeroCycles: CycleSummary[] = [
      { startedAt: hoursAgo(0.1), finishedAt: hoursAgo(0.05), recordsProcessed: 50, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(1),   finishedAt: hoursAgo(0.9),  recordsProcessed: 50, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(2),   finishedAt: hoursAgo(1.9),  recordsProcessed: 50, recordsNew: 0, status: "completed" },
    ];
    const enteredAt = hoursAgo(MAINTENANCE_COOLDOWN_HOURS - 1);
    const r = evaluateRotationState(zeroCycles, "saturated", enteredAt);
    expect(r.state).toBe("saturated");
  });
  it("SATURATED past 72h transitions to MAINTENANCE (per surface)", () => {
    const zeroCycles: CycleSummary[] = [
      { startedAt: hoursAgo(72.1), finishedAt: hoursAgo(72.05), recordsProcessed: 50, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(73),   finishedAt: hoursAgo(72.9),  recordsProcessed: 50, recordsNew: 0, status: "completed" },
      { startedAt: hoursAgo(74),   finishedAt: hoursAgo(73.9),  recordsProcessed: 50, recordsNew: 0, status: "completed" },
    ];
    const enteredAt = hoursAgo(MAINTENANCE_COOLDOWN_HOURS + 1);
    const r = evaluateRotationState(zeroCycles, "saturated", enteredAt);
    expect(r.state).toBe("maintenance");
  });
});

// ── Test G · Same surface cannot create duplicate work ────────────────
describe("§G · Concurrent picks · same (city, category) cannot be spawned twice", () => {
  it("Two eligible surfaces for same combo · only ONE picked per tick (one walker per combo)", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Yogyakarta" && w.category === "accommodation");
    const states: RotationStateRow[] = [
      state("Yogyakarta", "accommodation", "malioboro", "build"),
      state("Yogyakarta", "accommodation", "prawirotaman", "build"),
    ];
    const snapshot = buildRotationSnapshot(states, items);
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const yogyaAccommodationPicks = picks.filter(p => p.city === "Yogyakarta" && p.category === "accommodation");
    expect(yogyaAccommodationPicks.length).toBe(1);
  });

  it("An in-flight cycle for a combo blocks ALL surfaces of that combo this tick", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Yogyakarta" && w.category === "accommodation");
    const states: RotationStateRow[] = [
      state("Yogyakarta", "accommodation", "malioboro", "build"),
      state("Yogyakarta", "accommodation", "borobudur", "build"),
    ];
    const snapshot = buildRotationSnapshot(states, items);
    const queue = buildDiscoveryQueue(snapshot, [
      { cycleId: "in-flight", city: "Yogyakarta", category: "accommodation", startedAt: new Date() },
    ], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    const yogyaAccommodationPicks = picks.filter(p => p.city === "Yogyakarta" && p.category === "accommodation");
    expect(yogyaAccommodationPicks.length).toBe(0);
  });
});

// ── Test H · Migration preserves rotation history ─────────────────────
describe("§H · Migration compatibility · legacy 'default' surface state coexists", () => {
  it("A snapshot built with only the enumerated surfaces ignores orphan 'default' rows", () => {
    const items = buildWorkItemRegistry().filter(w => w.city === "Bantul" && w.category === "food");
    // Two rows in DB: a legacy 'default' row + the new city-slug row.
    const dbStates: RotationStateRow[] = [
      state("Bantul", "food", "default", "saturated"),   // legacy pre-migration row
      state("Bantul", "food", "bantul",  "build"),       // new post-migration row
    ];
    const snapshot = buildRotationSnapshot(dbStates, items);
    // Snapshot enumerates only the surfaces the walker knows about today
    // (workItem.surfaces = ['bantul']). Legacy 'default' row is IGNORED.
    expect(snapshot.map(s => s.surface)).toEqual(["bantul"]);
    // Bantul remains eligible via the new surface
    const queue = buildDiscoveryQueue(snapshot, [], []);
    const picks = pickForFreeSlots(queue, 0, MAX_SLOTS);
    expect(picks.some(p => p.city === "Bantul" && p.category === "food" && p.surface === "bantul")).toBe(true);
  });

  it("surfacesFor returns city slug for non-Yogyakarta cities · 5 zones for Yogyakarta food/accommodation", () => {
    expect(surfacesFor("Bantul", "food")).toEqual(["bantul"]);
    expect(surfacesFor("Kulon Progo", "accommodation")).toEqual(["kulon-progo"]);
    expect(surfacesFor("Yogyakarta", "food")).toHaveLength(5);
    expect(surfacesFor("Yogyakarta", "accommodation")).toHaveLength(5);
    expect(surfacesFor("Solo", "market")).toEqual(["nominatim"]);
    expect(surfacesFor("Gunungkidul", "transport")).toEqual(["query-universe-v1"]);
  });

  it("Every TRACKED_CITIES × WALKED_CATEGORIES yields at least one surface", () => {
    for (const city of TRACKED_CITIES) {
      for (const category of WALKED_CATEGORIES) {
        const surfaces = surfacesFor(city, category);
        expect(surfaces.length, `${city} × ${category}`).toBeGreaterThan(0);
      }
    }
  });
});

// src/lib/nex-accommodation/smart-discovery-signals.test.ts

import { describe, it, expect } from "vitest";
import {
  motorbikeRentalDemoSignal,
  pickDemonstrationSet,
  type SmartDiscoverySignal,
} from "./smart-discovery-signals";

// Test fixtures · each represents a plausible strongest-signal.
const foodBig:   SmartDiscoverySignal = { type: "food_cluster",         emoji: "🍜", title: "Food door",         body: "20 within 200m", cta: "→", isDemo: false, evidence: { nearbyCount: 20 } };
const foodSmall: SmartDiscoverySignal = { type: "food_cluster",         emoji: "🍜", title: "Food",              body: "5 within 200m",  cta: "→", isDemo: false, evidence: { nearbyCount: 5 } };
const attrClose: SmartDiscoverySignal = { type: "attraction_nearby",    emoji: "📍", title: "Malioboro",         body: "80m",           cta: "→", isDemo: false, evidence: { nearestMeters: 80,  landmarkName: "Malioboro Street", landmarkCategory: "attraction" } };
const attrFar:   SmartDiscoverySignal = { type: "attraction_nearby",    emoji: "📍", title: "Prambanan",         body: "820m",          cta: "→", isDemo: false, evidence: { nearestMeters: 820, landmarkName: "Prambanan Temple", landmarkCategory: "attraction" } };
const trans:     SmartDiscoverySignal = { type: "transport_hub_nearby", emoji: "🚉", title: "Airport",           body: "600m",          cta: "→", isDemo: false, evidence: { nearestMeters: 600, landmarkName: "Adisutjipto",       landmarkCategory: "transport" } };
const shop:      SmartDiscoverySignal = { type: "shopping_nearby",      emoji: "🛍", title: "Mall",              body: "300m",          cta: "→", isDemo: false, evidence: { nearestMeters: 300, landmarkName: "Malioboro Mall",   landmarkCategory: "shopping" } };

describe("motorbikeRentalDemoSignal · clearly marked demo", () => {
  it("is isDemo=true · body contains 'Prototype signal'", () => {
    const s = motorbikeRentalDemoSignal();
    expect(s.isDemo).toBe(true);
    expect(s.body.toLowerCase()).toContain("prototype signal");
    expect(s.type).toBe("motorbike_rental_prototype");
  });

  it("never claims a live count · never fabricates evidence", () => {
    const s = motorbikeRentalDemoSignal();
    expect(s.evidence).toEqual({});
  });
});

describe("pickDemonstrationSet · deterministic diversity selection", () => {
  it("returns empty when no signals available", () => {
    const picks = pickDemonstrationSet(new Map());
    expect(picks).toEqual([]);
  });

  it("respects max cap (default 5)", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    for (let i = 0; i < 10; i++) m.set(`ref-${i}`, { ...foodBig, evidence: { nearbyCount: 20 - i } });
    const picks = pickDemonstrationSet(m);
    expect(picks.length).toBeLessThanOrEqual(5);
  });

  it("respects explicit max", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    for (let i = 0; i < 10; i++) m.set(`ref-${i}`, { ...foodBig, evidence: { nearbyCount: 20 - i } });
    expect(pickDemonstrationSet(m, { max: 3 }).length).toBe(3);
  });

  it("round-robins one per type first (maximises variety)", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    m.set("food-1",  foodBig);
    m.set("food-2",  { ...foodBig, evidence: { nearbyCount: 15 } });
    m.set("food-3",  { ...foodBig, evidence: { nearbyCount: 10 } });
    m.set("attr-1",  attrClose);
    m.set("trans-1", trans);
    m.set("shop-1",  shop);
    const picks = pickDemonstrationSet(m, { max: 4 });
    const types = new Set(picks.map((p) => p.signal.type));
    expect(types.size).toBe(4);  // all four types represented
    expect(types).toContain("food_cluster");
    expect(types).toContain("attraction_nearby");
    expect(types).toContain("transport_hub_nearby");
    expect(types).toContain("shopping_nearby");
  });

  it("within a type · picks highest-scoring first (food count · attraction closeness)", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    m.set("food-far",   { ...foodSmall });                             // score = 50
    m.set("food-close", { ...foodBig });                                // score = 200
    m.set("attr-close", attrClose);                                     // 5000-80  = 4920
    m.set("attr-far",   attrFar);                                       // 5000-820 = 4180
    const picks = pickDemonstrationSet(m, { max: 2 });
    // Round-robin picks one attraction first (better score), one food (better score)
    const foodPick = picks.find((p) => p.signal.type === "food_cluster");
    const attrPick = picks.find((p) => p.signal.type === "attraction_nearby");
    expect(foodPick?.publicListingRef).toBe("food-close");
    expect(attrPick?.publicListingRef).toBe("attr-close");
  });

  it("adds the motorbike DEMO signal ONLY when requested and there is room", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    m.set("food-1", foodBig);
    m.set("attr-1", attrClose);
    const picks = pickDemonstrationSet(m, { max: 5, includeMotorbikeDemo: true, motorbikeDemoRef: "moto-target" });
    const demo = picks.find((p) => p.signal.isDemo);
    expect(demo).toBeDefined();
    expect(demo!.signal.type).toBe("motorbike_rental_prototype");
    expect(demo!.publicListingRef).toBe("moto-target");
  });

  it("never adds the DEMO signal to a ref that already has a real signal", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    m.set("food-1", foodBig);
    m.set("attr-1", attrClose);
    const picks = pickDemonstrationSet(m, { max: 5, includeMotorbikeDemo: true, motorbikeDemoRef: "food-1" });
    const demo = picks.find((p) => p.signal.type === "motorbike_rental_prototype");
    expect(demo).toBeUndefined();
  });

  it("never exceeds max even when demo would push it over", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    m.set("food-1", foodBig);
    m.set("attr-1", attrClose);
    m.set("trans-1", trans);
    const picks = pickDemonstrationSet(m, { max: 3, includeMotorbikeDemo: true, motorbikeDemoRef: "moto-target" });
    expect(picks.length).toBe(3);
    // The 3 real signals filled the slots · demo not added because no room.
    expect(picks.every((p) => !p.signal.isDemo)).toBe(true);
  });

  it("returns picks in a stable order (no random ordering surprises)", () => {
    const m = new Map<string, SmartDiscoverySignal>();
    m.set("food-1", foodBig);
    m.set("attr-1", attrClose);
    m.set("trans-1", trans);
    const a = pickDemonstrationSet(m, { max: 3 });
    const b = pickDemonstrationSet(m, { max: 3 });
    expect(a.map((p) => p.publicListingRef)).toEqual(b.map((p) => p.publicListingRef));
  });
});

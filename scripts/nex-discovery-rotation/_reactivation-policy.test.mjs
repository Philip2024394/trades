// Regression tests for scripts/nex-discovery-rotation/_reactivation-policy.mjs
// Philip 2026-08-26 P6 · lock in cooldown durations + 2× backoff behavior.

import { describe, it, expect } from "vitest";
import {
  cooldownHoursFor,
  computeCooldownUntil,
  assessReactivationOutcome,
  COOLDOWN_HOURS_BY_CATEGORY,
  DEFAULT_COOLDOWN_HOURS,
  UNPRODUCTIVE_BACKOFF_THRESHOLD,
  UNPRODUCTIVE_BACKOFF_MULTIPLIER,
} from "./_reactivation-policy.mjs";

describe("Reactivation policy · approved cooldowns (Philip 2026-08-26)", () => {
  it("food cooldown = 6h", () => {
    expect(cooldownHoursFor("food", 0)).toBe(6);
  });
  it("accommodation cooldown = 6h", () => {
    expect(cooldownHoursFor("accommodation", 0)).toBe(6);
  });
  it("transport cooldown = 6h", () => {
    expect(cooldownHoursFor("transport", 0)).toBe(6);
  });
  it("market cooldown = 12h", () => {
    expect(cooldownHoursFor("market", 0)).toBe(12);
  });
  it("unknown category → DEFAULT_COOLDOWN_HOURS (6h)", () => {
    expect(cooldownHoursFor("indonesia_discovery_temples", 0)).toBe(DEFAULT_COOLDOWN_HOURS);
    expect(DEFAULT_COOLDOWN_HOURS).toBe(6);
  });
});

describe("Reactivation policy · 2× backoff after 3 unproductive reactivations", () => {
  it("0 unproductive → base cooldown (6h for food)", () => {
    expect(cooldownHoursFor("food", 0)).toBe(6);
  });
  it("1 unproductive → still base", () => {
    expect(cooldownHoursFor("food", 1)).toBe(6);
  });
  it("2 unproductive → still base", () => {
    expect(cooldownHoursFor("food", 2)).toBe(6);
  });
  it("3 unproductive → 2× backoff (12h for food)", () => {
    expect(cooldownHoursFor("food", 3)).toBe(12);
  });
  it("5 unproductive → still 2× (no further stacking)", () => {
    expect(cooldownHoursFor("food", 5)).toBe(12);
  });
  it("3 unproductive on market → 2× 12h = 24h", () => {
    expect(cooldownHoursFor("market", 3)).toBe(24);
  });
  it("threshold constant is 3", () => {
    expect(UNPRODUCTIVE_BACKOFF_THRESHOLD).toBe(3);
  });
  it("multiplier constant is 2", () => {
    expect(UNPRODUCTIVE_BACKOFF_MULTIPLIER).toBe(2);
  });
});

describe("computeCooldownUntil · deterministic timestamp math", () => {
  it("food 0-unproductive · returns NOW + 6h", () => {
    const now = new Date("2026-08-26T14:00:00Z");
    const result = computeCooldownUntil("food", 0, now);
    expect(result.getTime()).toBe(now.getTime() + 6 * 3600 * 1000);
  });
  it("market 0-unproductive · returns NOW + 12h", () => {
    const now = new Date("2026-08-26T14:00:00Z");
    const result = computeCooldownUntil("market", 0, now);
    expect(result.getTime()).toBe(now.getTime() + 12 * 3600 * 1000);
  });
  it("food 3-unproductive · returns NOW + 12h (2× backoff)", () => {
    const now = new Date("2026-08-26T14:00:00Z");
    const result = computeCooldownUntil("food", 3, now);
    expect(result.getTime()).toBe(now.getTime() + 12 * 3600 * 1000);
  });
});

describe("assessReactivationOutcome · consecutive-unproductive counter", () => {
  it("no reactivation reason set → unchanged, don't consume reason", () => {
    const r = assessReactivationOutcome({
      reactivationReason: null, consecutiveUnproductive: 5,
      lastCycleRecordsNew: 0, hasCycleSinceReactivation: true,
    });
    expect(r.newConsecutive).toBe(5);
    expect(r.consumeReason).toBe(false);
  });
  it("reactivation reason set, no cycle yet → unchanged", () => {
    const r = assessReactivationOutcome({
      reactivationReason: "cooldown-expired", consecutiveUnproductive: 2,
      lastCycleRecordsNew: 0, hasCycleSinceReactivation: false,
    });
    expect(r.newConsecutive).toBe(2);
    expect(r.consumeReason).toBe(false);
  });
  it("reactivation cycle produced records → reset to 0, consume reason", () => {
    const r = assessReactivationOutcome({
      reactivationReason: "cooldown-expired", consecutiveUnproductive: 3,
      lastCycleRecordsNew: 7, hasCycleSinceReactivation: true,
    });
    expect(r.newConsecutive).toBe(0);
    expect(r.consumeReason).toBe(true);
  });
  it("reactivation cycle produced 0 records → increment counter, consume reason", () => {
    const r = assessReactivationOutcome({
      reactivationReason: "cooldown-expired", consecutiveUnproductive: 2,
      lastCycleRecordsNew: 0, hasCycleSinceReactivation: true,
    });
    expect(r.newConsecutive).toBe(3);
    expect(r.consumeReason).toBe(true);
  });
});

describe("COOLDOWN_HOURS_BY_CATEGORY constant · frozen public contract", () => {
  it("registry contains exactly the 4 approved categories", () => {
    expect(Object.keys(COOLDOWN_HOURS_BY_CATEGORY).sort()).toEqual(
      ["accommodation", "food", "market", "transport"].sort()
    );
  });
  it("registry is frozen (cannot mutate at runtime)", () => {
    expect(Object.isFrozen(COOLDOWN_HOURS_BY_CATEGORY)).toBe(true);
  });
});

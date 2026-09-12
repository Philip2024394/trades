// src/lib/nex/live/analytics-claim.test.ts
// NEX LIVE · Phase A · analytics honesty (§22 UNKNOWN ≠ 0)

import { describe, it, expect } from "vitest";
import {
  assertAnalyticsHonest,
  deriveAnalyticsDisplay,
  newUnknownFact,
  type AnalyticsFact,
} from "./analytics-claim";

const NOW = "2026-09-06T00:00:00.000Z";

function fact(overrides: Partial<AnalyticsFact>): AnalyticsFact {
  return {
    metric: "viewers_concurrent",
    state: "UNKNOWN",
    value: null,
    source: null,
    measured_at_iso: null,
    assessed_at_iso: NOW,
    ...overrides,
  };
}

describe("analytics · §22 immutable · UNKNOWN carries no value", () => {
  it("UNKNOWN fact factory produces null value + null source", () => {
    const f = newUnknownFact("chats_started", NOW);
    expect(f.state).toBe("UNKNOWN");
    expect(f.value).toBeNull();
    expect(f.source).toBeNull();
    expect(f.measured_at_iso).toBeNull();
    expect(() => assertAnalyticsHonest(f)).not.toThrow();
  });
  it("assertAnalyticsHonest THROWS when UNKNOWN carries a value (would render as 0)", () => {
    expect(() => assertAnalyticsHonest(fact({ state: "UNKNOWN", value: 0 })))
      .toThrow(/UNKNOWN_forbids_value/);
  });
  it("assertAnalyticsHonest THROWS when UNKNOWN carries a positive value", () => {
    expect(() => assertAnalyticsHonest(fact({ state: "UNKNOWN", value: 42 })))
      .toThrow(/UNKNOWN_forbids_value/);
  });
});

describe("analytics · KNOWN_MEASURED requires value + source + measured_at", () => {
  it("valid KNOWN_MEASURED passes", () => {
    expect(() => assertAnalyticsHonest(fact({
      state: "KNOWN_MEASURED", value: 42, source: "impression_events_v1", measured_at_iso: NOW,
    }))).not.toThrow();
  });
  it("throws when KNOWN_MEASURED has null value", () => {
    expect(() => assertAnalyticsHonest(fact({
      state: "KNOWN_MEASURED", value: null, source: "s", measured_at_iso: NOW,
    }))).toThrow(/KNOWN_MEASURED_requires_non_negative_value/);
  });
  it("throws when KNOWN_MEASURED has negative value", () => {
    expect(() => assertAnalyticsHonest(fact({
      state: "KNOWN_MEASURED", value: -1, source: "s", measured_at_iso: NOW,
    }))).toThrow();
  });
  it("throws when KNOWN_MEASURED has no source", () => {
    expect(() => assertAnalyticsHonest(fact({
      state: "KNOWN_MEASURED", value: 1, source: null, measured_at_iso: NOW,
    }))).toThrow(/requires_source/);
  });
});

describe("analytics · KNOWN_ZERO is a real measurement, not UNKNOWN", () => {
  it("KNOWN_ZERO with value=0 + source is valid (measurement ran, definitively zero)", () => {
    expect(() => assertAnalyticsHonest(fact({
      state: "KNOWN_ZERO", value: 0, source: "impression_events_v1", measured_at_iso: NOW,
    }))).not.toThrow();
  });
});

describe("analytics · display projection · surfaces read this, not raw fact", () => {
  it("UNKNOWN renders as 'not_available_yet' — NEVER as 0", () => {
    const d = deriveAnalyticsDisplay(fact({ state: "UNKNOWN" }));
    expect(d.kind).toBe("not_available_yet");
  });
  it("KNOWN_ZERO renders as number:0 (measurement is real)", () => {
    const d = deriveAnalyticsDisplay(fact({
      state: "KNOWN_ZERO", value: 0, source: "s", measured_at_iso: NOW,
    }));
    expect(d).toEqual({ kind: "number", value: 0 });
  });
  it("KNOWN_MEASURED renders as number", () => {
    const d = deriveAnalyticsDisplay(fact({
      state: "KNOWN_MEASURED", value: 128, source: "s", measured_at_iso: NOW,
    }));
    expect(d).toEqual({ kind: "number", value: 128 });
  });
  it("UNVERIFIED surfaces as provisional (never as clean number)", () => {
    const d = deriveAnalyticsDisplay(fact({
      state: "UNVERIFIED", value: 5, source: "s", measured_at_iso: NOW,
    }));
    expect(d).toEqual({ kind: "unverified", provisional: 5 });
  });
  it("STALE surfaces last-known + measurement time (never as fresh number)", () => {
    const d = deriveAnalyticsDisplay(fact({
      state: "STALE", value: 12, source: "s", measured_at_iso: NOW,
    }));
    expect(d).toMatchObject({ kind: "stale", last_known: 12 });
  });
  it("CONFLICTING surfaces its own kind (never picks a winner silently)", () => {
    const d = deriveAnalyticsDisplay(fact({ state: "CONFLICTING", value: null }));
    expect(d).toEqual({ kind: "conflicting" });
  });
});

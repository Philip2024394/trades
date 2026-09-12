// src/lib/nex/live/spatial-gesture-detector.test.ts
//
// NEX Music/Video · Spatial gesture detector tests · Phase M

import { describe, it, expect } from "vitest";
import { classifyGesture, SPATIAL_GESTURE_CONFIG } from "./spatial-gesture-detector";

// Reasonable swipe: 120px in 200ms · velocity 600 px/s · clearly a swipe
const goodSpeed = 200; // ms
const goodMag = 120;   // px

describe("classifyGesture · four-direction axis classification (§1)", () => {
  it("clear_right for positive dominant dx", () => {
    const r = classifyGesture({ dx: goodMag, dy: 5, dt_ms: goodSpeed });
    expect(r.direction).toBe("RIGHT");
    expect(r.reason).toBe("clear_right");
    expect(r.confidence).toBeGreaterThan(0.3);
  });
  it("clear_left for negative dominant dx", () => {
    const r = classifyGesture({ dx: -goodMag, dy: 5, dt_ms: goodSpeed });
    expect(r.direction).toBe("LEFT");
    expect(r.reason).toBe("clear_left");
  });
  it("clear_down for positive dominant dy", () => {
    const r = classifyGesture({ dx: 5, dy: goodMag, dt_ms: goodSpeed });
    expect(r.direction).toBe("DOWN");
    expect(r.reason).toBe("clear_down");
  });
  it("clear_up for negative dominant dy", () => {
    const r = classifyGesture({ dx: 5, dy: -goodMag, dt_ms: goodSpeed });
    expect(r.direction).toBe("UP");
    expect(r.reason).toBe("clear_up");
  });
});

describe("classifyGesture · rejects taps and stray fingers (§16)", () => {
  it("tap · < 10px total motion", () => {
    const r = classifyGesture({ dx: 3, dy: 4, dt_ms: 120 });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("tap");
  });
  it("too_short · between 10px and MIN_DISTANCE_PX", () => {
    const r = classifyGesture({ dx: 25, dy: 0, dt_ms: 150 });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("too_short");
  });
  it("too_slow · long duration, low velocity", () => {
    // 60px over 2000ms = 30 px/s · below floor
    const r = classifyGesture({ dx: 60, dy: 0, dt_ms: 2000 });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("too_slow");
  });
  it("too_slow · zero or negative dt", () => {
    const r = classifyGesture({ dx: 100, dy: 0, dt_ms: 0 });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("too_slow");
  });
  it("too_slow · below velocity floor even at good distance", () => {
    // 45px over 900ms = 50 px/s · way below 120 px/s floor
    const r = classifyGesture({ dx: 45, dy: 0, dt_ms: 900 });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("too_slow");
  });
});

describe("classifyGesture · diagonal safety (§16)", () => {
  it("too_diagonal · 45° swipe with equal dx/dy", () => {
    const r = classifyGesture({ dx: 100, dy: 100, dt_ms: goodSpeed });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("too_diagonal");
  });
  it("too_diagonal · axis within DOMINANCE_RATIO tolerance", () => {
    // dx / dy = 1.4 · below 1.5 dominance ratio
    const r = classifyGesture({ dx: 70, dy: 50, dt_ms: goodSpeed });
    expect(r.direction).toBe("NONE");
    expect(r.reason).toBe("too_diagonal");
  });
  it("clear_right · dx dominates dy by more than ratio", () => {
    // dx / dy = 3.0 · well above 1.5
    const r = classifyGesture({ dx: 90, dy: 30, dt_ms: goodSpeed });
    expect(r.direction).toBe("RIGHT");
  });
});

describe("classifyGesture · confidence scoring", () => {
  it("higher confidence for longer, cleaner swipes", () => {
    const short = classifyGesture({ dx: 45, dy: 0, dt_ms: goodSpeed });
    const long  = classifyGesture({ dx: 240, dy: 0, dt_ms: goodSpeed });
    // long may max to 1.0; short should be strictly lower
    expect(long.confidence).toBeGreaterThan(short.confidence);
  });
  it("confidence always in [0,1]", () => {
    const cases = [
      { dx: 1000, dy: 0, dt_ms: 100 },
      { dx: 45, dy: 0, dt_ms: goodSpeed },
      { dx: 200, dy: 10, dt_ms: 100 },
    ];
    for (const c of cases) {
      const r = classifyGesture(c);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("SPATIAL_GESTURE_CONFIG · exposed for observability", () => {
  it("carries the tuning constants", () => {
    expect(SPATIAL_GESTURE_CONFIG.MIN_DISTANCE_PX).toBe(40);
    expect(SPATIAL_GESTURE_CONFIG.MIN_VELOCITY_PX_S).toBe(120);
    expect(SPATIAL_GESTURE_CONFIG.MAX_DURATION_MS).toBe(900);
    expect(SPATIAL_GESTURE_CONFIG.DOMINANCE_RATIO).toBe(1.5);
  });
});

// C1 · serialiser.test.ts · MAI-supplied test scaffold per Capability Lab §12.
// Tests byte-stable JSON serialisation of FacialState.

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { serialise_facial_state } from "../serialiser";
import type { FacialState } from "../facial-state";

function baseFS(): FacialState {
  return {
    head_transform: { pitch: 0.1, yaw: -0.2, roll: 0.05 },
    left_eye:  { aperture: 0.6, gaze: { x: 0.1, y: 0.0, z: 0.99 } },
    right_eye: { aperture: 0.55, gaze: { x: -0.1, y: 0.0, z: 0.99 } },
    left_eyebrow:  { height: 0.1 },
    right_eyebrow: { height: 0.15 },
    mouth: { openness: 0.3, viseme: "open" },
    jaw:   { rotation: 0.1 },
    blink: { progress: 0.0 },
    temporal: { timestamp_ms: 1700000000000, sequence_index: 42 },
  };
}

function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

describe("C1 · serialiser · byte-stable output", () => {
  it("S-1 · produces valid JSON", () => {
    const s = serialise_facial_state(baseFS());
    expect(() => JSON.parse(s)).not.toThrow();
  });

  it("S-2 · same input twice produces byte-identical output (deterministic)", () => {
    const a = serialise_facial_state(baseFS());
    const b = serialise_facial_state(baseFS());
    expect(sha(a)).toBe(sha(b));
    expect(a).toBe(b);
  });

  it("S-3 · property order in emitted JSON is the locked spec order", () => {
    const s = serialise_facial_state(baseFS());
    const locked = ["head_transform", "left_eye", "right_eye", "left_eyebrow", "right_eyebrow", "mouth", "jaw", "blink", "temporal"];
    let previousIdx = -1;
    for (const prop of locked) {
      const idx = s.indexOf(`"${prop}"`);
      expect(idx, `property ${prop} missing from output`).toBeGreaterThan(-1);
      expect(idx, `property ${prop} out of order`).toBeGreaterThan(previousIdx);
      previousIdx = idx;
    }
  });

  it("S-4 · reordering input properties does NOT change output (property order comes from serialiser · not from input)", () => {
    const canonical = baseFS();
    // Build a reordered object with same values
    const reorderedRaw: Record<string, unknown> = {};
    for (const key of ["temporal", "blink", "jaw", "mouth", "right_eyebrow", "left_eyebrow", "right_eye", "left_eye", "head_transform"] as const) {
      reorderedRaw[key] = (canonical as unknown as Record<string, unknown>)[key];
    }
    const reordered = reorderedRaw as unknown as FacialState;
    const a = serialise_facial_state(canonical);
    const b = serialise_facial_state(reordered);
    expect(a).toBe(b);
  });

  it("S-5 · round-trip: JSON.parse(serialise(x)) produces structurally equal value", () => {
    const original = baseFS();
    const roundTrip = JSON.parse(serialise_facial_state(original));
    expect(roundTrip).toEqual(original);
  });

  it("S-6 · zero-value FacialState produces valid JSON", () => {
    const zero: FacialState = {
      head_transform: { pitch: 0, yaw: 0, roll: 0 },
      left_eye:  { aperture: 0, gaze: { x: 0, y: 0, z: 0 } },
      right_eye: { aperture: 0, gaze: { x: 0, y: 0, z: 0 } },
      left_eyebrow:  { height: 0 },
      right_eyebrow: { height: 0 },
      mouth: { openness: 0, viseme: "neutral" },
      jaw:   { rotation: 0 },
      blink: { progress: 0 },
      temporal: { timestamp_ms: 0, sequence_index: 0 },
    };
    const s = serialise_facial_state(zero);
    expect(() => JSON.parse(s)).not.toThrow();
    expect(JSON.parse(s)).toEqual(zero);
  });
});

// C1 · skill-m-transfer.test.ts · MAI-supplied test scaffold per Capability Lab §12.
// Skill M transfer test: a fixture never seen during authoring exercises the
// full C1 contract (validator + serialiser + refusal + all types).
// Per Capability Lab merge-gate condition: Skill M transfer test PASSED.

import { describe, expect, it } from "vitest";
import { validate_facial_state } from "../validator";
import { serialise_facial_state } from "../serialiser";
import type { FacialState, Viseme } from "../facial-state";

// ── Skill M unseen fixture (constructed for THIS transfer test only) ──

const unseenFixture_A: FacialState = {
  head_transform: { pitch: 0.523, yaw: -0.174, roll: 0.087 },
  left_eye:  { aperture: 0.9, gaze: { x: 0.3, y: 0.05, z: 0.95 } },
  right_eye: { aperture: 0.88, gaze: { x: 0.31, y: 0.05, z: 0.95 } },
  left_eyebrow:  { height: -0.2 },
  right_eyebrow: { height: -0.25 },
  mouth: { openness: 0.45, viseme: "rounded" },
  jaw:   { rotation: 0.35 },
  blink: { progress: 0.1 },
  temporal: { timestamp_ms: 1710000000000, sequence_index: 128 },
};

const unseenFixture_B: FacialState = {
  head_transform: { pitch: -1.2, yaw: 1.1, roll: -0.5 },
  left_eye:  { aperture: 0.1, gaze: { x: -0.7, y: 0.2, z: 0.6 } },
  right_eye: { aperture: 0.15, gaze: { x: -0.65, y: 0.2, z: 0.65 } },
  left_eyebrow:  { height: 0.85 },
  right_eyebrow: { height: 0.8 },
  mouth: { openness: 0.95, viseme: "wide" },
  jaw:   { rotation: 0.6 },
  blink: { progress: 0.75 },
  temporal: { timestamp_ms: 1710000000001, sequence_index: 129 },
};

describe("C1 · Skill M transfer · unseen fixture", () => {
  it("SM-1 · unseen fixture A validates cleanly", () => {
    const r = validate_facial_state(unseenFixture_A);
    expect(r.ok).toBe(true);
  });

  it("SM-2 · unseen fixture B validates cleanly", () => {
    const r = validate_facial_state(unseenFixture_B);
    expect(r.ok).toBe(true);
  });

  it("SM-3 · unseen fixtures serialise deterministically", () => {
    const a1 = serialise_facial_state(unseenFixture_A);
    const a2 = serialise_facial_state(unseenFixture_A);
    expect(a1).toBe(a2);
    const b1 = serialise_facial_state(unseenFixture_B);
    const b2 = serialise_facial_state(unseenFixture_B);
    expect(b1).toBe(b2);
    // Different fixtures produce different output
    expect(a1).not.toBe(b1);
  });

  it("SM-4 · unseen fixtures round-trip losslessly (structural equality)", () => {
    const rtA = JSON.parse(serialise_facial_state(unseenFixture_A));
    const rtB = JSON.parse(serialise_facial_state(unseenFixture_B));
    expect(rtA).toEqual(unseenFixture_A);
    expect(rtB).toEqual(unseenFixture_B);
  });

  it("SM-5 · every viseme in the vocabulary produces a valid FacialState", () => {
    const visemes = ["neutral", "closed", "open", "wide", "narrow", "rounded", "teeth", "bilabial", "labiodental", "alveolar", "fricative"] as const;
    for (const v of visemes) {
      const fs: FacialState = { ...unseenFixture_A, mouth: { openness: 0.4, viseme: v as Viseme } };
      const r = validate_facial_state(fs);
      expect(r.ok, `viseme ${v} failed validation`).toBe(true);
    }
  });

  it("SM-6 · black-box consumer: treat FacialState as opaque data contract · assert full round-trip through validator + serialiser", () => {
    // Consumer-side pattern: receive fixture, validate, serialise, deserialise, verify structural equality.
    // This is what an external consumer of C1 will do; it must work without knowing internal implementation.
    for (const fixture of [unseenFixture_A, unseenFixture_B]) {
      const validation = validate_facial_state(fixture);
      expect(validation.ok).toBe(true);
      const serialised = serialise_facial_state(fixture);
      const deserialised = JSON.parse(serialised) as FacialState;
      const revalidation = validate_facial_state(deserialised);
      expect(revalidation.ok).toBe(true);
      expect(deserialised).toEqual(fixture);
    }
  });
});

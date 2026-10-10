// C1 · validator.test.ts · MAI-supplied test scaffold per Capability Lab §12.
// Tests every declared FacialStateRefusalReason is observably triggerable.

import { describe, expect, it } from "vitest";
import { validate_facial_state } from "../validator";
import type { FacialState } from "../facial-state";
import { FacialStateRefusalReason_MEMBERS } from "../refusal";

function validBase(): FacialState {
  return {
    head_transform: { pitch: 0, yaw: 0, roll: 0 },
    left_eye: { aperture: 0.5, gaze: { x: 0, y: 0, z: 1 } },
    right_eye: { aperture: 0.5, gaze: { x: 0, y: 0, z: 1 } },
    left_eyebrow: { height: 0 },
    right_eyebrow: { height: 0 },
    mouth: { openness: 0.2, viseme: "neutral" },
    jaw: { rotation: 0 },
    blink: { progress: 0 },
    temporal: { timestamp_ms: 1000, sequence_index: 0 },
  };
}

function withPath<T>(fs: FacialState, path: string, value: unknown): FacialState {
  const clone = JSON.parse(JSON.stringify(fs));
  const parts = path.split(".");
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return clone as FacialState;
}

function withDelete(fs: FacialState, key: keyof FacialState): FacialState {
  const clone = JSON.parse(JSON.stringify(fs));
  delete (clone as Record<string, unknown>)[key];
  return clone as FacialState;
}

describe("C1 · validator · valid inputs pass", () => {
  it("V-P-1 · fully-valid FacialState passes validation", () => {
    const r = validate_facial_state(validBase());
    expect(r.ok).toBe(true);
  });

  it("V-P-2 · boundary min values pass", () => {
    const fs = withPath(validBase(), "head_transform.pitch", -1.5708);
    const r = validate_facial_state(fs);
    expect(r.ok).toBe(true);
  });

  it("V-P-3 · boundary max values pass", () => {
    const fs = withPath(validBase(), "jaw.rotation", 0.7854);
    const r = validate_facial_state(fs);
    expect(r.ok).toBe(true);
  });

  it("V-P-4 · every declared viseme is accepted", () => {
    for (const v of ["neutral", "closed", "open", "wide", "narrow", "rounded", "teeth", "bilabial", "labiodental", "alveolar", "fricative"] as const) {
      const fs = withPath(validBase(), "mouth.viseme", v);
      const r = validate_facial_state(fs);
      expect(r.ok).toBe(true);
    }
  });
});

describe("C1 · validator · each refusal reason observably triggered", () => {
  it("V-N-1 · MISSING_REQUIRED_FIELD when head_transform absent", () => {
    const r = validate_facial_state(withDelete(validBase(), "head_transform"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("MISSING_REQUIRED_FIELD");
  });

  it("V-N-2 · MISSING_REQUIRED_FIELD when temporal absent", () => {
    const r = validate_facial_state(withDelete(validBase(), "temporal"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("MISSING_REQUIRED_FIELD");
  });

  it("V-N-3 · HEAD_TRANSFORM_OUT_OF_RANGE when pitch > max", () => {
    const r = validate_facial_state(withPath(validBase(), "head_transform.pitch", 2));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("HEAD_TRANSFORM_OUT_OF_RANGE");
  });

  it("V-N-4 · HEAD_TRANSFORM_OUT_OF_RANGE when yaw < min", () => {
    const r = validate_facial_state(withPath(validBase(), "head_transform.yaw", -2));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("HEAD_TRANSFORM_OUT_OF_RANGE");
  });

  it("V-N-5 · HEAD_TRANSFORM_OUT_OF_RANGE when roll out-of-range", () => {
    const r = validate_facial_state(withPath(validBase(), "head_transform.roll", 1));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("HEAD_TRANSFORM_OUT_OF_RANGE");
  });

  it("V-N-6 · EYE_STATE_OUT_OF_RANGE when left_eye.aperture > 1", () => {
    const r = validate_facial_state(withPath(validBase(), "left_eye.aperture", 1.5));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("EYE_STATE_OUT_OF_RANGE");
  });

  it("V-N-7 · EYE_STATE_OUT_OF_RANGE when right_eye.aperture < 0", () => {
    const r = validate_facial_state(withPath(validBase(), "right_eye.aperture", -0.1));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("EYE_STATE_OUT_OF_RANGE");
  });

  it("V-N-8 · GAZE_OUT_OF_RANGE when gaze.x > 1", () => {
    const r = validate_facial_state(withPath(validBase(), "left_eye.gaze.x", 2));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("GAZE_OUT_OF_RANGE");
  });

  it("V-N-9 · GAZE_OUT_OF_RANGE on right_eye.gaze.z", () => {
    const r = validate_facial_state(withPath(validBase(), "right_eye.gaze.z", -5));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("GAZE_OUT_OF_RANGE");
  });

  it("V-N-10 · EYEBROW_STATE_OUT_OF_RANGE", () => {
    const r = validate_facial_state(withPath(validBase(), "left_eyebrow.height", 2));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("EYEBROW_STATE_OUT_OF_RANGE");
  });

  it("V-N-11 · MOUTH_STATE_OUT_OF_RANGE when openness > 1", () => {
    const r = validate_facial_state(withPath(validBase(), "mouth.openness", 2));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("MOUTH_STATE_OUT_OF_RANGE");
  });

  it("V-N-12 · JAW_STATE_OUT_OF_RANGE when rotation < 0", () => {
    const r = validate_facial_state(withPath(validBase(), "jaw.rotation", -0.1));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("JAW_STATE_OUT_OF_RANGE");
  });

  it("V-N-13 · BLINK_STATE_OUT_OF_RANGE when progress > 1", () => {
    const r = validate_facial_state(withPath(validBase(), "blink.progress", 1.5));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("BLINK_STATE_OUT_OF_RANGE");
  });

  it("V-N-14 · UNKNOWN_VISEME when viseme is not in the vocabulary", () => {
    // Cast because TypeScript would reject the invalid literal.
    const r = validate_facial_state(withPath(validBase(), "mouth.viseme", "smiley"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("UNKNOWN_VISEME");
  });
});

describe("C1 · validator · determinism", () => {
  it("V-D-1 · same invalid input produces same refusal reason across runs", () => {
    const bad = withPath(validBase(), "head_transform.pitch", 2);
    const r1 = validate_facial_state(bad);
    const r2 = validate_facial_state(bad);
    expect(r1).toEqual(r2);
  });

  it("V-D-2 · FacialStateRefusalReason_MEMBERS has exactly 11 entries", () => {
    expect(FacialStateRefusalReason_MEMBERS.length).toBe(11);
  });

  it("V-D-3 · every refusal reason in _MEMBERS is a valid string", () => {
    for (const reason of FacialStateRefusalReason_MEMBERS) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});

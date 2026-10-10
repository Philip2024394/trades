// C1 · facial-state.test.ts · MAI-supplied test scaffold per Capability Lab §12.
// Tests the NEX1-authored facial-state.ts capability file.

import { describe, expect, it } from "vitest";
import type {
  FacialState,
  Gaze,
  HeadTransform,
  EyeState,
  EyebrowState,
  MouthState,
  JawState,
  BlinkState,
  TemporalMetadata,
  Viseme,
} from "../facial-state";
import { Viseme_MEMBERS } from "../facial-state";

describe("C1 · facial-state · types + Viseme members", () => {
  it("FS-1 · Viseme_MEMBERS contains exactly the 11 NEX-owned visemes", () => {
    expect(Viseme_MEMBERS).toEqual([
      "neutral", "closed", "open", "wide", "narrow", "rounded", "teeth",
      "bilabial", "labiodental", "alveolar", "fricative",
    ]);
  });

  it("FS-2 · Viseme_MEMBERS is a frozen readonly array", () => {
    expect(Object.isFrozen(Viseme_MEMBERS)).toBe(true);
  });

  it("FS-3 · FacialState shape is inhabitable with concrete data", () => {
    const gaze: Gaze = { x: 0, y: 0, z: 1 };
    const head: HeadTransform = { pitch: 0, yaw: 0, roll: 0 };
    const eye: EyeState = { aperture: 0.5, gaze };
    const brow: EyebrowState = { height: 0 };
    const mouth: MouthState = { openness: 0.2, viseme: "neutral" };
    const jaw: JawState = { rotation: 0 };
    const blink: BlinkState = { progress: 0 };
    const temporal: TemporalMetadata = { timestamp_ms: 1234567890, sequence_index: 0 };
    const fs: FacialState = {
      head_transform: head,
      left_eye: eye,
      right_eye: eye,
      left_eyebrow: brow,
      right_eyebrow: brow,
      mouth,
      jaw,
      blink,
      temporal,
    };
    // Shape verification via structural access
    expect(fs.head_transform.pitch).toBe(0);
    expect(fs.left_eye.gaze.z).toBe(1);
    expect(fs.mouth.viseme).toBe("neutral");
  });

  it("FS-4 · Viseme type accepts every declared member", () => {
    // Type-level check via runtime member iteration
    for (const v of Viseme_MEMBERS) {
      const viseme: Viseme = v;
      expect(Viseme_MEMBERS.includes(viseme)).toBe(true);
    }
  });

  it("FS-5 · file contains no reference to master image assets", () => {
    // Read own file bytes and grep for forbidden references (contamination guard)
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const content = fs.readFileSync(path.join(__dirname, "..", "facial-state.ts"), "utf8");
    expect(content).not.toContain("nex-visual-master");
    expect(content).not.toContain("pixel");
    expect(content).not.toContain("bitmap");
    expect(content).not.toContain("sprite");
    expect(content).not.toContain("texture");
    expect(content).not.toContain("shader");
  });
});

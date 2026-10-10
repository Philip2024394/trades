// Wave P1 · MAI-supplied test scaffold per Capability Lab §12.
// Tests the NEX1-authored types.ts capability file.

import { describe, expect, it } from "vitest";
import type { Band, MatchConfidence, MatchConfidenceRefusalReason } from "../types";
import { Band_MEMBERS, MatchConfidenceRefusalReason_MEMBERS } from "../types";

describe("P1 · types · Band + MatchConfidence + refusal-union integrity", () => {
  it("MCT-1 · Band_MEMBERS contains exactly the 4 ADR-0025 bands in the canonical order", () => {
    expect(Band_MEMBERS).toEqual(["very-high", "high", "good", "review"]);
  });

  it("MCT-2 · Band_MEMBERS is frozen (immutable)", () => {
    expect(Object.isFrozen(Band_MEMBERS)).toBe(true);
  });

  it("MCT-3 · Band type accepts every declared member", () => {
    for (const b of Band_MEMBERS) {
      const band: Band = b;
      expect(Band_MEMBERS.includes(band)).toBe(true);
    }
  });

  it("MCT-4 · MatchConfidence shape is inhabitable with concrete data", () => {
    const mc: MatchConfidence = { score: 0.97, band: "high" };
    expect(mc.score).toBe(0.97);
    expect(mc.band).toBe("high");
  });

  it("MCT-5 · MatchConfidenceRefusalReason_MEMBERS contains all 4 declared refusal reasons", () => {
    expect(MatchConfidenceRefusalReason_MEMBERS.length).toBe(4);
    expect(MatchConfidenceRefusalReason_MEMBERS).toContain("SCORE_OUT_OF_RANGE");
    expect(MatchConfidenceRefusalReason_MEMBERS).toContain("UNKNOWN_BAND");
    expect(MatchConfidenceRefusalReason_MEMBERS).toContain("MISSING_SCORE");
    expect(MatchConfidenceRefusalReason_MEMBERS).toContain("MISSING_BAND");
  });

  it("MCT-6 · refusal reasons are frozen", () => {
    expect(Object.isFrozen(MatchConfidenceRefusalReason_MEMBERS)).toBe(true);
  });

  it("MCT-7 · types file does NOT leak Route 2/2b/2c internals (contamination guard)", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const content = fs.readFileSync(path.join(__dirname, "..", "types.ts"), "utf8");
    // Must NOT reference any protected internals
    expect(content).not.toContain("nex-visual-master");
    expect(content).not.toContain("nex_storage");
    expect(content).not.toContain("eval(");
    expect(content).not.toContain("Function(");
  });
});

// Wave P1 · MAI-supplied test scaffold per Capability Lab §12.
// Tests the NEX1-authored validator.ts capability file.
// Every declared refusal reason must be observably triggerable.

import { describe, expect, it } from "vitest";
import { validate_match_confidence } from "../validator";
import type { MatchConfidence, Band } from "../types";

function withPath(mc: unknown, path: string, value: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(mc));
  const parts = path.split(".");
  let cursor: Record<string, unknown> = clone as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return clone;
}

function withDelete(mc: MatchConfidence, key: keyof MatchConfidence): unknown {
  const clone = JSON.parse(JSON.stringify(mc));
  delete (clone as Record<string, unknown>)[key];
  return clone;
}

const valid: MatchConfidence = { score: 0.97, band: "very-high" };

describe("P1 · validator · positive · valid inputs pass", () => {
  it("MCV-P-1 · valid MatchConfidence (0.97 · very-high) passes", () => {
    const r = validate_match_confidence(valid);
    expect(r.ok).toBe(true);
  });

  it("MCV-P-2 · every declared band accepted with valid score", () => {
    const bands: Band[] = ["very-high", "high", "good", "review"];
    for (const b of bands) {
      const r = validate_match_confidence({ score: 0.5, band: b });
      expect(r.ok, `band ${b} failed`).toBe(true);
    }
  });

  it("MCV-P-3 · score at boundary min (0) accepted", () => {
    const r = validate_match_confidence({ score: 0, band: "review" });
    expect(r.ok).toBe(true);
  });

  it("MCV-P-4 · score at boundary max (1) accepted", () => {
    const r = validate_match_confidence({ score: 1, band: "very-high" });
    expect(r.ok).toBe(true);
  });
});

describe("P1 · validator · every refusal reason observably triggered", () => {
  it("MCV-N-1 · MISSING_SCORE when score absent", () => {
    const r = validate_match_confidence(withDelete(valid, "score") as MatchConfidence);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("MISSING_SCORE");
  });

  it("MCV-N-2 · MISSING_BAND when band absent", () => {
    const r = validate_match_confidence(withDelete(valid, "band") as MatchConfidence);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("MISSING_BAND");
  });

  it("MCV-N-3 · SCORE_OUT_OF_RANGE when score > 1", () => {
    const r = validate_match_confidence(withPath(valid, "score", 1.5) as MatchConfidence);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("SCORE_OUT_OF_RANGE");
  });

  it("MCV-N-4 · SCORE_OUT_OF_RANGE when score < 0", () => {
    const r = validate_match_confidence(withPath(valid, "score", -0.1) as MatchConfidence);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("SCORE_OUT_OF_RANGE");
  });

  it("MCV-N-5 · UNKNOWN_BAND when band not in vocabulary", () => {
    const r = validate_match_confidence(withPath(valid, "band", "excellent") as MatchConfidence);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("UNKNOWN_BAND");
  });
});

describe("P1 · validator · determinism", () => {
  it("MCV-D-1 · same invalid input produces same refusal across runs", () => {
    const bad = withPath(valid, "score", 5) as MatchConfidence;
    const r1 = validate_match_confidence(bad);
    const r2 = validate_match_confidence(bad);
    expect(r1).toEqual(r2);
  });

  it("MCV-D-2 · same valid input produces same accept across runs", () => {
    const r1 = validate_match_confidence(valid);
    const r2 = validate_match_confidence(valid);
    expect(r1).toEqual(r2);
  });
});

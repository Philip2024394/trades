// Brand fingerprint — deterministic uniqueness hash.
// Two brands with identical traits produce the same fingerprint.
// Any trait change produces a different fingerprint.

import { describe, it, expect } from "vitest";
import { computeFingerprint } from "./fingerprint";

const base = {
  industry:        "plumbing",
  personality:     ["reliable", "modern"] as string[],
  geometry:        "geometric",
  construction:    "wordmark",
  primary_shape:   "house",
  secondary_shape: "none",
  style:           "architectural",
  symmetry:        "vertical",
  complexity:      "minimal",
  colour:          "#0A0A0A",
  accent:          "#FFB300",
  letterform:      "C"
};

describe("Brand fingerprint", () => {
  it("is deterministic across two identical brands", () => {
    const a = computeFingerprint({ ...base });
    const b = computeFingerprint({ ...base });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]+$/);
  });

  it("changes when the colour changes", () => {
    const a = computeFingerprint({ ...base });
    const b = computeFingerprint({ ...base, colour: "#FFFFFF" });
    expect(a).not.toBe(b);
  });

  it("changes when the industry changes", () => {
    const a = computeFingerprint({ ...base });
    const b = computeFingerprint({ ...base, industry: "electrical" });
    expect(a).not.toBe(b);
  });

  it("changes when personality changes", () => {
    const a = computeFingerprint({ ...base });
    const b = computeFingerprint({ ...base, personality: ["modern"] });
    expect(a).not.toBe(b);
  });
});

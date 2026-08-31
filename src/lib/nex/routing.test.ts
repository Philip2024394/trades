// routing.test.ts · unit-level coverage of pickRole.
//
// The Guardian regression gate (scripts/guardian) uses the same
// cases via routing.json for cross-validation, but keeping a vitest
// here means the routing heuristic is protected in normal `vitest
// run` as well as the guardian pass.

import { describe, it, expect } from "vitest";
import { pickRole, HARD_HINTS, LONG_MESSAGE_CHARS } from "./routing";

describe("pickRole · vision beats everything", () => {
  it("hasImage=true always resolves to vision.primary_local", () => {
    for (const message of ["hi", "Analyze this photo", "".padStart(1000, "a")]) {
      const r = pickRole({ message, hasImage: true });
      expect(r.role).toBe("vision.primary_local");
      expect(r.reason).toBe("image_attached");
    }
  });
});

describe("pickRole · hard hints route to primary", () => {
  for (const hint of HARD_HINTS) {
    it(`\"${hint}\" → brain.primary_local`, () => {
      const r = pickRole({ message: `Please ${hint} for me`, hasImage: false });
      expect(r.role).toBe("brain.primary_local");
      expect(r.reason).toBe(`hard_hint:${hint}`);
    });
  }

  it("case-insensitive match", () => {
    const r = pickRole({ message: "COMPARE Tokopedia and Shopee", hasImage: false });
    expect(r.role).toBe("brain.primary_local");
    expect(r.reason).toBe("hard_hint:compare");
  });
});

describe("pickRole · length threshold", () => {
  it(`exactly ${LONG_MESSAGE_CHARS} chars stays fast`, () => {
    const r = pickRole({ message: "a".repeat(LONG_MESSAGE_CHARS), hasImage: false });
    expect(r.role).toBe("brain.fast_local");
    expect(r.reason).toBe("default_fast");
  });

  it(`${LONG_MESSAGE_CHARS + 1} chars tips to primary`, () => {
    const r = pickRole({ message: "a".repeat(LONG_MESSAGE_CHARS + 1), hasImage: false });
    expect(r.role).toBe("brain.primary_local");
    expect(r.reason).toBe("length_gt_260");
  });
});

describe("pickRole · defaults", () => {
  it("short greeting → fast", () => {
    const r = pickRole({ message: "hi", hasImage: false });
    expect(r.role).toBe("brain.fast_local");
    expect(r.reason).toBe("default_fast");
  });

  it("empty message → fast (route validates empty elsewhere)", () => {
    const r = pickRole({ message: "", hasImage: false });
    expect(r.role).toBe("brain.fast_local");
  });

  it("Indonesian short chat → fast", () => {
    const r = pickRole({ message: "Halo NEX, apa kabar?", hasImage: false });
    expect(r.role).toBe("brain.fast_local");
    expect(r.reason).toBe("default_fast");
  });

  it("word containing hint substring doesn't fire (word-boundary is not enforced · document the current behaviour)", () => {
    // The heuristic uses .includes() rather than word boundaries.
    // "competitor" contains no hint word so this is fast.
    const r = pickRole({ message: "The competitor is Tokopedia.", hasImage: false });
    expect(r.role).toBe("brain.fast_local");
  });
});

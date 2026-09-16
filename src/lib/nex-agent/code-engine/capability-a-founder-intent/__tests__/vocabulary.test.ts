// NEX1 · CAPABILITY A · Vocabulary invariants · deterministic tests.
// Verifies the frozen vocabulary has no self-contradictions.

import { describe, it, expect } from "vitest";
import {
  DELIVERABLE_PHRASES,
  DELIVERABLE_SCAN_ORDER,
  REQUIREMENT_MARKERS,
  STOP_WORDS,
  VERB_FAMILY_VARIANTS,
  VERB_LEXEME_INDEX,
  VOCABULARY_VERSION,
} from "../vocabulary";

describe("capability-a · vocabulary invariants", () => {
  it("VOCABULARY_VERSION is a semver-ish tag (optional -alpha.N suffix for staged rollouts)", () => {
    expect(VOCABULARY_VERSION).toMatch(/^v\d+\.\d+\.\d+(-alpha\.\d+)?$/);
  });

  it("every verb family has at least three variants", () => {
    const families = Object.keys(VERB_FAMILY_VARIANTS) as (keyof typeof VERB_FAMILY_VARIANTS)[];
    for (const f of families) {
      expect(VERB_FAMILY_VARIANTS[f].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every verb variant is lowercase and non-empty", () => {
    const families = Object.keys(VERB_FAMILY_VARIANTS) as (keyof typeof VERB_FAMILY_VARIANTS)[];
    for (const f of families) {
      for (const v of VERB_FAMILY_VARIANTS[f]) {
        expect(v).toBe(v.toLowerCase());
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });

  it("no verb lexeme is claimed by two verb families (built by index)", () => {
    // Rebuild the index by hand to ensure the module-load guard fired.
    const seen = new Map<string, string>();
    const families = Object.keys(VERB_FAMILY_VARIANTS) as (keyof typeof VERB_FAMILY_VARIANTS)[];
    for (const f of families) {
      for (const v of VERB_FAMILY_VARIANTS[f]) {
        expect(seen.has(v)).toBe(false);
        seen.set(v, f);
      }
    }
    expect(VERB_LEXEME_INDEX.size).toBe(seen.size);
  });

  it("stop-words do not overlap with any verb lexeme", () => {
    for (const w of STOP_WORDS) {
      expect(VERB_LEXEME_INDEX.has(w)).toBe(false);
    }
  });

  it("every deliverable phrase is lowercase", () => {
    const kinds = Object.keys(DELIVERABLE_PHRASES) as (keyof typeof DELIVERABLE_PHRASES)[];
    for (const k of kinds) {
      for (const p of DELIVERABLE_PHRASES[k]) {
        expect(p).toBe(p.toLowerCase());
      }
    }
  });

  it("DELIVERABLE_SCAN_ORDER is sorted longest-phrase first", () => {
    for (let i = 1; i < DELIVERABLE_SCAN_ORDER.length; i++) {
      expect(DELIVERABLE_SCAN_ORDER[i - 1]!.phrase.length).toBeGreaterThanOrEqual(
        DELIVERABLE_SCAN_ORDER[i]!.phrase.length,
      );
    }
  });

  it("no requirement marker prefix is a prefix of another entry with a different kind", () => {
    // Enforces predictable resolution: when two markers share a prefix, they must
    // agree on kind, OR the more specific one must come first in the ordered list.
    for (let i = 0; i < REQUIREMENT_MARKERS.length; i++) {
      for (let j = 0; j < REQUIREMENT_MARKERS.length; j++) {
        if (i === j) continue;
        const a = REQUIREMENT_MARKERS[i]!;
        const b = REQUIREMENT_MARKERS[j]!;
        if (b.prefix.startsWith(a.prefix + " ") && a.kind !== b.kind) {
          // b is more specific than a. b must appear BEFORE a in the ordering.
          expect(j).toBeLessThan(i);
        }
      }
    }
  });

  it("VERB_LEXEME_INDEX is O(1) lookup with expected sample coverage", () => {
    expect(VERB_LEXEME_INDEX.get("build")).toBe("BUILD");
    expect(VERB_LEXEME_INDEX.get("create")).toBe("BUILD");
    expect(VERB_LEXEME_INDEX.get("fix")).toBe("FIX");
    expect(VERB_LEXEME_INDEX.get("refactor")).toBe("REFACTOR");
    expect(VERB_LEXEME_INDEX.get("verify")).toBe("VERIFY");
    expect(VERB_LEXEME_INDEX.get("test")).toBe("TEST");
    expect(VERB_LEXEME_INDEX.get("delete")).toBe("REMOVE");
    expect(VERB_LEXEME_INDEX.get("investigate")).toBe("INVESTIGATE");
    expect(VERB_LEXEME_INDEX.get("change")).toBe("MODIFY");
    expect(VERB_LEXEME_INDEX.get("banana")).toBeUndefined();
  });
});

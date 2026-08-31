// Stage 3.15 · Phase 8 · Reference Resolution unit tests.

import { describe, it, expect } from "vitest";
import { resolveReference, summariseResolution } from "./reference-resolution";
import type { RecognisedEntity } from "./entities";

const AT_OLD = "2026-08-30T00:00:00.000Z";
const AT_NEW = "2026-08-31T00:00:00.000Z";

function business(name: string, offset: number, atIso: string): RecognisedEntity {
  return {
    id: `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "business_name",
    canonical: name.toLowerCase(),
    raw: name,
    source: "nex_reply",
    atIso,
    presentedOffset: offset,
    refId: `place:accommodation:osm:${name.toLowerCase().replace(/\s+/g, "_")}`,
  };
}

function ordinal(word: "first" | "second" | "third" | "fourth" | "fifth"): RecognisedEntity {
  return { id: `ordinal:${word}`, kind: "ordinal", canonical: word, raw: `the ${word}`, source: "user_message", atIso: AT_NEW };
}

function pronounIt(): RecognisedEntity {
  return { id: "pronoun:it", kind: "pronoun", canonical: "it", raw: "book it", source: "user_message", atIso: AT_NEW };
}

describe("resolveReference · ordinals", () => {
  const window = [
    business("Griya Sentana", 1, AT_NEW),
    business("Hotel Trim Tiga", 2, AT_NEW),
    business("Asia Afrika", 3, AT_NEW),
  ];

  it("resolves 'second' to offset 2", () => {
    const r = resolveReference([ordinal("second")], window);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.refKind).toBe("ordinal");
      expect(r.offset).toBe(2);
      expect(r.entity.canonical).toBe("hotel trim tiga");
    }
  });

  it("resolves 'first' to offset 1", () => {
    const r = resolveReference([ordinal("first")], window);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("griya sentana");
  });

  it("returns ordinal_out_of_range when 'fifth' but only 3 presented", () => {
    const r = resolveReference([ordinal("fifth")], window);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("ordinal_out_of_range");
  });

  it("returns no_prior_presentation when window has no business_name", () => {
    const r = resolveReference([ordinal("second")], []);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("no_prior_presentation");
  });
});

describe("resolveReference · pronouns", () => {
  it("resolves 'it' unambiguously when batch size is 1", () => {
    const window = [business("Griya Sentana", 1, AT_NEW)];
    const r = resolveReference([pronounIt()], window);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.refKind).toBe("pronoun");
      expect(r.entity.canonical).toBe("griya sentana");
    }
  });

  it("returns ambiguous_pronoun when batch size > 1", () => {
    const window = [
      business("Griya Sentana", 1, AT_NEW),
      business("Hotel Trim Tiga", 2, AT_NEW),
      business("Asia Afrika", 3, AT_NEW),
    ];
    const r = resolveReference([pronounIt()], window);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("ambiguous_pronoun");
  });

  it("only considers the MOST RECENT batch (older batch ignored)", () => {
    const window = [
      business("Old Hotel A", 1, AT_OLD),
      business("Old Hotel B", 2, AT_OLD),
      business("Recent Sole", 1, AT_NEW),
    ];
    const r = resolveReference([pronounIt()], window);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("recent sole");
  });
});

describe("resolveReference · edge cases", () => {
  it("returns no_reference_mentioned when neither ordinal nor pronoun present", () => {
    const window = [business("Griya Sentana", 1, AT_NEW)];
    const r = resolveReference([], window);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("no_reference_mentioned");
  });

  it("ordinal takes precedence over pronoun in same turn", () => {
    const window = [business("A", 1, AT_NEW), business("B", 2, AT_NEW)];
    const r = resolveReference([ordinal("second"), pronounIt()], window);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.refKind).toBe("ordinal");
      expect(r.entity.canonical).toBe("b");
    }
  });
});

describe("summariseResolution", () => {
  it("resolved · returns business + offset", () => {
    const window = [business("Griya Sentana", 1, AT_NEW)];
    const r = resolveReference([ordinal("first")], window);
    const s = summariseResolution(r);
    expect(s.resolved).toBe(true);
    expect(s.refKind).toBe("ordinal");
    expect(s.offset).toBe(1);
    expect(s.business?.canonical).toBe("griya sentana");
    expect(s.business?.refId).toBe("place:accommodation:osm:griya_sentana");
  });

  it("unresolved · returns reason", () => {
    const r = resolveReference([], []);
    const s = summariseResolution(r);
    expect(s.resolved).toBe(false);
    expect(s.reason).toBe("no_reference_mentioned");
  });
});

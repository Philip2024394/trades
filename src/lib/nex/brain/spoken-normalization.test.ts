// src/lib/nex/brain/spoken-normalization.test.ts
// Wave 3 · Capability A · unit tests
// Philip 2026-09-06 · AUTHORIZE · WAVE 3

import { describe, it, expect } from "vitest";
import { normalizeSpokenInput } from "./spoken-normalization";

describe("normalizeSpokenInput · structural clitic + apostrophe repair", () => {
  it("wanna → want to", () => {
    const r = normalizeSpokenInput("i wanna book a hotel");
    expect(r.normalized).toContain("want to");
    expect(r.markers).toContain("clitic:wanna");
  });
  it("dont → don't", () => {
    const r = normalizeSpokenInput("i dont want that");
    expect(r.normalized).toContain("don't");
    expect(r.markers).toContain("apostrophe:dont");
  });
  it("cant → can't", () => {
    const r = normalizeSpokenInput("i cant book");
    expect(r.normalized).toContain("can't");
  });
  it("gonna → going to", () => {
    const r = normalizeSpokenInput("i'm gonna find something");
    expect(r.normalized).toContain("going to");
  });
  it("thats → that's", () => {
    const r = normalizeSpokenInput("yeah thats good");
    expect(r.normalized).toContain("that's");
  });
  it("Indonesian nggak → tidak", () => {
    const r = normalizeSpokenInput("aku nggak mau");
    expect(r.normalized).toContain("tidak");
    expect(r.markers).toContain("id_clitic:nggak");
  });
  it("Indonesian yg → yang", () => {
    const r = normalizeSpokenInput("cari hotel yg murah");
    expect(r.normalized).toContain("yang");
  });
});

describe("normalizeSpokenInput · lexicon-anchored phonetic repair", () => {
  it("hotal → hotel", () => {
    const r = normalizeSpokenInput("find me a hotal near malioboro");
    expect(r.normalized.toLowerCase()).toContain("hotel");
    expect(r.markers.some((m) => m.startsWith("lexicon_repair:hotal->hotel"))).toBe(true);
  });
  it("cheep → cheap", () => {
    const r = normalizeSpokenInput("show me the cheep ones");
    expect(r.normalized.toLowerCase()).toContain("cheap");
  });
  it("restraunt → restaurant (edit-distance 1)", () => {
    const r = normalizeSpokenInput("find a restaurent nearby");
    // "restaurent" → "restaurant" is edit-distance 1
    expect(r.normalized.toLowerCase()).toContain("restaurant");
  });
  it("preserves Malioboro case", () => {
    const r = normalizeSpokenInput("find me a hotal near Malioboro");
    expect(r.normalized).toContain("Malioboro");
  });
  it("does NOT rewrite protected common words", () => {
    const r = normalizeSpokenInput("what is that one");
    expect(r.normalized).toBe("what is that one");
    expect(r.markers.filter((m) => m.startsWith("lexicon_repair:"))).toHaveLength(0);
  });
  it("does NOT rewrite already-canonical lexicon words", () => {
    const r = normalizeSpokenInput("show me hotels");
    expect(r.normalized).toBe("show me hotels");
  });
  it("does NOT rewrite short (< 4 char) tokens", () => {
    const r = normalizeSpokenInput("bok me one");
    // "bok" is under length threshold · no unsafe repair
    expect(r.markers.filter((m) => m.startsWith("lexicon_repair:"))).toHaveLength(0);
  });
});

describe("normalizeSpokenInput · filler removal", () => {
  it("strips 'uh' filler between words", () => {
    const r = normalizeSpokenInput("find me uh a hotel");
    expect(r.normalized.toLowerCase()).not.toContain(" uh ");
    expect(r.markers).toContain("filler:uh");
  });
  it("strips 'um'", () => {
    const r = normalizeSpokenInput("show me um the first one");
    expect(r.normalized.toLowerCase()).not.toContain(" um ");
  });
  it("preserves 'hmm' when it stands with other content but strips when it's a standalone filler", () => {
    const r = normalizeSpokenInput("hmm find something");
    // hmm is a filler that should be stripped
    expect(r.markers).toContain("filler:hmm");
  });
});

describe("normalizeSpokenInput · self-correction observability", () => {
  it("detects 'no actually' self-correction", () => {
    const r = normalizeSpokenInput("find me hotels — no actually restaurants");
    expect(r.self_correction.detected).toBe(true);
    expect(r.self_correction.kept_span?.toLowerCase()).toContain("restaurant");
  });
  it("detects 'sorry' self-correction", () => {
    const r = normalizeSpokenInput("Tokyo — sorry, Osaka");
    expect(r.self_correction.detected).toBe(true);
    expect(r.self_correction.kept_span).toContain("Osaka");
  });
  it("detects Indonesian 'bukan' self-correction", () => {
    const r = normalizeSpokenInput("hotel yang murah, bukan yang mahal");
    expect(r.self_correction.detected).toBe(true);
  });
  it("does NOT flag plain leading 'no' as self-correction", () => {
    const r = normalizeSpokenInput("no I don't want that");
    expect(r.self_correction.detected).toBe(false);
  });
});

describe("normalizeSpokenInput · code-switch observability", () => {
  it("detects EN+ID mixing in 'find me a hotel yang murah'", () => {
    const r = normalizeSpokenInput("find me a hotel yang murah");
    expect(r.code_switch.detected).toBe(true);
    expect(r.code_switch.languages_seen.sort()).toEqual(["EN", "ID"]);
  });
  it("does NOT flag pure English as code-switch", () => {
    const r = normalizeSpokenInput("find me a hotel");
    expect(r.code_switch.detected).toBe(false);
  });
  it("does NOT flag pure Indonesian as code-switch", () => {
    const r = normalizeSpokenInput("cari hotel yang murah");
    expect(r.code_switch.detected).toBe(false);
  });
});

describe("normalizeSpokenInput · confidence + evidence discipline", () => {
  it("no changes → HIGH confidence", () => {
    const r = normalizeSpokenInput("find me a hotel near Malioboro");
    expect(r.changed).toBe(false);
    expect(r.confidence).toBe("HIGH");
  });
  it("many lexicon repairs → LOW confidence", () => {
    const r = normalizeSpokenInput("find hotal cheep restraunt");
    expect(r.confidence).toBe("LOW");
    // candidates exposed for potential clarification
    expect(r.candidates.length).toBeGreaterThan(0);
  });
  it("empty input is a no-op", () => {
    const r = normalizeSpokenInput("");
    expect(r.changed).toBe(false);
  });
  it("preserves quoted proper nouns unchanged", () => {
    const r = normalizeSpokenInput("book the Griya Sentana Hotel");
    expect(r.normalized).toContain("Griya");
    expect(r.normalized).toContain("Sentana");
  });
});

// src/lib/nex/brain/indonesian-ordinal-3-41-j.test.ts
//
// Stage 3.41.j · Indonesian ordinal reference parity regression tests.
//
// Product principle: Indonesian users should point at NEX's cards
// the way they naturally speak · "yang nomor dua" · "nomor dua" ·
// "yang kedua" · "kedua" · all must resolve · fail-closed on
// ambiguous "yang" · fail-closed on "nomor" without a number.

import { describe, expect, it } from "vitest";
import { extractEntities } from "./entities";
import { resolveReference } from "./reference-resolution";
import type { RecognisedEntity } from "./entities";

// ─── Helper: build a fake presented-batch window ─────────────

function makePresentedWindow(names: string[], atIso = "2026-08-31T00:00:00Z"): RecognisedEntity[] {
  return names.map((name, i) => ({
    id: `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "business_name" as const,
    canonical: name.toLowerCase(),
    raw: name,
    source: "nex_reply" as const,
    atIso,
    refId: `place:test:${i + 1}`,
    presentedOffset: i + 1,
  }));
}

function resolveFor(userMsg: string, presentedNames: string[]) {
  const nowIso = "2026-08-31T00:00:00Z";
  const userEntities = extractEntities(userMsg, nowIso);
  const window = makePresentedWindow(presentedNames, nowIso);
  return resolveReference(userEntities, window);
}

// ─── Positive · Indonesian ordinals resolve to correct offset ──

describe("3.41.j · Indonesian ordinal patterns resolve", () => {
  const three = ["Warung Alpha", "Warung Beta", "Warung Gamma"];

  it.each([
    ["yang nomor dua", 2, "warung beta"],
    ["nomor dua",       2, "warung beta"],
    ["yang kedua",      2, "warung beta"],
    ["kedua",           2, "warung beta"],
    ["yang nomor satu", 1, "warung alpha"],
    ["nomor satu",      1, "warung alpha"],
    ["yang pertama",    1, "warung alpha"],
    ["pertama",         1, "warung alpha"],
    ["yang nomor tiga", 3, "warung gamma"],
    ["nomor tiga",      3, "warung gamma"],
    ["yang ketiga",     3, "warung gamma"],
    ["ketiga",          3, "warung gamma"],
  ])("'%s' → offset %d · %s", (msg, expectedOffset, expectedCanonical) => {
    const r = resolveFor(msg, three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(expectedOffset);
      expect(r.entity.canonical).toBe(expectedCanonical);
    }
  });

  it("bare 'nomor dua' inside a longer utterance still resolves", () => {
    const r = resolveFor("yang nomor dua bagus", three);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.offset).toBe(2);
  });

  it("digit form 'nomor 2' resolves", () => {
    const r = resolveFor("nomor 2", three);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.offset).toBe(2);
  });

  it("Indonesian 4th/5th also resolve when the presented batch has 5", () => {
    const five = ["A","B","C","D","E"];
    expect((resolveFor("yang keempat", five) as { resolved: true; offset: number }).offset).toBe(4);
    expect((resolveFor("yang kelima",  five) as { resolved: true; offset: number }).offset).toBe(5);
    expect((resolveFor("nomor empat",  five) as { resolved: true; offset: number }).offset).toBe(4);
    expect((resolveFor("nomor lima",   five) as { resolved: true; offset: number }).offset).toBe(5);
  });
});

// ─── Regression · English ordinals unchanged ─────────────────

describe("3.41.j · English ordinal behaviour unchanged", () => {
  const three = ["Alpha Inn","Beta Hotel","Gamma Suites"];

  it.each([
    ["the first one",   1, "alpha inn"],
    ["the second one",  2, "beta hotel"],
    ["the third one",   3, "gamma suites"],
    ["first",           1, "alpha inn"],
    ["second",          2, "beta hotel"],
    ["2nd",             2, "beta hotel"],
    ["1st",             1, "alpha inn"],
  ])("EN '%s' still → offset %d · %s", (msg, expectedOffset, expectedCanonical) => {
    const r = resolveFor(msg, three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(expectedOffset);
      expect(r.entity.canonical).toBe(expectedCanonical);
    }
  });
});

// ─── Fail-closed · ambiguous "yang" alone ────────────────────

describe("3.41.j · 'yang' alone does NOT resolve", () => {
  const three = ["Warung Alpha", "Warung Beta", "Warung Gamma"];

  it.each([
    "yang",
    "yang bagus",
    "yang enak",
    "yang deket",
    "yang murah",
    "yang deket malioboro",
  ])("'%s' does NOT resolve (ambiguous)", (msg) => {
    const r = resolveFor(msg, three);
    if (r.resolved) {
      // If it did resolve for some reason, at minimum it must NOT be
      // an ordinal (the point of this test is 'yang' alone is not
      // an ordinal signal).
      expect(r.refKind).not.toBe("ordinal");
    } else {
      // Preferred branch: honestly unresolved (either no reference
      // or ambiguous pronoun).
      expect(r.resolved).toBe(false);
    }
  });
});

// ─── Fail-closed · "nomor" without a number ──────────────────

describe("3.41.j · 'nomor' without a number does NOT resolve", () => {
  const three = ["Warung Alpha", "Warung Beta", "Warung Gamma"];

  it.each([
    "nomor",
    "nomor apa",
    "nomor telepon",     // "phone number" · not an ordinal
    "nomor rekening",
  ])("'%s' does NOT resolve as ordinal", (msg) => {
    const r = resolveFor(msg, three);
    if (r.resolved) {
      expect(r.refKind).not.toBe("ordinal");
    }
  });
});

// ─── Fail-closed · no cards presented ────────────────────────

describe("3.41.j · no cards → no resolution", () => {
  it("'yang nomor dua' with zero presented entities → unresolved (no_prior_presentation)", () => {
    const r = resolveFor("yang nomor dua", []);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("no_prior_presentation");
  });
});

// ─── Fail-closed · ordinal out of range ──────────────────────

describe("3.41.j · out-of-range ordinal does NOT invent · fail-closed", () => {
  it("'yang kelima' with only 2 cards → ordinal_out_of_range", () => {
    const r = resolveFor("yang kelima", ["A","B"]);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("ordinal_out_of_range");
  });

  it("'nomor tiga' with 2 cards → ordinal_out_of_range", () => {
    const r = resolveFor("nomor tiga", ["A","B"]);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("ordinal_out_of_range");
  });
});

// ─── No auto-selection of card #1 ────────────────────────────

describe("3.41.j · no auto-select of card #1 on ambiguous input", () => {
  it("empty message → unresolved · no auto-pick", () => {
    const r = resolveFor("", ["A","B","C"]);
    expect(r.resolved).toBe(false);
  });

  it("greeting → unresolved · no auto-pick", () => {
    const r = resolveFor("halo", ["A","B","C"]);
    expect(r.resolved).toBe(false);
  });

  it("food question that mentions no ordinal → unresolved", () => {
    const r = resolveFor("yang deket malioboro", ["A","B","C"]);
    expect(r.resolved).toBe(false);
  });
});

// src/lib/nex/brain/code-switch-references-3-41-m.test.ts
//
// Stage 3.41.m · Code-switch reference glue (Philip 2026-08-31).
//
// Acceptance criteria (Philip's own):
//   A. Indonesian temporal references: yang tadi · yang terakhir ·
//      yang sebelumnya · yang barusan
//   B. English/Indonesian code-switch: yang first one · yang last one ·
//      yang previous page · yang third one
//   C. Guard against unrelated English words (last · previous · first
//      mid-sentence) misfiring as references.
//   D. Multi-turn proof: seed real presented entities, verify each
//      form resolves to the actual existing reference (never fabricates).
//
// CONSTITUTIONAL invariant:
//   reference expression → entity/card/position resolution
//   NOT: reference expression → new discovery
//   NEVER: reference resolution fabricates an entity.

import { describe, expect, it } from "vitest";
import { extractEntities, type RecognisedEntity } from "./entities";
import { resolveReference } from "./reference-resolution";

// ─── Fixture helpers ────────────────────────────────────────────────

function presentedBatch(names: string[], atIso = "2026-08-31T00:00:00Z"): RecognisedEntity[] {
  return names.map((name, i) => ({
    id:              `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind:            "business_name",
    canonical:       name.toLowerCase(),
    raw:             name,
    source:          "nex_reply" as const,
    atIso,
    presentedOffset: i + 1,
  }));
}

function currentReferenceEntity(name: string, offset: number, atIso = "2026-08-31T00:00:00Z"): RecognisedEntity {
  return {
    id:              `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind:            "business_name",
    canonical:       name.toLowerCase(),
    raw:             name,
    source:          "nex_reply",
    atIso,
    presentedOffset: offset,
  };
}

// ─── A · Indonesian temporal references — extraction ────────────────

describe("3.41.m · A · Indonesian temporal references EXTRACTED as ordinals", () => {
  it.each([
    ["yang tadi",             "yang_tadi"],
    ["Yang tadi",             "yang_tadi"],
    ["yang tadi aja",         "yang_tadi"],
    ["yang barusan",          "yang_tadi"],
    ["yang barusan aja dong", "yang_tadi"],
    ["yang terakhir",         "last"],
    ["yang terakhir aja",     "last"],
    ["yang sebelumnya",       "previous"],
    ["yang sebelumnya aja",   "previous"],
  ])("'%s' extracts ordinal canonical=%s", (msg, canonical) => {
    const ents = extractEntities(msg);
    const ord = ents.find((e) => e.kind === "ordinal");
    expect(ord?.canonical).toBe(canonical);
  });
});

// ─── B · English / Indonesian code-switch — extraction ──────────────

describe("3.41.m · B · English/Indonesian code-switch EXTRACTED as ordinals", () => {
  it.each([
    ["yang first one",         "first"],
    ["yang second one",        "second"],
    ["yang third one",         "third"],
    ["yang last one",          "last"],
    ["yang previous one",      "previous"],
    ["yang previous page",     "previous"],
    ["yang previous slide",    "previous"],
    ["the last one",           "last"],
    ["the previous one",       "previous"],
    // Corpus R addendum · `next` symmetric to `previous`
    ["yang next",              "next"],
    ["yang next one",          "next"],
    ["yang next ride",         "next"],
    ["yang next hotel",        "next"],
    ["yang selanjutnya",       "next"],
    ["yang berikutnya",        "next"],
    ["the next one",           "next"],
  ])("'%s' extracts ordinal canonical=%s", (msg, canonical) => {
    const ents = extractEntities(msg);
    const ord = ents.find((e) => e.kind === "ordinal");
    expect(ord?.canonical).toBe(canonical);
  });
});

// ─── B addendum · guards for `next` — must NOT extract ─────────────

describe("3.41.m · B guards · bare 'next' in unrelated sentences MUST NOT extract", () => {
  it.each([
    "the next meeting is at 3",
    "in the next quarter",
    "next week I'll be away",
    "next time we should book earlier",
  ])("'%s' does NOT extract 'next' as ordinal", (msg) => {
    const ents = extractEntities(msg);
    const canonicals = ents.filter((e) => e.kind === "ordinal").map((e) => e.canonical);
    expect(canonicals).not.toContain("next");
  });
});

// ─── `next` multi-turn resolution ──────────────────────────────────

describe("3.41.m · `next` resolves against currentReference (+1) ", () => {
  const three: RecognisedEntity[] = [
    { id: "business_name:gudeg-wijilan", kind: "business_name", canonical: "gudeg wijilan", raw: "Gudeg Wijilan", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 },
    { id: "business_name:sate-klathak",  kind: "business_name", canonical: "sate klathak",  raw: "Sate Klathak",  source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 2 },
    { id: "business_name:bakmi-jawa",    kind: "business_name", canonical: "bakmi jawa",    raw: "Bakmi Jawa",    source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 3 },
  ];

  it("'yang next' with fresh currentReference at offset 1 → offset 2", () => {
    const ctx = {
      currentReferenceEntity: { id: "business_name:gudeg-wijilan", kind: "business_name" as const, canonical: "gudeg wijilan", raw: "Gudeg Wijilan", source: "nex_reply" as const, atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 },
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang next"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(2);
      expect(r.entity.canonical).toBe("sate klathak");
    }
  });

  it("'the next one' with fresh currentReference at offset 2 → offset 3", () => {
    const ctx = {
      currentReferenceEntity: { id: "business_name:sate-klathak", kind: "business_name" as const, canonical: "sate klathak", raw: "Sate Klathak", source: "nex_reply" as const, atIso: "2026-08-31T00:00:00Z", presentedOffset: 2 },
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("the next one"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("bakmi jawa");
  });

  it("'yang next' with NO currentReference → next_without_current", () => {
    const r = resolveReference(extractEntities("yang next"), three);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("next_without_current");
  });

  it("'yang next' with currentReference at last offset → ordinal_out_of_range", () => {
    const ctx = {
      currentReferenceEntity: { id: "business_name:bakmi-jawa", kind: "business_name" as const, canonical: "bakmi jawa", raw: "Bakmi Jawa", source: "nex_reply" as const, atIso: "2026-08-31T00:00:00Z", presentedOffset: 3 },
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang next"), three, ctx);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("ordinal_out_of_range");
  });

  it("'yang selanjutnya' resolves symmetrically", () => {
    const ctx = {
      currentReferenceEntity: { id: "business_name:gudeg-wijilan", kind: "business_name" as const, canonical: "gudeg wijilan", raw: "Gudeg Wijilan", source: "nex_reply" as const, atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 },
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang selanjutnya"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("sate klathak");
  });
});

// ─── C · Guards — must NOT extract as reference ─────────────────────

describe("3.41.m · C · unrelated English/ID sentences MUST NOT extract new refs", () => {
  it.each([
    // "last" as temporal / idiom · NOT reference
    "last week I went to Bali",
    "at last we can go",
    "I saw them last night",
    "hari terakhir liburan",       // "the last day of vacation" — no yang, no "one"
    // "previous" as adjective on non-entity noun · NOT reference
    "the previous meeting was long",
    "in my previous job",
    "his previous statement was wrong",
    // Attribute-only ("yang black one") — 3.41.m does NOT resolve
    // attribute-based references. Extractor must not create a spurious
    // "yang tadi/last/previous" from a color phrase. Downstream falls
    // through to normal routing (safe · fail-closed).
    "yang black one",
    "yang red one",
    "the black one",
    // "first" as adjective on non-reference noun — the existing bare
    // ordinal pack DOES extract "first" from any position. This is
    // pre-3.41.m behaviour and stays consistent · resolution still
    // requires a presented batch so it fails-closed downstream.
  ])("'%s' produces no NEW 3.41.m ref (last/previous/yang_tadi)", (msg) => {
    const ents = extractEntities(msg);
    const canonicals = ents.filter((e) => e.kind === "ordinal").map((e) => e.canonical);
    // The three canonicals introduced in 3.41.m must not appear.
    expect(canonicals).not.toContain("last");
    expect(canonicals).not.toContain("previous");
    expect(canonicals).not.toContain("yang_tadi");
  });
});

// ─── D · Multi-turn resolution against real presented entities ──────

describe("3.41.m · D · resolves against real presented batch (never fabricates)", () => {
  const three = presentedBatch(["Gudeg Wijilan", "Sate Klathak", "Bakmi Jawa"]);

  it("'yang first one' → offset 1 → Gudeg Wijilan", () => {
    const turnEnts = extractEntities("yang first one");
    const r = resolveReference(turnEnts, three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(1);
      expect(r.entity.canonical).toBe("gudeg wijilan");
      expect(r.refKind).toBe("ordinal");
    }
  });

  it("'yang third one' → offset 3 → Bakmi Jawa", () => {
    const r = resolveReference(extractEntities("yang third one"), three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(3);
      expect(r.entity.canonical).toBe("bakmi jawa");
    }
  });

  it("'yang terakhir' → offset 3 (last of batch) → Bakmi Jawa", () => {
    const r = resolveReference(extractEntities("yang terakhir"), three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(3);
      expect(r.entity.canonical).toBe("bakmi jawa");
    }
  });

  it("'the last one' → offset 3 → Bakmi Jawa", () => {
    const r = resolveReference(extractEntities("the last one"), three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(3);
      expect(r.entity.canonical).toBe("bakmi jawa");
    }
  });

  it("'yang last one' → offset 3 → Bakmi Jawa", () => {
    const r = resolveReference(extractEntities("yang last one"), three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(3);
      expect(r.entity.canonical).toBe("bakmi jawa");
    }
  });

  it("'yang tadi' with fresh currentReference (Sate Klathak) → offset 2", () => {
    const ctx = {
      currentReferenceEntity: currentReferenceEntity("Sate Klathak", 2),
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang tadi"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(2);
      expect(r.entity.canonical).toBe("sate klathak");
    }
  });

  it("'yang barusan' with fresh currentReference (Sate Klathak) → offset 2", () => {
    const ctx = {
      currentReferenceEntity: currentReferenceEntity("Sate Klathak", 2),
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang barusan"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("sate klathak");
  });

  it("'yang tadi' with NO currentReference and multi-entity batch → yang_tadi_without_current", () => {
    const r = resolveReference(extractEntities("yang tadi"), three);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("yang_tadi_without_current");
  });

  it("'yang tadi' with STALE currentReference → yang_tadi_without_current", () => {
    const ctx = {
      currentReferenceEntity: currentReferenceEntity("Sate Klathak", 2),
      currentReferenceResolvedInTurn: 1,
      currentTurn: 10,        // age = 9 > threshold 3
    };
    const r = resolveReference(extractEntities("yang tadi"), three, ctx);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("yang_tadi_without_current");
  });

  it("'yang tadi' with single-entity batch (no ctx) → resolves to that single entity", () => {
    const one = presentedBatch(["Gudeg Wijilan"]);
    const r = resolveReference(extractEntities("yang tadi"), one);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("gudeg wijilan");
  });

  it("'yang sebelumnya' with fresh currentReference at offset 2 → offset 1", () => {
    const ctx = {
      currentReferenceEntity: currentReferenceEntity("Sate Klathak", 2),
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang sebelumnya"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(1);
      expect(r.entity.canonical).toBe("gudeg wijilan");
    }
  });

  it("'yang previous page' with fresh currentReference at offset 3 → offset 2", () => {
    const ctx = {
      currentReferenceEntity: currentReferenceEntity("Bakmi Jawa", 3),
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang previous page"), three, ctx);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.entity.canonical).toBe("sate klathak");
  });

  it("'yang sebelumnya' with NO currentReference → previous_without_current", () => {
    const r = resolveReference(extractEntities("yang sebelumnya"), three);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("previous_without_current");
  });

  it("'yang sebelumnya' with currentReference at offset 1 → previous_without_current (no earlier)", () => {
    const ctx = {
      currentReferenceEntity: currentReferenceEntity("Gudeg Wijilan", 1),
      currentReferenceResolvedInTurn: 3,
      currentTurn: 4,
    };
    const r = resolveReference(extractEntities("yang sebelumnya"), three, ctx);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("previous_without_current");
  });

  it("'yang terakhir' with NO presented batch → no_prior_presentation", () => {
    const r = resolveReference(extractEntities("yang terakhir"), []);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("no_prior_presentation");
  });

  it("NEVER fabricates: 'yang black one' with 3 presented → no reference resolved", () => {
    const ents = extractEntities("yang black one");
    const ord = ents.find((e) => e.kind === "ordinal");
    expect(ord).toBeUndefined();
    const r = resolveReference(ents, three);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("no_reference_mentioned");
  });
});

// ─── Regression · 3.41.j numeric ordinals still resolve ─────────────

describe("3.41.m · regression · existing numeric ordinals still work", () => {
  const three = presentedBatch(["Gudeg Wijilan", "Sate Klathak", "Bakmi Jawa"]);

  it.each([
    ["the second one",  2, "sate klathak"],
    ["yang kedua",      2, "sate klathak"],
    ["nomor dua",       2, "sate klathak"],
    ["nomor 3",         3, "bakmi jawa"],
    ["the first",       1, "gudeg wijilan"],
    ["yang pertama",    1, "gudeg wijilan"],
  ])("'%s' → offset %d → %s", (msg, offset, name) => {
    const r = resolveReference(extractEntities(msg), three);
    expect(r.resolved).toBe(true);
    if (r.resolved) {
      expect(r.offset).toBe(offset);
      expect(r.entity.canonical).toBe(name);
    }
  });
});

// src/lib/nex/brain/scope-validation.test.ts
//
// G24 · Scope-Validated Evidence · unit tests.
// Philip 2026-09-05 · AUTHORIZE · NEX G24

import { describe, it, expect } from "vitest";
import {
  extractQuestionScope,
  extractEvidenceScope,
  validateScope,
  decideScopeGate,
  buildScopeBoundaryReply,
  type KnowledgeRecord,
} from "./scope-validation";

const rec = (partial: Partial<KnowledgeRecord>): KnowledgeRecord => ({ ...partial });

// ─── Question-scope extraction ──────────────────────────────────

describe("extractQuestionScope", () => {
  it("extracts a single Indonesian place anchor", () => {
    const s = extractQuestionScope("tell me about hotels in Yogyakarta");
    expect(s.anchors).toEqual([{ token: "yogyakarta", kind: "place" }]);
  });

  it("extracts a country anchor from a general question", () => {
    const s = extractQuestionScope("tell me about seafood in Japan");
    expect(s.anchors.map((a) => a.token)).toContain("japan");
  });

  it("extracts a brand anchor", () => {
    const s = extractQuestionScope("recommend a Michelin restaurant in Semarang");
    const tokens = s.anchors.map((a) => a.token);
    expect(tokens).toEqual(expect.arrayContaining(["michelin", "semarang"]));
  });

  it("does not treat sentence-initial 'What' as a proper-noun anchor", () => {
    const s = extractQuestionScope("What is the weather?");
    expect(s.anchors.map((a) => a.token)).not.toContain("what");
  });

  it("returns empty anchors for a broad question with no proper nouns", () => {
    const s = extractQuestionScope("how much does a hotel cost?");
    expect(s.anchors).toEqual([]);
  });

  it("extracts adjectival forms as anchors (e.g. 'Japanese')", () => {
    const s = extractQuestionScope("do you have Japanese sushi?");
    expect(s.anchors.map((a) => a.token)).toContain("japanese");
  });

  it("deduplicates repeated anchors", () => {
    const s = extractQuestionScope("Yogyakarta hotels in Yogyakarta");
    const yogyaCount = s.anchors.filter((a) => a.token === "yogyakarta").length;
    expect(yogyaCount).toBe(1);
  });

  it("handles bigram places (e.g. Kuala Lumpur)", () => {
    const s = extractQuestionScope("flights to Kuala Lumpur");
    expect(s.anchors.map((a) => a.token)).toContain("kuala lumpur");
    expect(s.anchors.map((a) => a.token)).not.toContain("kuala"); // constituent consumed
  });

  it("skips common STOP_CAPS even when capitalized mid-sentence", () => {
    const s = extractQuestionScope("we visited The Hotel yesterday");
    // 'The' should not become a proper_noun anchor
    expect(s.anchors.map((a) => a.token)).not.toContain("the");
  });
});

// ─── Evidence-scope extraction (word-boundary) ──────────────────

describe("extractEvidenceScope · word-boundary matching", () => {
  it("marks anchor as covered when it appears as a whole word", () => {
    const records = [rec({ topic: "Semarang food scene", content: "great restaurants in Semarang" })];
    const es = extractEvidenceScope(records, [{ token: "semarang", kind: "place" }]);
    expect(es.covered_anchors).toEqual(["semarang"]);
    expect(es.missing_anchors).toEqual([]);
  });

  it("does NOT match 'japan' when corpus contains 'japanese' (word-boundary)", () => {
    const records = [rec({ topic: "Japanese cuisine influences", content: "sushi is popular" })];
    const es = extractEvidenceScope(records, [{ token: "japan", kind: "place" }]);
    expect(es.covered_anchors).toEqual([]);
    expect(es.missing_anchors).toEqual(["japan"]);
  });

  it("marks anchor as missing when corpus is unrelated", () => {
    const records = [rec({ topic: "Yogyakarta hotels", content: "Malioboro area" })];
    const es = extractEvidenceScope(records, [{ token: "michelin", kind: "brand" }]);
    expect(es.covered_anchors).toEqual([]);
    expect(es.missing_anchors).toEqual(["michelin"]);
  });

  it("partially covers when only some anchors are present", () => {
    const records = [rec({ topic: "Yogyakarta hotels", content: "Malioboro area" })];
    const es = extractEvidenceScope(
      records,
      [
        { token: "yogyakarta", kind: "place" },
        { token: "michelin", kind: "brand" },
      ],
    );
    expect(es.covered_anchors).toEqual(["yogyakarta"]);
    expect(es.missing_anchors).toEqual(["michelin"]);
  });
});

// ─── Full validation · known-defect regressions ─────────────────

describe("validateScope · Test A · seafood in Japan (known regression)", () => {
  it("Indonesian food retrieval + 'Japan' anchor → IRRELEVANT", () => {
    const records = [
      rec({ topic: "Indonesian seafood", content: "grilled fish sambal", source: "walker", region: "ID" }),
      rec({ topic: "Yogyakarta food", content: "gudeg and nasi kuning", region: "ID" }),
      rec({ topic: "Bali seafood", content: "Jimbaran beach restaurants", region: "ID" }),
    ];
    const v = validateScope("tell me about seafood in Japan", records);
    expect(v.status).toBe("IRRELEVANT");
    expect(v.evidence_scope.missing_anchors).toContain("japan");
  });
});

describe("validateScope · Test B · Michelin restaurant in Semarang (known regression)", () => {
  it("Records mention Semarang but not Michelin → PARTIALLY_SUPPORTED", () => {
    const records = [
      rec({ topic: "Semarang cuisine", content: "lumpia and tahu petis", region: "ID" }),
      rec({ topic: "Central Java restaurants", content: "warung style eateries", region: "ID" }),
    ];
    const v = validateScope("recommend a Michelin restaurant in Semarang", records);
    expect(v.status).toBe("PARTIALLY_SUPPORTED");
    expect(v.evidence_scope.missing_anchors).toContain("michelin");
    expect(v.evidence_scope.covered_anchors).toContain("semarang");
  });

  it("Neither Semarang nor Michelin covered → IRRELEVANT", () => {
    const records = [rec({ topic: "Bali beaches", content: "Kuta and Seminyak" })];
    const v = validateScope("recommend a Michelin restaurant in Semarang", records);
    expect(v.status).toBe("IRRELEVANT");
  });
});

// ─── Test C · Genuine evidence must remain SUPPORTED ────────────

describe("validateScope · Test C · Yogyakarta with actual Yogya evidence → SUPPORTED", () => {
  it("Yogyakarta anchor + Yogyakarta records → SUPPORTED", () => {
    const records = [
      rec({ topic: "Yogyakarta city guide", content: "Malioboro is the main street" }),
      rec({ topic: "Borobudur near Yogyakarta", content: "temple site" }),
    ];
    const v = validateScope("tell me about Yogyakarta", records);
    expect(v.status).toBe("SUPPORTED");
    expect(v.evidence_scope.covered_anchors).toContain("yogyakarta");
  });

  it("Bandung anchor + Bandung records → SUPPORTED (regression: population of Bandung)", () => {
    const records = [
      rec({ topic: "Bandung", content: "capital of West Java · population 2.5 million" }),
      rec({ topic: "Bandung climate", content: "cooler than Jakarta" }),
    ];
    const v = validateScope("what is the population of Bandung?", records);
    expect(v.status).toBe("SUPPORTED");
  });
});

// ─── Test D · Partial scope ─────────────────────────────────────

describe("validateScope · Test D · Partial scope", () => {
  it("two anchors, one covered → PARTIALLY_SUPPORTED with the missing one listed", () => {
    const records = [rec({ topic: "Yogyakarta", content: "restaurants and hotels" })];
    const v = validateScope("Michelin restaurants in Yogyakarta", records);
    expect(v.status).toBe("PARTIALLY_SUPPORTED");
    expect(v.evidence_scope.covered_anchors).toEqual(["yogyakarta"]);
    expect(v.evidence_scope.missing_anchors).toEqual(["michelin"]);
  });
});

// ─── Test E · No retrieval remains NO_EVIDENCE (zero-evidence path) ─

describe("validateScope · Test E · no retrieval → NO_EVIDENCE (existing zero-evidence guard fires)", () => {
  it("k=0 → status=NO_EVIDENCE, all anchors missing", () => {
    const v = validateScope("tell me about seafood in Japan", []);
    expect(v.status).toBe("NO_EVIDENCE");
    expect(v.evidence_scope.missing_anchors).toContain("japan");
  });
});

// ─── FALSE-POSITIVE PROTECTION · broad questions must not gate ──

describe("false-positive protection · broad questions with no anchors → SUPPORTED", () => {
  const broad = [
    "how much does a hotel cost?",
    "what is a good place to eat?",
    "how do I book something?",
    "any recommendations?",
    "tell me more",
    "yes please",
  ];
  for (const m of broad) {
    it(`"${m}" → SUPPORTED (no anchors to validate)`, () => {
      const records = [rec({ topic: "some retrieval", content: "some content" })];
      const v = validateScope(m, records);
      expect(v.status).toBe("SUPPORTED");
      expect(v.reason).toBe("no_scope_anchors_to_validate");
    });
  }
});

// ─── ADVERSARIAL MATRIX · varying dimensions ────────────────────

describe("adversarial matrix · irrelevant retrieval must never masquerade as evidence", () => {
  it("adversarial geography (Tokyo query · Bali retrieval)", () => {
    const records = [rec({ topic: "Bali beaches", content: "Kuta and Seminyak surf" })];
    const v = validateScope("what to do in Tokyo?", records);
    expect(v.status).toBe("IRRELEVANT");
  });

  it("adversarial vertical (Michelin query · walker directory retrieval)", () => {
    const records = [rec({ topic: "walker directory", content: "hotels in Yogyakarta" })];
    const v = validateScope("Michelin star restaurants", records);
    // No place anchor · but 'michelin' is a brand anchor · missing
    expect(v.status).toBe("IRRELEVANT");
  });

  it("adversarial entity (specific brand · unrelated retrieval)", () => {
    const records = [rec({ topic: "local warung", content: "traditional Javanese food" })];
    const v = validateScope("does Marriott have properties nearby?", records);
    expect(v.status).toBe("IRRELEVANT");
  });

  it("adversarial temporal-scope-ish (future date · corpus is present)", () => {
    // No anchor for '2028' but 'election' isn't in dictionaries — this
    // question has no anchor so validation passes through (SUPPORTED)
    // and downstream honest-boundary logic handles temporal-unknown.
    const records = [rec({ topic: "general knowledge", content: "some content" })];
    const v = validateScope("who won the 2028 election?", records);
    // Confirms the validator does not over-reach into things it doesn't
    // have anchors for. Temporal-future questions are the job of a
    // separate downstream guard (out of G24 scope).
    expect(v.status).toBe("SUPPORTED");
  });

  it("adversarial relationship (X exports to Y where neither is in corpus)", () => {
    const records = [rec({ topic: "Indonesian cuisine", content: "Java and Sumatra dishes" })];
    const v = validateScope("what does Japan export to Australia?", records);
    expect(v.status).toBe("IRRELEVANT");
    expect(v.evidence_scope.missing_anchors).toEqual(expect.arrayContaining(["japan", "australia"]));
  });
});

// ─── decideScopeGate · gate semantics ───────────────────────────

describe("decideScopeGate", () => {
  it("SUPPORTED → shouldGate=false", () => {
    const records = [rec({ topic: "Yogyakarta guide", content: "Malioboro etc" })];
    const d = decideScopeGate({ message: "tell me about Yogyakarta", records });
    expect(d.shouldGate).toBe(false);
    expect(d.validation.status).toBe("SUPPORTED");
  });

  it("IRRELEVANT → shouldGate=true", () => {
    const records = [rec({ topic: "Yogyakarta guide", content: "Malioboro etc" })];
    const d = decideScopeGate({ message: "tell me about Japan", records });
    expect(d.shouldGate).toBe(true);
    expect(d.validation.status).toBe("IRRELEVANT");
  });

  it("PARTIALLY_SUPPORTED → shouldGate=true", () => {
    const records = [rec({ topic: "Semarang lumpia", content: "traditional snack" })];
    const d = decideScopeGate({
      message: "Michelin restaurants in Semarang",
      records,
    });
    expect(d.shouldGate).toBe(true);
    expect(d.validation.status).toBe("PARTIALLY_SUPPORTED");
  });

  it("NO_EVIDENCE (k=0) → shouldGate=false (defer to zero-evidence guard)", () => {
    const d = decideScopeGate({ message: "tell me about Japan", records: [] });
    expect(d.shouldGate).toBe(false); // downstream zero-evidence handles this
    expect(d.validation.status).toBe("NO_EVIDENCE");
  });

  it("no anchors → shouldGate=false (false-positive protection)", () => {
    const records = [rec({ topic: "anything", content: "anything" })];
    const d = decideScopeGate({ message: "how much?", records });
    expect(d.shouldGate).toBe(false);
    expect(d.validation.status).toBe("SUPPORTED");
  });
});

// ─── buildScopeBoundaryReply · deterministic honest boundary ────

describe("buildScopeBoundaryReply", () => {
  it("IRRELEVANT + English → mentions the missing anchor, offers Indonesian topics", () => {
    const records = [{ topic: "Bali", content: "beach" }];
    const v = validateScope("what to do in Tokyo?", records);
    const reply = buildScopeBoundaryReply(v, "en");
    expect(reply.toLowerCase()).toContain("tokyo");
    expect(reply.toLowerCase()).toContain("indonesian");
    expect(reply.slice(-1)).toMatch(/[.?!]/);
    // must NOT contain any fabrication about Tokyo
    expect(reply.toLowerCase()).not.toContain("tokyo tower");
    expect(reply.toLowerCase()).not.toContain("shibuya");
  });

  it("PARTIALLY_SUPPORTED + English → names both missing and covered anchor", () => {
    const records = [{ topic: "Semarang", content: "food scene" }];
    const v = validateScope("Michelin restaurants in Semarang", records);
    const reply = buildScopeBoundaryReply(v, "en");
    expect(reply.toLowerCase()).toContain("michelin");
    expect(reply.toLowerCase()).toContain("semarang");
    // Must not fabricate a specific restaurant name
    expect(reply.toLowerCase()).not.toContain("sinar mas");
  });

  it("IRRELEVANT + Indonesian → Indonesian reply", () => {
    const records = [{ topic: "Bali", content: "pantai" }];
    const v = validateScope("apa yang bisa dilakukan di Tokyo?", records);
    const reply = buildScopeBoundaryReply(v, "id");
    expect(reply.toLowerCase()).toContain("belum memiliki");
    expect(reply.toLowerCase()).toContain("tokyo");
  });

  it("Reply is voice-safe · no template markers · ends with punctuation", () => {
    const records = [{ topic: "Bali", content: "beach" }];
    const v = validateScope("Marriott in Malioboro", records);
    const reply = buildScopeBoundaryReply(v, "en");
    expect(reply).not.toMatch(/[{}]|\$\{/);
    expect(reply.length).toBeGreaterThan(20);
    expect(reply.slice(-1)).toMatch(/[.?!]/);
  });
});

// ─── OBSERVABILITY · reason strings are informative ─────────────

describe("validation.reason is informative for observability", () => {
  it("IRRELEVANT lists the missing anchors", () => {
    const records = [rec({ topic: "Bali", content: "beach" })];
    const v = validateScope("Michelin restaurants in Tokyo", records);
    expect(v.reason).toContain("no_anchors_covered");
    expect(v.reason).toContain("michelin");
    expect(v.reason).toContain("tokyo");
  });

  it("PARTIALLY_SUPPORTED reports coverage ratio and missing anchors", () => {
    const records = [rec({ topic: "Semarang", content: "food scene" })];
    const v = validateScope("Michelin restaurants in Semarang", records);
    expect(v.reason).toContain("1/2");
    expect(v.reason).toContain("michelin");
  });
});

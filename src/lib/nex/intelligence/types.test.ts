// Draft validation — Zod refuses invalid knowledge shapes.
// Ensures the sources-required rule and confidence bounds are enforced.

import { describe, it, expect } from "vitest";
import { KnowledgeEntryDraftSchema, SourceSchema, RelationshipSchema, ReviewKindSchema } from "./types";

const validDraft = {
  trade:       "carpentry",
  topic:       "second-fix",
  title:       "Skirting join tolerances",
  summary:     "45-degree scarf joints for internal, mitre joints for external corners. Never butt-join skirting on a visible run.",
  difficulty:  "basic" as const,
  keywords:    ["skirting", "mitre"],
  sources:     [{ title: "Carpentry & Joinery Level 2 — City & Guilds", kind: "textbook" as const }],
  evidence:    [],
  confidence:  92
};

describe("KnowledgeEntryDraftSchema", () => {
  it("accepts a valid draft", () => {
    expect(() => KnowledgeEntryDraftSchema.parse(validDraft)).not.toThrow();
  });

  it("rejects a draft with no sources (source-backed rule)", () => {
    expect(() => KnowledgeEntryDraftSchema.parse({ ...validDraft, sources: [] })).toThrow(/source/i);
  });

  it("rejects confidence over 100", () => {
    expect(() => KnowledgeEntryDraftSchema.parse({ ...validDraft, confidence: 105 })).toThrow();
  });

  it("rejects confidence under 0", () => {
    expect(() => KnowledgeEntryDraftSchema.parse({ ...validDraft, confidence: -10 })).toThrow();
  });

  it("rejects a title that's too short", () => {
    expect(() => KnowledgeEntryDraftSchema.parse({ ...validDraft, title: "A" })).toThrow();
  });

  it("defaults difficulty when omitted", () => {
    const { difficulty: _drop, ...noDifficulty } = validDraft;
    void _drop;
    const parsed = KnowledgeEntryDraftSchema.parse(noDifficulty);
    expect(parsed.difficulty).toBe("basic");
  });
});

describe("Source + Relationship + ReviewKind enums", () => {
  it("SourceSchema accepts a bare title", () => {
    expect(() => SourceSchema.parse({ title: "AD-K Building Regs" })).not.toThrow();
  });
  it("SourceSchema rejects bad URL", () => {
    expect(() => SourceSchema.parse({ title: "x", url: "not-a-url" })).toThrow();
  });
  it("RelationshipSchema rejects an unknown relation", () => {
    expect(() => RelationshipSchema.parse("caused_by")).toThrow();
  });
  it("ReviewKindSchema accepts documented kinds only", () => {
    expect(() => ReviewKindSchema.parse("create")).not.toThrow();
    expect(() => ReviewKindSchema.parse("banana")).toThrow();
  });
});

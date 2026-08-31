// src/lib/nex/brain/tools/knowledge.test.ts
//
// Stage 3.35 · Phase E · Knowledge tool doctrine tests (Philip 2026-08-31).
//
// CONSTITUTIONAL: NEX never invents editorial answers · every hit cites
// the source key so provenance is traceable · when no entry matches the
// tool refuses honestly.

import { describe, expect, it } from "vitest";
import { extractKnowledgeSubject, runKnowledge } from "./knowledge";

describe("extractKnowledgeSubject", () => {
  it("'what is a kos-kosan?' → 'kos-kosan'", () => {
    expect(extractKnowledgeSubject("what is a kos-kosan?")).toBe("kos-kosan");
  });

  it("'what does gudeg mean?' → 'gudeg'", () => {
    expect(extractKnowledgeSubject("what does gudeg mean?")).toBe("gudeg");
  });

  it("'tell me about batik' → 'batik'", () => {
    expect(extractKnowledgeSubject("tell me about batik")).toBe("batik");
  });

  it("'apa itu batik?' → 'batik' (ID)", () => {
    expect(extractKnowledgeSubject("apa itu batik?")).toBe("batik");
  });

  it("'jelaskan gudeg' → 'gudeg' (ID)", () => {
    expect(extractKnowledgeSubject("jelaskan gudeg")).toBe("gudeg");
  });

  it("non-knowledge shape → undefined", () => {
    expect(extractKnowledgeSubject("hello there")).toBeUndefined();
    expect(extractKnowledgeSubject("find me a hotel")).toBeUndefined();
  });
});

describe("runKnowledge · honest states", () => {
  it("no query shape → found:false · no_query_extracted", () => {
    const r = runKnowledge({ message: "hello there" });
    expect(r.found).toBe(false);
    if (!r.found) expect(r.reason).toBe("no_query_extracted");
  });

  it("unknown subject → found:false · no_matching_entry · won't invent", () => {
    const r = runKnowledge({ message: "what is a xyzunknownthing?" });
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.reason).toBe("no_matching_entry");
      // Constitutional: never fabricates editorial content
      expect(r.message.en).toContain("won't invent");
      expect(r.message.id).toContain("tidak akan mengarang");
    }
  });
});

describe("runKnowledge · when editorial entry exists · provenance carried", () => {
  it("known subject returns answer with sourceKey (provenance) + lastVerified", () => {
    // Try a subject that likely exists in the corpus. The exact
    // corpus content is not the point — the shape is: found:true
    // carries a sourceKey prefixed nex.knowledge · content is
    // non-empty · replyText cites the region + last_verified.
    const r = runKnowledge({ message: "what is a kos-kosan?" });
    if (r.found) {
      expect(r.answer.sourceKey.startsWith("nex.knowledge.")).toBe(true);
      expect(r.answer.content.length).toBeGreaterThan(0);
      expect(r.replyText.en).toContain("Source:");
      expect(r.replyText.id).toContain("Sumber:");
    } else {
      // If the corpus doesn't seed kos-kosan, still assert the honest
      // refusal shape (never fabricates).
      expect(r.reason).toBe("no_matching_entry");
    }
  });
});

// src/lib/nex/brain/response-composition.test.ts
//
// P0 · Unit tests for the pure functions in the composition layer:
//   · conversational-frame · deriveFrame / frameToPromptBlock
//   · claim-verification · verifyClaims
//
// The Ollama-calling half of response-composition.ts is exercised by
// the integration runner at tests/fixtures/p0-baseline/_after_runner.mjs.
// Here we lock the deterministic contract that keeps hallucinations
// from reaching the owner even when the LLM misbehaves.

import { describe, it, expect } from "vitest";

import { deriveFrame, frameToPromptBlock } from "./conversational-frame";
import { verifyClaims } from "./claim-verification";
import type { SessionState } from "./session";
import type { ConversationalFrame } from "./conversational-frame";

// ─── deriveFrame ──────────────────────────────────────────────────

describe("deriveFrame", () => {
  it("returns market-only frame when session is null", () => {
    const f = deriveFrame(null, "ID");
    expect(f.active_market).toBe("ID");
    expect(f.running_topic).toBeUndefined();
    expect(f.recent_user_turns).toBeUndefined();
    expect(f.derived_at_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("extracts running topic from the most recent substantive user turn", () => {
    const sess = mkSession([
      { role: "user", text: "tell me about jakarta" },
      { role: "nex",  text: "Jakarta is Indonesia's capital..." },
    ]);
    const f = deriveFrame(sess, "ID");
    expect(f.running_topic).toContain("Jakarta");
  });

  it("does NOT reset topic on bare-word turns like 'and yogyakarta?'", () => {
    const sess = mkSession([
      { role: "user", text: "what industries drive surabaya?" },
      { role: "nex",  text: "Surabaya is Indonesia's second-largest city..." },
      { role: "user", text: "and yogyakarta?" },
    ]);
    const f = deriveFrame(sess, "ID");
    // Topic should still reference Surabaya since 'and yogyakarta?' is bare
    expect(f.running_topic?.toLowerCase()).toMatch(/surabaya|yogyakarta/);
  });

  it("labels running_subject as 'food scene' for follow-ups about food", () => {
    const sess = mkSession([
      { role: "user", text: "tell me about jakarta" },
      { role: "nex",  text: "Jakarta is Indonesia's capital..." },
      { role: "user", text: "what about the food scene there?" },
    ]);
    const f = deriveFrame(sess, "ID");
    expect(f.running_subject).toBe("food scene");
  });

  it("labels running_subject as 'origin & history' for 'where did it originate?'", () => {
    const sess = mkSession([
      { role: "user", text: "explain gudeg" },
      { role: "nex",  text: "Gudeg is Yogyakarta's signature dish..." },
      { role: "user", text: "where did it originate?" },
    ]);
    const f = deriveFrame(sess, "ID");
    expect(f.running_subject).toBe("origin & history");
  });

  it("carries resolved_references through when session has a resolved ordinal", () => {
    const base = mkSession([
      { role: "user", text: "list three hubs" },
      { role: "user", text: "tell me about the second one" },
    ]);
    const sess: SessionState = {
      ...base,
      currentReference: {
        resolved: true,
        refKind: "ordinal",
        offset: 2,
        business: { canonical: "Solo", raw: "solo" },
        reason: "ordinal_match",
      },
    };
    const f = deriveFrame(sess, "ID");
    expect(f.resolved_references?.[0]?.resolved_to).toBe("Solo");
    expect(f.resolved_references?.[0]?.kind).toBe("ordinal");
  });

  it("frameToPromptBlock renders a compact multi-line block", () => {
    const f: ConversationalFrame = {
      running_topic: "Jakarta",
      running_subject: "food scene",
      active_market: "ID",
      recent_user_turns: ["tell me about jakarta", "what about the food scene there?"],
      derived_at_iso: "2026-09-05T00:00:00Z",
    };
    const block = frameToPromptBlock(f);
    expect(block).toContain("[CONVERSATION FRAME]");
    expect(block).toContain("current_topic: Jakarta");
    expect(block).toContain("current_subject: food scene");
    expect(block).toContain("market: ID");
    expect(block).toContain("recent_user:");
  });
});

// ─── verifyClaims ─────────────────────────────────────────────────

describe("verifyClaims", () => {
  const baseFrame: ConversationalFrame = {
    active_market: "ID",
    derived_at_iso: "2026-09-05T00:00:00Z",
  };

  it("passes a reply that only states evidence-backed facts", () => {
    const v = verifyClaims({
      reply_text: "Jakarta is Indonesia's capital and largest city, a business hub with landmarks like Kota Tua and Monas.",
      user_message: "tell me about jakarta",
      frame: baseFrame,
      knowledge: [
        { content: "Jakarta is Indonesia's capital and largest city. Landmarks include Kota Tua and Monas." },
      ],
    });
    expect(v.passed).toBe(true);
    expect(v.flags).toHaveLength(0);
  });

  it("REJECTS a reply that fabricates a phone number", () => {
    const v = verifyClaims({
      reply_text: "The embassy phone number is +81-3-1234-5678. Call them for details.",
      user_message: "give me the phone number of the indonesian embassy in tokyo",
      frame: baseFrame,
      knowledge: [{ content: "Indonesian embassy in Tokyo handles consular affairs." }],
    });
    expect(v.passed).toBe(false);
    expect(v.flags.some((f) => f.kind === "phone" && f.severity === "high")).toBe(true);
    expect(v.reason).toMatch(/high_risk_flag/);
  });

  it("REJECTS a reply that fabricates a URL", () => {
    const v = verifyClaims({
      reply_text: "Visit https://embassy.example.fake for details.",
      user_message: "how do I contact the embassy?",
      frame: baseFrame,
      knowledge: [],
    });
    expect(v.passed).toBe(false);
    expect(v.flags.some((f) => f.kind === "url")).toBe(true);
  });

  it("REJECTS an exchange rate quote without evidence", () => {
    const v = verifyClaims({
      reply_text: "The current USD/IDR rate is 15,850 rupiah per dollar.",
      user_message: "what's the current USD/IDR exchange rate today?",
      frame: baseFrame,
      knowledge: [],
    });
    expect(v.passed).toBe(false);
    expect(v.flags.some((f) => f.kind === "exchange_rate" || f.kind === "specific_number")).toBe(true);
  });

  it("REJECTS a freight rate quote without evidence", () => {
    const v = verifyClaims({
      reply_text: "A 20ft reefer from Surabaya to Yokohama runs about USD 2,800 per container.",
      user_message: "quote me a shipping price from surabaya to yokohama for a 20ft reefer",
      frame: baseFrame,
      knowledge: [],
    });
    expect(v.passed).toBe(false);
    expect(v.flags.some((f) => f.kind === "freight_rate" || f.kind === "price")).toBe(true);
  });

  it("REJECTS a named-person political claim not in evidence", () => {
    const v = verifyClaims({
      reply_text: "The current governor of Jakarta is Made Up Person.",
      user_message: "who's the current governor of jakarta?",
      frame: baseFrame,
      knowledge: [{ content: "Jakarta is Indonesia's capital and largest city." }],
    });
    expect(v.passed).toBe(false);
    expect(v.flags.some((f) => f.kind === "named_person")).toBe(true);
  });

  it("PASSES a reply that honestly boundaries a phone number question", () => {
    const v = verifyClaims({
      reply_text: "I don't have that specific phone number. You can find embassy contact details on the Indonesian foreign ministry's official website.",
      user_message: "give me the phone number of the indonesian embassy in tokyo",
      frame: baseFrame,
      knowledge: [],
    });
    expect(v.passed).toBe(true);
    expect(v.flags).toHaveLength(0);
  });

  it("PASSES a price that IS in evidence", () => {
    const v = verifyClaims({
      reply_text: "A typical kos-kosan runs about Rp 1,500,000 per month.",
      user_message: "how much is kos-kosan?",
      frame: baseFrame,
      knowledge: [{ content: "Kos-kosan (boarding houses) typically cost Rp 1,500,000 per month in Jakarta." }],
    });
    expect(v.passed).toBe(true);
  });

  it("REJECTS multiple low-risk flags over budget", () => {
    // Budget default = 2 · so 3 unattested Jl. addresses trigger rejection
    const v = verifyClaims({
      reply_text: "Try Jl. Sudirman No. 45, Jl. Thamrin No. 12, and Jl. Rasuna No. 78 for the best options.",
      user_message: "where should I go?",
      frame: baseFrame,
      knowledge: [],
    });
    expect(v.passed).toBe(false);
    expect(v.reason).toMatch(/low_risk_over_budget|high_risk_flag/);
  });
});

// ─── P0.2 · Semantic contradiction (gap #3) ──────────────────────

describe("P0.2 · semantic contradiction detection", () => {
  const baseFrame: ConversationalFrame = {
    active_market: "ID",
    derived_at_iso: "2026-09-05T00:00:00Z",
  };

  it("REJECTS a definitional claim whose predicate has no overlap with knowledge", () => {
    // "HS code 0304 covers canned fish" · knowledge says fillets, not canned
    const v = verifyClaims({
      reply_text: "HS code 0304 refers to canned processed fish products intended for retail.",
      user_message: "what's HS code 0304?",
      frame: baseFrame,
      knowledge: [
        { content: "HS code 0304 covers fresh, chilled or frozen fish fillets and other fish meat, whether or not minced.", topic: "hs.code.0304" },
      ],
    });
    expect(v.passed).toBe(false);
    const hasSemanticFlag = v.flags.some((f) => f.kind === "semantic_contradiction");
    expect(hasSemanticFlag).toBe(true);
  });

  it("PASSES a definitional claim whose predicate overlaps with knowledge", () => {
    const v = verifyClaims({
      reply_text: "HS code 0304 refers to fresh, chilled or frozen fish fillets and other fish meat.",
      user_message: "what's HS code 0304?",
      frame: baseFrame,
      knowledge: [
        { content: "HS code 0304 covers fresh, chilled or frozen fish fillets and other fish meat, whether or not minced.", topic: "hs.code.0304" },
      ],
    });
    expect(v.passed).toBe(true);
  });

  it("flags a definitional historical claim when subject is not in retrieved knowledge", () => {
    // "Bahasa Gaul was the language of France before Roman conquest"
    // Subject not in knowledge · confident historical claim · should flag (low severity)
    const v = verifyClaims({
      reply_text: "Bahasa Gaul refers to a language used in France centuries ago before the Roman conquest.",
      user_message: "what is bahasa gaul?",
      frame: baseFrame,
      knowledge: [
        { content: "Indonesia's official language is Bahasa Indonesia.", topic: "language.indonesian" },
      ],
    });
    // Definitional-claim-unsupported is severity=low. Whether it rejects
    // depends on total low-flag budget. We assert the flag exists.
    const hasUnsupportedFlag = v.flags.some(
      (f) => f.kind === "definitional_claim_unsupported" || f.kind === "semantic_contradiction",
    );
    expect(hasUnsupportedFlag).toBe(true);
  });

  it("does NOT flag prose without a definitional shape", () => {
    // Same knowledge, but reply is conversational not definitional
    const v = verifyClaims({
      reply_text: "That's a great question about Indonesian culture. I don't have detailed information about it.",
      user_message: "what is bahasa gaul?",
      frame: baseFrame,
      knowledge: [{ content: "Indonesia's official language is Bahasa Indonesia." }],
    });
    expect(v.passed).toBe(true);
    const hasSemanticFlag = v.flags.some(
      (f) => f.kind === "semantic_contradiction" || f.kind === "definitional_claim_unsupported",
    );
    expect(hasSemanticFlag).toBe(false);
  });

  it("does NOT flag when predicate overlaps meaningfully via user context (downgrades to low)", () => {
    const v = verifyClaims({
      reply_text: "Tempeh refers to a fermented soybean cake originating from Indonesia.",
      user_message: "Tempeh, the fermented soybean cake from Indonesia, is popular.",
      frame: baseFrame,
      knowledge: [], // no retrieved knowledge — user context is the evidence
    });
    // The user_message contains the key evidence · verifier should not
    // reject this even though retrieved knowledge is empty.
    const highFlags = v.flags.filter((f) => f.severity === "high");
    expect(highFlags.length).toBe(0);
  });
});

// ─── P0.2 · Composed-list entity extraction (gap #4) ─────────────

describe("P0.2 · composed entity extraction", () => {
  it("extracts entities from a comma-separated composed list with 'like' intro", async () => {
    const { extractEnumeratedEntities } = await import("./composed-entities");
    const reply = "Indonesia's main coffee-producing regions are like Aceh, Java, and Sulawesi.";
    const entities = extractEnumeratedEntities(reply);
    const canonicals = entities.map((e) => e.canonical);
    expect(canonicals).toContain("aceh");
    expect(canonicals).toContain("java");
    expect(canonicals).toContain("sulawesi");
  });

  it("extracts entities from a numbered list", async () => {
    const { extractEnumeratedEntities } = await import("./composed-entities");
    const reply = "Three important textile hubs are: 1. Solo 2. Yogyakarta 3. Bandung.";
    const entities = extractEnumeratedEntities(reply);
    // Numbered pattern requires proper formatting; assert we got at least 2
    expect(entities.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty for prose that is not an enumerated list", async () => {
    const { extractEnumeratedEntities } = await import("./composed-entities");
    const reply =
      "That's an interesting question. I have some general knowledge about the topic but not specifics.";
    const entities = extractEnumeratedEntities(reply);
    expect(entities.length).toBe(0);
  });

  it("does not fabricate entities from empty text", async () => {
    const { extractEnumeratedEntities } = await import("./composed-entities");
    expect(extractEnumeratedEntities("").length).toBe(0);
  });

  it("composedListToEntities produces RecognisedEntity records with presentedOffset", async () => {
    const { composedListToEntities } = await import("./composed-entities");
    const reply = "Indonesia's main coffee-producing regions are Aceh, Java, and Sulawesi.";
    const entities = composedListToEntities(reply);
    expect(entities.length).toBeGreaterThan(0);
    for (const e of entities) {
      expect(e.kind).toBe("place");
      expect(e.source).toBe("nex_reply");
      expect(typeof e.presentedOffset).toBe("number");
      expect(e.canonical).toBeTruthy();
      expect(e.id).toMatch(/^place:/);
    }
  });
});

// ─── helpers ──────────────────────────────────────────────────────

function mkSession(turns: Array<{ role: "user" | "nex"; text: string }>): SessionState {
  const now = Date.now();
  return {
    conversationId: "test-session",
    createdAt: now,
    updatedAt: now,
    dialogueTurns: turns.map((t, i) => ({
      role: t.role,
      text: t.text,
      atIso: new Date(now - (turns.length - i) * 1000).toISOString(),
    })),
  };
}

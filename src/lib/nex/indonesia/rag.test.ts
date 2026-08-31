// rag.test.ts · unit coverage of the decideRag helper.
//
// Ensures:
//   · Knowledge intents (indonesia/tourism/food/places) attach RAG.
//   · Chit-chat / specialists / trades do NOT attach RAG (blocking
//     the "greeting fed Bali facts" failure mode).
//   · Secondary-indonesia action intents attach (booking a hotel in
//     Ubud gets Bali facts; a generic "book me a hotel" does not).
//   · Unknown queries produce an empty attachment with the
//     don't-invent guidance in the suffix.

import { describe, it, expect, beforeEach } from "vitest";
import { decideRag, ragTopics, _resetGapRegistrySingletonForTests } from "./rag";
import { _resetKnowledgeCacheForTests } from "./knowledge";
import { GapRegistry } from "./gaps/gap-registry";

// Redirect the module-level singleton to an in-memory instance for
// EVERY test in this file · prevents pre-existing tests (that don't
// pass their own gapRegistry) from persisting test queries into the
// real data/indonesia/knowledge-gaps.json.
beforeEach(() => {
  _resetKnowledgeCacheForTests();
  _resetGapRegistrySingletonForTests(new GapRegistry({ inMemoryOnly: true }));
});

describe("decideRag · knowledge intents attach", () => {
  it("'Tell me about Bali' → attached with Bali hits", () => {
    const r = decideRag("Tell me about Bali");
    expect(r.attached).toBe(true);
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0]!.region).toBe("Bali");
    expect(r.block).toMatch(/Canggu|Seminyak|Ubud/);
    expect(r.systemPromptSuffix).toMatch(/NEX INDONESIA GUIDANCE/);
    expect(r.reason).toMatch(/indonesia_intent|tourism_intent/);
  });

  it("food question attaches food records", () => {
    const r = decideRag("What is nasi goreng?");
    expect(r.attached).toBe(true);
    expect(r.hits[0]!.topic).toBe("food.nasi_goreng");
  });

  it("place-focused tourism question attaches tourism records", () => {
    const r = decideRag("What should I do in Yogyakarta?");
    expect(r.attached).toBe(true);
    expect(ragTopics(r).some((t) => t.startsWith("tourism"))).toBe(true);
  });
});

describe("decideRag · chit-chat and specialists do NOT attach", () => {
  it("greeting does not attach", () => {
    const r = decideRag("Hi NEX");
    expect(r.attached).toBe(false);
    expect(r.reason).toBe("skip_conversation_intent");
    expect(r.hits).toEqual([]);
    expect(r.block).toBe("");
    // Suffix stays empty so we don't confuse the LLM with irrelevant guidance.
    expect(r.systemPromptSuffix).toBe("");
  });

  it("small talk does not attach", () => {
    const r = decideRag("Tell me something interesting");
    expect(r.attached).toBe(false);
  });

  it("staircase specialist does not attach", () => {
    const r = decideRag("Calculate my staircase");
    expect(r.attached).toBe(false);
    expect(r.reason).toBe("skip_staircase_intent");
  });

  it("UK trades do not attach", () => {
    const r = decideRag("I need a plumber");
    expect(r.attached).toBe(false);
    expect(r.reason).toBe("skip_trades_intent");
  });
});

describe("decideRag · secondary-indonesia action intents", () => {
  it("booking in Ubud triggers RAG (secondary=indonesia)", () => {
    const r = decideRag("book me a hotel in Ubud");
    expect(r.attached).toBe(true);
    expect(r.intent.intent).toBe("booking");
    expect(r.intent.secondary).toBe("indonesia");
  });

  it("booking with no Indonesia mention does NOT trigger RAG", () => {
    const r = decideRag("book me a hotel");
    expect(r.attached).toBe(false);
    expect(r.reason).toBe("skip_booking_intent");
  });

  it("weather in Bali triggers RAG (secondary=indonesia)", () => {
    const r = decideRag("What is the weather like in Bali?");
    expect(r.attached).toBe(true);
    expect(r.intent.intent).toBe("weather");
  });
});

describe("decideRag · empty corpus behaviour", () => {
  it("unknown query in a knowledge intent → attached=false with don't-invent guidance", () => {
    // Contrived · matches the tourism intent (via "itinerary") but no
    // knowledge record's keywords/topics fire, so we get zero hits.
    const r = decideRag("plan me an itinerary for xyzzy zplugh qwv");
    expect(r.intent.intent).toBe("tourism");
    expect(r.hits).toEqual([]);
    expect(r.attached).toBe(false);
    expect(r.reason).toBe("no_relevant_hits");
    expect(r.systemPromptSuffix).toMatch(/Do NOT invent/);
    expect(r.systemPromptSuffix).toMatch(/grounded knowledge corpus has no relevant record/);
  });
});

describe("decideRag · force flag (test escape hatch)", () => {
  it("force=true attaches even for chit-chat", () => {
    const r = decideRag("hi", { force: true });
    expect(r.hits).toEqual([]);
    // No relevant hits so attached is still false but the reason
    // indicates the corpus was consulted.
    expect(r.reason).toBe("no_relevant_hits");
  });
});

// ─── Doctrine rule 3 · gap loop wires real chat retrieval into
// GapRegistry so acquisition can prioritise unanswered queries.

describe("decideRag · gap-loop wire-up (Doctrine rule 3)", () => {
  it("query with no hits → gap recorded with reason=no_hits", () => {
    const gaps = new GapRegistry({ inMemoryOnly: true });
    // Genuinely non-matching text · avoids seed keywords like province
    // slugs AND avoids the "rp" 2-char currency keyword that spuriously
    // matches many random strings via naive substring scoring.
    const r = decideRag("qqq zzz plurm nograt bloop uniqueXYZ", { gapRegistry: gaps, force: true });
    expect(r.attached).toBe(false);
    expect(r.reason).toBe("no_relevant_hits");
    const snap = gaps.getSnapshot();
    expect(snap.gaps.length).toBeGreaterThanOrEqual(1);
    expect(snap.gaps[0]!.reason).toBe("no_hits");
  });

  it("chit-chat intent → NO gap even without hits (gate blocks retrieval first)", () => {
    const gaps = new GapRegistry({ inMemoryOnly: true });
    const r = decideRag("hi how are you doing", { gapRegistry: gaps });
    expect(r.attached).toBe(false);
    expect(r.reason).toMatch(/^skip_/);
    expect(gaps.getSnapshot().gaps.length).toBe(0);
  });

  it("strong knowledge hit → NO gap (detector considers retrieval sufficient)", () => {
    const gaps = new GapRegistry({ inMemoryOnly: true });
    const r = decideRag("what is the capital of Indonesia?", { gapRegistry: gaps });
    expect(r.attached).toBe(true);
    expect(gaps.getSnapshot().gaps.length).toBe(0);
  });

  it("same query twice → one gap · frequency bumped (idempotent)", () => {
    const gaps = new GapRegistry({ inMemoryOnly: true });
    decideRag("qqq zzz plurm nograt bloop", { gapRegistry: gaps, force: true });
    decideRag("qqq zzz plurm nograt bloop", { gapRegistry: gaps, force: true });
    const snap = gaps.getSnapshot();
    expect(snap.gaps.length).toBe(1);
    expect(snap.gaps[0]!.frequency).toBe(2);
  });

  it("recorded gaps reach the acquisition-priority pipeline via topOpenGaps()", () => {
    const gaps = new GapRegistry({ inMemoryOnly: true });
    decideRag("wummbldy grxpq specific unknown thing", { gapRegistry: gaps, force: true });
    const top = gaps.topOpenGaps(5);
    expect(top.length).toBeGreaterThanOrEqual(1);
    expect(top[0]!.status).toBe("OPEN");
    expect(top[0]!.priority).toBeGreaterThan(0);
  });

  it("disableGapRecording flag prevents any observation (used in pure-scoring tests)", () => {
    const gaps = new GapRegistry({ inMemoryOnly: true });
    decideRag("frnnop zzq blork with no hits", { gapRegistry: gaps, disableGapRecording: true, force: true });
    expect(gaps.getSnapshot().gaps.length).toBe(0);
  });
});

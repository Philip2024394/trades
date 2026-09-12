// src/lib/nex/brain/reasoning/decision-intent.test.ts
// Wave 7 · Conversational Entity Reasoning · unit tests

import { describe, expect, it } from "vitest";
import { classifyDecisionIntent } from "./decision-intent";

describe("decision-intent · epistemic challenge", () => {
  it("'are you sure?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("are you sure?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
  it("'really? are you sure?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("really? are you sure?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
  it("bare 'sure?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("sure?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
  it("Indonesian 'yakin?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("yakin?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
});

describe("decision-intent · evidence request", () => {
  it("'what are you basing that on?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("what are you basing that on?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
  it("'on what evidence?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("on what evidence?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
  // Integration Recovery 2026-09-06 · natural-variation closure
  it("'on what basis?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("on what basis?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
  it("Indonesian 'dasarnya apa?' → EVIDENCE_REQUEST", () => {
    const d = classifyDecisionIntent("dasarnya apa?");
    expect(d.kind).toBe("ENTITY_EVIDENCE_REQUEST");
  });
});

// Integration Recovery 2026-09-06 · closes ID recommendation gap
// the phrase-anchored detectRecommendationIntent missed.
describe("decision-intent · choice question (ID/EN composed)", () => {
  it("Indonesian 'mana yang akan kamu pilih?' → RECOMMENDATION_REQUEST", () => {
    const d = classifyDecisionIntent("mana yang akan kamu pilih?");
    expect(d.kind).toBe("ENTITY_RECOMMENDATION_REQUEST");
  });
  it("Indonesian 'mana yang kamu rekomendasikan?' → RECOMMENDATION_REQUEST", () => {
    const d = classifyDecisionIntent("mana yang kamu rekomendasikan?");
    expect(d.kind).toBe("ENTITY_RECOMMENDATION_REQUEST");
  });
});

describe("decision-intent · unknown request", () => {
  it("'what don't you know?' → UNKNOWN_REQUEST", () => {
    const d = classifyDecisionIntent("what don't you know?");
    expect(d.kind).toBe("ENTITY_UNKNOWN_REQUEST");
  });
  it("'what is unknown?' → UNKNOWN_REQUEST", () => {
    const d = classifyDecisionIntent("what is unknown here?");
    expect(d.kind).toBe("ENTITY_UNKNOWN_REQUEST");
  });
});

describe("decision-intent · reason request", () => {
  it("bare 'why?' → REASON_REQUEST", () => {
    const d = classifyDecisionIntent("why?");
    expect(d.kind).toBe("ENTITY_REASON_REQUEST");
  });
  it("'why would I choose that?' → REASON_REQUEST", () => {
    const d = classifyDecisionIntent("why would I choose that?");
    expect(d.kind).toBe("ENTITY_REASON_REQUEST");
  });
  it("'how do you know?' → REASON_REQUEST", () => {
    const d = classifyDecisionIntent("how do you know?");
    expect(d.kind).toBe("ENTITY_REASON_REQUEST");
  });
  it("'explain' → REASON_REQUEST", () => {
    const d = classifyDecisionIntent("explain");
    expect(d.kind).toBe("ENTITY_REASON_REQUEST");
  });
  it("Indonesian 'kenapa?' → REASON_REQUEST", () => {
    const d = classifyDecisionIntent("kenapa?");
    expect(d.kind).toBe("ENTITY_REASON_REQUEST");
  });
});

describe("decision-intent · pros/cons", () => {
  it("'pros and cons?' → PROS_CONS", () => {
    const d = classifyDecisionIntent("pros and cons?");
    expect(d.kind).toBe("ENTITY_PROS_CONS");
  });
  it("'any downsides?' → PROS_CONS", () => {
    const d = classifyDecisionIntent("any downsides?");
    expect(d.kind).toBe("ENTITY_PROS_CONS");
  });
  it("Indonesian 'kelebihan dan kekurangannya?' → PROS_CONS", () => {
    const d = classifyDecisionIntent("kelebihan dan kekurangannya?");
    expect(d.kind).toBe("ENTITY_PROS_CONS");
  });
});

describe("decision-intent · comparison (reuses existing detector)", () => {
  it("'compare the first two' → COMPARISON", () => {
    const d = classifyDecisionIntent("compare the first two");
    expect(d.kind).toBe("ENTITY_COMPARISON");
  });
  it("'which is better?' → COMPARISON", () => {
    const d = classifyDecisionIntent("which is better?");
    expect(d.kind).toBe("ENTITY_COMPARISON");
  });
});

describe("decision-intent · best-for", () => {
  it("'which is best for me?' → BEST_FOR", () => {
    const d = classifyDecisionIntent("which is best for me?");
    expect(d.kind).toBe("ENTITY_BEST_FOR");
  });
  it("'which is best for our family?' → BEST_FOR", () => {
    const d = classifyDecisionIntent("which is best for our family?");
    expect(d.kind).toBe("ENTITY_BEST_FOR");
  });
});

describe("decision-intent · suitability", () => {
  it("'would this work for us?' → SUITABILITY", () => {
    const d = classifyDecisionIntent("would this work for us?");
    expect(d.kind).toBe("ENTITY_SUITABILITY");
  });
});

describe("decision-intent · factual ranking", () => {
  it("'which is cheapest?' → RANKING", () => {
    const d = classifyDecisionIntent("which is cheapest?");
    expect(d.kind).toBe("ENTITY_RANKING");
  });
  it("'which is closest?' → RANKING", () => {
    const d = classifyDecisionIntent("which is closest?");
    expect(d.kind).toBe("ENTITY_RANKING");
  });
  it("Indonesian 'yang mana termurah?' → RANKING", () => {
    const d = classifyDecisionIntent("yang mana termurah?");
    expect(d.kind).toBe("ENTITY_RANKING");
  });
});

describe("decision-intent · recommendation (reuses existing detector)", () => {
  it("'which would you choose?' → RECOMMENDATION_REQUEST", () => {
    const d = classifyDecisionIntent("which would you choose?");
    expect(d.kind).toBe("ENTITY_RECOMMENDATION_REQUEST");
  });
  it("'recommend one' → RECOMMENDATION_REQUEST", () => {
    const d = classifyDecisionIntent("recommend one");
    expect(d.kind).toBe("ENTITY_RECOMMENDATION_REQUEST");
  });
});

describe("decision-intent · opinion", () => {
  it("'what do you think of it?' → OPINION_REQUEST", () => {
    const d = classifyDecisionIntent("what do you think of it?");
    expect(d.kind).toBe("ENTITY_OPINION_REQUEST");
  });
  it("Indonesian 'menurut kamu?' → OPINION_REQUEST", () => {
    const d = classifyDecisionIntent("menurut kamu?");
    expect(d.kind).toBe("ENTITY_OPINION_REQUEST");
  });
});

describe("decision-intent · negatives", () => {
  it("'hello' → NONE", () => {
    expect(classifyDecisionIntent("hello").kind).toBe("NONE");
  });
  it("'find me hotels' → NONE", () => {
    expect(classifyDecisionIntent("find me hotels").kind).toBe("NONE");
  });
  it("'does it have a pool?' → NONE (that's an attribute-query, not a reasoning act)", () => {
    // The existing attribute-query gate should handle this · we don't
    // want to intercept it. NONE is correct so this gate defers.
    expect(classifyDecisionIntent("does it have a pool?").kind).toBe("NONE");
  });
});

describe("decision-intent · language detection", () => {
  it("EN default", () => {
    expect(classifyDecisionIntent("why?").language).toBe("EN");
  });
  it("ID markers detected", () => {
    expect(classifyDecisionIntent("bandingkan yang pertama dan kedua").language).toBe("ID");
  });
});

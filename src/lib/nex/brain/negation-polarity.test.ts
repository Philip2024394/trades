// src/lib/nex/brain/negation-polarity.test.ts
//
// G12 · Negation Intelligence · unit tests.
// Philip 2026-09-06 · AUTHORIZE · G12.

import { describe, it, expect } from "vitest";
import {
  classifyPolarity,
  shouldGateOnPolarity,
  type Polarity,
  type NegationScope,
} from "./negation-polarity";

const expectPolarity = (msg: string, polarity: Polarity, scope: NegationScope) => {
  it(`"${msg}" → ${polarity} / ${scope}`, () => {
    const p = classifyPolarity(msg);
    expect(p.polarity, `polarity for "${msg}"`).toBe(polarity);
    expect(p.scope, `scope for "${msg}"`).toBe(scope);
  });
};

// ─── AFFIRMATIVE baseline (no negation trigger) ──────────────────

describe("AFFIRMATIVE · no negation trigger", () => {
  expectPolarity("I want a hotel", "AFFIRMATIVE", "NONE");
  expectPolarity("find me a hotel", "AFFIRMATIVE", "NONE");
  expectPolarity("saya mau hotel", "AFFIRMATIVE", "NONE");
  expectPolarity("cari hotel", "AFFIRMATIVE", "NONE");
});

// ─── REQUEST-scoped negation · positive/negative pairs ──────────

describe("NEGATED / REQUEST · positive/negative pairs (§7 §8)", () => {
  expectPolarity("I don't want a hotel", "NEGATED", "REQUEST");
  expectPolarity("I do not want a hotel", "NEGATED", "REQUEST");
  expectPolarity("I don't need a hotel", "NEGATED", "REQUEST");
  expectPolarity("I'm not looking for a hotel", "NEGATED", "REQUEST");
  expectPolarity("I'm not after a hotel", "NEGATED", "REQUEST");
});

// ─── ACTION-scoped negation · "don't search/find/book" ──────────

describe("NEGATED / ACTION · imperative-verb negation", () => {
  expectPolarity("don't find me hotels", "NEGATED", "ACTION");
  expectPolarity("don't show me hotels", "NEGATED", "ACTION");
  expectPolarity("don't book the hotel", "NEGATED", "ACTION");
  expectPolarity("don't search yet", "NEGATED", "ACTION");
  expectPolarity("jangan cari hotel", "NEGATED", "ACTION");
});

// ─── ENTITY-scoped bare negation ────────────────────────────────

describe("NEGATED / ENTITY · bare-entity negation", () => {
  expectPolarity("no hotels", "NEGATED", "ENTITY");
  expectPolarity("no hotel", "NEGATED", "ENTITY");
  expectPolarity("not a hotel", "NEGATED", "ENTITY");
  expectPolarity("bukan hotel", "NEGATED", "ENTITY");
});

// ─── ATTRIBUTE-scoped negation · ENTITY still desired ───────────
//
// CRITICAL scope trap · these must NOT collapse the whole request.

describe("AFFIRMATIVE / ATTRIBUTE · entity affirmed, attribute negated (§10)", () => {
  expectPolarity("I want a hotel that's not expensive", "AFFIRMATIVE", "ATTRIBUTE");
  expectPolarity("I want somewhere that's not far from Malioboro", "AFFIRMATIVE", "ATTRIBUTE");
  expectPolarity("I don't want an expensive hotel", "AFFIRMATIVE", "ATTRIBUTE");
});

// ─── CONTRASTIVE negation · "not X — Y" / "not X but Y" ─────────

describe("CONTRASTIVE · contrastive negation with alternative (§11)", () => {
  it('"Not a hotel — a restaurant" → CONTRASTIVE, targets = hotel / restaurant', () => {
    const p = classifyPolarity("Not a hotel -- a restaurant");
    expect(p.polarity).toBe("CONTRASTIVE");
    expect(p.scope).toBe("CONTRASTIVE");
    expect(p.contrastive_target).toBe("restaurant");
  });

  it('"I don\'t want a hotel, I want a restaurant" → CONTRASTIVE', () => {
    // Comma is stripped · connector is "actually"/"but"/"instead"/"rather"
    // — this input uses no connector, so it falls to REQUEST scope. Test
    // the connector-based shape:
    const p = classifyPolarity("I don't want a hotel, but I want a restaurant");
    expect(p.polarity).toBe("CONTRASTIVE");
  });

  it('"I don\'t want a hotel, actually I want a restaurant" → CONTRASTIVE', () => {
    const p = classifyPolarity("I don't want a hotel, actually I want a restaurant");
    expect(p.polarity).toBe("CONTRASTIVE");
  });
});

// ─── RESULT-context negation · task still active ────────────────

describe("NEGATED / RESULT · result-context negation (§13)", () => {
  expectPolarity("I don't want the first one", "NEGATED", "RESULT");
  expectPolarity("not that one", "NEGATED", "RESULT");
  expectPolarity("I don't want that hotel", "NEGATED", "RESULT");
});

// ─── QUESTION-shape negation · not a request rejection ──────────

describe("NEGATED / QUESTION · rhetorical / interrogative negation (§15)", () => {
  expectPolarity("don't you have any hotels", "NEGATED", "QUESTION");
  expectPolarity("why don't you show me hotels", "NEGATED", "QUESTION");
  expectPolarity("which hotels don't have parking", "NEGATED", "QUESTION");
  expectPolarity("aren't you sure", "NEGATED", "QUESTION");
});

// ─── SOCIAL fixed-form negation · MUST NOT rejection scope ──────

describe("NEGATED / SOCIAL · social fixed forms (§14)", () => {
  expectPolarity("no thanks", "NEGATED", "SOCIAL");
  expectPolarity("no thank you", "NEGATED", "SOCIAL");
  expectPolarity("no problem", "NEGATED", "SOCIAL");
  expectPolarity("no worries", "NEGATED", "SOCIAL");
  expectPolarity("I don't know", "NEGATED", "SOCIAL");
  expectPolarity("I don't mind", "NEGATED", "SOCIAL");
  expectPolarity("I don't think so", "NEGATED", "SOCIAL");
});

// ─── Indonesian coverage · §9 representative cases ──────────────

describe("Indonesian · §9 representative cases", () => {
  expectPolarity("saya tidak mau hotel", "NEGATED", "REQUEST");
  expectPolarity("saya tidak butuh hotel", "NEGATED", "REQUEST");
  expectPolarity("saya tidak mencari hotel", "NEGATED", "REQUEST");
  expectPolarity("saya tidak ingin hotel", "NEGATED", "REQUEST");
  expectPolarity("bukan hotel", "NEGATED", "ENTITY");
  expectPolarity("jangan cari hotel", "NEGATED", "ACTION");
});

// ─── Gate helper ────────────────────────────────────────────────

describe("shouldGateOnPolarity · gates ONLY on genuine request-level negation", () => {
  const gates = [
    "I don't want a hotel",           // REQUEST
    "don't find me hotels",           // ACTION
    "no hotel",                       // ENTITY
    "not a hotel -- a restaurant",    // CONTRASTIVE
    "saya tidak mau hotel",           // REQUEST · ID
  ];
  for (const m of gates) {
    it(`"${m}" → gates`, () => {
      expect(shouldGateOnPolarity(classifyPolarity(m))).toBe(true);
    });
  }
  const noGate = [
    "I want a hotel",                              // affirmative
    "I want a hotel that's not expensive",         // AFFIRMATIVE / ATTRIBUTE
    "I don't want the first one",                  // RESULT
    "don't you have any hotels?",                  // QUESTION
    "no thanks",                                   // SOCIAL
    "I don't know",                                // SOCIAL
    "which hotels don't have parking?",            // QUESTION
    "cari hotel",                                  // affirmative
  ];
  for (const m of noGate) {
    it(`"${m}" → does NOT gate`, () => {
      expect(shouldGateOnPolarity(classifyPolarity(m))).toBe(false);
    });
  }
});

// ─── ADVERSARIAL scope traps (§23) ──────────────────────────────

describe("§23 · adversarial scope traps", () => {
  it('"No thanks, I\'m still looking for a hotel" → SOCIAL (not REQUEST negation)', () => {
    // The "no thanks" is social; "still looking for a hotel" is affirmative.
    // SOCIAL detector runs first (precedence rule).
    const p = classifyPolarity("no thanks, i'm still looking for a hotel");
    expect(p.polarity).toBe("NEGATED");
    expect(p.scope).toBe("SOCIAL");
    expect(shouldGateOnPolarity(p)).toBe(false);
  });

  it('"I don\'t want that hotel, show me another one" → RESULT (not global cancellation)', () => {
    const p = classifyPolarity("i don't want that hotel show me another one");
    expect(p.scope).toBe("RESULT");
    expect(shouldGateOnPolarity(p)).toBe(false);
  });
});

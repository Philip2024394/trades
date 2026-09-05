// src/lib/nex/brain/honest-boundary-reply.test.ts
//
// Regression tests for P0 zero-evidence fabrication guard.
// Philip 2026-09-05 · chief-engineer AUTHORIZE.
//
// Covers all 7 required test cases from the AUTHORIZE literal:
//   Test 1 · Zero knowledge · unsupported domain facts BLOCKED
//   Test 2 · Grounded food · substantive reply STILL COMPOSED
//   Test 3 · Grounded hotel · directory reply STILL COMPOSED
//   Test 4 · Grounded gym · directory reply STILL COMPOSED
//   Test 5 · Grounded travel · airport reply STILL COMPOSED
//   Test 6 · Genuine unknown · honest boundary
//   Test 7 · Voice · derives from accepted response (inherits corrected)
//
// Plus adversarial coverage:
//   · Meta/opinion queries ("What do you think?") must NOT be gated
//   · Subject extraction must reject pronouns and stopwords
//   · Language detection must route EN/ID correctly
//   · Boundary text must NOT contain domain claims

import { describe, it, expect } from "vitest";
import {
  extractSubject,
  detectOwnerLanguage,
  decideHonestBoundary,
  buildGenericBoundaryReply,
} from "./honest-boundary-reply";

// ─── Subject extraction ─────────────────────────────────────────────

describe("extractSubject · identifies domain topics from user messages", () => {
  it("extracts 'tuna' from 'What about tuna?' — FOOD T2 reproduction", () => {
    expect(extractSubject("What about tuna?")).toBe("tuna");
  });

  it("extracts 'Japan' from 'What about Japan?' — FOOD T4 reproduction", () => {
    expect(extractSubject("What about Japan?")).toBe("Japan");
  });

  it("extracts 'babi guling' from 'Tell me about babi guling'", () => {
    expect(extractSubject("Tell me about babi guling")).toBe("babi guling");
  });

  it("extracts 'Denpasar airport' from 'Tell me about Denpasar airport.'", () => {
    expect(extractSubject("Tell me about Denpasar airport.")).toBe("Denpasar airport");
  });

  it("extracts subject from 'Explain rendang'", () => {
    expect(extractSubject("Explain rendang")).toBe("rendang");
  });

  it("extracts subject from 'What is nasi goreng?'", () => {
    expect(extractSubject("What is nasi goreng?")).toBe("nasi goreng");
  });

  it("returns null for meta/opinion questions — 'What do you think?'", () => {
    // "what do you think" doesn't hit any subject-extractor pattern
    expect(extractSubject("What do you think?")).toBeNull();
  });

  it("returns null for pronoun questions — 'Tell me about yourself'", () => {
    expect(extractSubject("Tell me about yourself")).toBeNull();
  });

  it("returns null for 'What about you?'", () => {
    expect(extractSubject("What about you?")).toBeNull();
  });

  it("returns null for pure social — 'Hi', 'Hello', 'Thanks'", () => {
    expect(extractSubject("Hi")).toBeNull();
    expect(extractSubject("Hello")).toBeNull();
    expect(extractSubject("Thanks")).toBeNull();
  });

  it("returns null for empty / whitespace", () => {
    expect(extractSubject("")).toBeNull();
    expect(extractSubject("   ")).toBeNull();
  });

  it("returns null for pronoun after 'about' — 'What about it?'", () => {
    expect(extractSubject("What about it?")).toBeNull();
  });

  it("extracts Indonesian subject from 'ceritakan tentang gudeg'", () => {
    expect(extractSubject("ceritakan tentang gudeg")).toBe("gudeg");
  });
});

// ─── Owner-language detection ───────────────────────────────────────

describe("detectOwnerLanguage · routes EN vs ID", () => {
  it("English question detected as en", () => {
    expect(detectOwnerLanguage("What about Japan?")).toBe("en");
    expect(detectOwnerLanguage("Tell me about tuna.")).toBe("en");
  });

  it("Indonesian question detected as id", () => {
    expect(detectOwnerLanguage("Apa itu nasi goreng?")).toBe("id");
    expect(detectOwnerLanguage("Ceritakan tentang gudeg")).toBe("id");
    expect(detectOwnerLanguage("Halo, saya ingin bertanya")).toBe("id");
  });
});

// ─── decideHonestBoundary · Test 1 · Zero knowledge (AUTHORIZE required) ─

describe("Test 1 · Zero knowledge → boundary applies (unsupported domain facts blocked)", () => {
  it("FOOD T4 pattern · 'What about Japan?' with k=0 → boundary applies", () => {
    const r = decideHonestBoundary({
      userMessage: "What about Japan?",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(true);
    if (r.applies) {
      expect(r.subject).toBe("Japan");
      expect(r.language).toBe("en");
      expect(r.reply).toContain("Japan");
      // MUST NOT contain fabricated domain claims about Japan
      expect(r.reply.toLowerCase()).not.toContain("sushi");
      expect(r.reply.toLowerCase()).not.toContain("sashimi");
      expect(r.reply.toLowerCase()).not.toContain("ramen");
      // MUST signal absence of grounded evidence
      expect(r.reply.toLowerCase()).toMatch(/don't have|doesn't have|belum/i);
    }
  });

  it("FOOD T2 pattern · 'What about tuna?' with k=0 → boundary applies", () => {
    const r = decideHonestBoundary({
      userMessage: "What about tuna?",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(true);
    if (r.applies) {
      expect(r.subject).toBe("tuna");
      // MUST NOT invent tuna dishes
      expect(r.reply.toLowerCase()).not.toContain("tuna sashimi");
      expect(r.reply.toLowerCase()).not.toContain("tuna steak");
      expect(r.reply.toLowerCase()).not.toContain("tuna salad");
    }
  });
});

// ─── Tests 2-5 · Grounded verticals still compose ───────────────────

describe("Tests 2-5 · Grounded verticals · boundary does NOT apply", () => {
  it("Test 2 · Grounded food · has knowledge → composition allowed", () => {
    const r = decideHonestBoundary({
      userMessage: "Tell me about babi guling",
      hasGroundedKnowledge: true,
    });
    expect(r.applies).toBe(false);
    if (!r.applies) expect(r.reason).toBe("has_grounded_knowledge");
  });

  it("Test 3 · Grounded hotel · has directory evidence → composition allowed", () => {
    // Even though the message pattern extracts a subject, presence of
    // grounded knowledge means we let the composer run normally.
    const r = decideHonestBoundary({
      userMessage: "Tell me about the Malioboro hotel",
      hasGroundedKnowledge: true,
    });
    expect(r.applies).toBe(false);
  });

  it("Test 4 · Grounded gym · has directory evidence → composition allowed", () => {
    const r = decideHonestBoundary({
      userMessage: "Tell me about 360 MOVE Gym",
      hasGroundedKnowledge: true,
    });
    expect(r.applies).toBe(false);
  });

  it("Test 5 · Grounded travel · has airport knowledge → composition allowed", () => {
    const r = decideHonestBoundary({
      userMessage: "Tell me about Denpasar airport",
      hasGroundedKnowledge: true,
    });
    expect(r.applies).toBe(false);
  });
});

// ─── Test 6 · Genuine unknown · honest boundary ─────────────────────

describe("Test 6 · Genuine unknown", () => {
  it("Unknown domain question · k=0 → boundary applies with honest reply", () => {
    const r = decideHonestBoundary({
      userMessage: "Tell me about quantum chromodynamics",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(true);
    if (r.applies) {
      expect(r.subject).toBe("quantum chromodynamics");
      expect(r.reply.toLowerCase()).toMatch(/don't have|doesn't have|belum/);
      // Must NOT invent physics facts
      expect(r.reply.toLowerCase()).not.toContain("quark");
      expect(r.reply.toLowerCase()).not.toContain("gluon");
      expect(r.reply.toLowerCase()).not.toContain("strong force");
    }
  });

  it("Indonesian unknown · yields Indonesian boundary", () => {
    const r = decideHonestBoundary({
      userMessage: "Apa itu quantum chromodynamics?",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(true);
    if (r.applies) {
      expect(r.language).toBe("id");
      expect(r.reply).toMatch(/belum/i);
    }
  });
});

// ─── Test 7 · Voice inheritance verified via reply shape ────────────

describe("Test 7 · Voice inheritance · boundary reply shape is voice-safe", () => {
  it("boundary reply is a natural sentence · usable as voice output", () => {
    const r = decideHonestBoundary({
      userMessage: "What about Japan?",
      hasGroundedKnowledge: false,
    });
    if (!r.applies) throw new Error("boundary should apply for FOOD T4 pattern");
    // Voice reply requirements: non-empty · ends with punctuation ·
    // reasonable length · no template placeholders leaked.
    expect(r.reply.length).toBeGreaterThan(20);
    expect(r.reply.length).toBeLessThan(500);
    expect(r.reply).not.toMatch(/\{|\}|\$\{/); // no template markers
    expect(r.reply.trim().endsWith("?") || r.reply.trim().endsWith(".") || r.reply.trim().endsWith("!")).toBe(true);
  });
});

// ─── Meta / Opinion questions must NOT be gated ─────────────────────

describe("Meta/opinion questions · gate does NOT trigger (avoid over-broad kill switch)", () => {
  it("'What do you think?' with k=0 → boundary does NOT apply (no subject)", () => {
    const r = decideHonestBoundary({
      userMessage: "What do you think?",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(false);
    if (!r.applies) expect(r.reason).toBe("no_extractable_subject");
  });

  it("'Why is this interesting?' with k=0 → boundary does NOT apply", () => {
    const r = decideHonestBoundary({
      userMessage: "Why is this interesting?",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(false);
  });

  it("'Hi' with k=0 → boundary does NOT apply", () => {
    const r = decideHonestBoundary({
      userMessage: "Hi",
      hasGroundedKnowledge: false,
    });
    expect(r.applies).toBe(false);
  });
});

// ─── Adversarial · gate cannot be bypassed by phrasing tricks ──────

describe("Adversarial · zero-evidence with subject → boundary text has no domain claims", () => {
  it("Boundary reply for 'What about Japan?' contains ZERO Japan-food claims", () => {
    const r = decideHonestBoundary({
      userMessage: "What about Japan?",
      hasGroundedKnowledge: false,
    });
    if (!r.applies) throw new Error("boundary should apply");
    const reply = r.reply.toLowerCase();
    // Adversarial checklist · none of these tokens may appear
    const forbidden = ["sushi", "sashimi", "ramen", "tempura", "wasabi", "miso", "udon", "soba", "wagyu", "kobe"];
    for (const term of forbidden) {
      expect(reply).not.toContain(term);
    }
  });

  it("Boundary reply for 'What about tuna?' contains ZERO tuna claims", () => {
    const r = decideHonestBoundary({
      userMessage: "What about tuna?",
      hasGroundedKnowledge: false,
    });
    if (!r.applies) throw new Error("boundary should apply");
    const reply = r.reply.toLowerCase();
    const forbidden = ["sashimi grade", "yellowfin", "bluefin", "toro", "canned", "smoked", "fresh caught"];
    for (const term of forbidden) {
      expect(reply).not.toContain(term);
    }
  });

  it("Fluent boundary text does not confuse itself for a factual answer", () => {
    const r = decideHonestBoundary({
      userMessage: "Tell me about the export market for shrimp",
      hasGroundedKnowledge: false,
    });
    if (!r.applies) throw new Error("boundary should apply");
    const reply = r.reply.toLowerCase();
    // Must mention "don't have" or equivalent · not fake export data
    expect(reply).toMatch(/don't have|doesn't have|belum/);
    expect(reply).not.toMatch(/\$\d|usd|cif|fob|moq/i);
  });
});

// ─── Generic fallback ───────────────────────────────────────────────

describe("buildGenericBoundaryReply · defensive fallback", () => {
  it("EN generic boundary contains 'don't have' or 'doesn't have'", () => {
    const reply = buildGenericBoundaryReply("en", "seed");
    expect(reply.toLowerCase()).toMatch(/don't have|doesn't have/);
  });

  it("ID generic boundary contains 'belum'", () => {
    const reply = buildGenericBoundaryReply("id", "seed");
    expect(reply.toLowerCase()).toContain("belum");
  });
});

// src/lib/nex/brain/interest/interest-intent.test.ts

import { describe, expect, it } from "vitest";
import { classifyInterestIntent } from "./interest-intent";

describe("interest-intent · positive claims", () => {
  it("'I'm interested' → INTEREST_TO_CONTACT", () => {
    const d = classifyInterestIntent("I'm interested");
    expect(d.kind).toBe("INTEREST_TO_CONTACT");
    expect(d.confidence).toBe("HIGH");
  });
  it("'I am interested in this one' → INTEREST_TO_CONTACT", () => {
    expect(classifyInterestIntent("I am interested in this one").kind).toBe("INTEREST_TO_CONTACT");
  });
  it("'I want to contact them' → INTEREST_TO_CONTACT", () => {
    expect(classifyInterestIntent("I want to contact them").kind).toBe("INTEREST_TO_CONTACT");
  });
  it("'I'd like to message them' → INTEREST_TO_CONTACT", () => {
    expect(classifyInterestIntent("I'd like to message them").kind).toBe("INTEREST_TO_CONTACT");
  });
  it("'can I talk to the owner?' → INTEREST_TO_CONTACT (question shape)", () => {
    expect(classifyInterestIntent("can I talk to the owner?").kind).toBe("INTEREST_TO_CONTACT");
  });
  it("'I'd like to ask them something' → INTEREST_TO_CONTACT", () => {
    expect(classifyInterestIntent("I'd like to ask them something").kind).toBe("INTEREST_TO_CONTACT");
  });
});

describe("interest-intent · Indonesian positive claims", () => {
  it("'saya tertarik' → INTEREST_TO_CONTACT · ID", () => {
    const d = classifyInterestIntent("saya tertarik");
    expect(d.kind).toBe("INTEREST_TO_CONTACT");
    expect(d.language).toBe("ID");
  });
  it("'saya ingin menghubungi mereka' → INTEREST_TO_CONTACT · ID", () => {
    const d = classifyInterestIntent("saya ingin menghubungi mereka");
    expect(d.kind).toBe("INTEREST_TO_CONTACT");
    expect(d.language).toBe("ID");
  });
  it("'bisa hubungi mereka?' → INTEREST_TO_CONTACT · ID", () => {
    const d = classifyInterestIntent("bisa hubungi mereka?");
    expect(d.kind).toBe("INTEREST_TO_CONTACT");
    expect(d.language).toBe("ID");
  });
});

describe("interest-intent · negation (G12 preserved)", () => {
  it("'I'm not interested' → INTEREST_EXPLICITLY_NEGATED", () => {
    expect(classifyInterestIntent("I'm not interested").kind).toBe("INTEREST_EXPLICITLY_NEGATED");
  });
  it("'not interested in the first one' → INTEREST_EXPLICITLY_NEGATED", () => {
    expect(classifyInterestIntent("not interested in the first one").kind).toBe("INTEREST_EXPLICITLY_NEGATED");
  });
  it("'I don't want to contact them' → INTEREST_EXPLICITLY_NEGATED", () => {
    expect(classifyInterestIntent("I don't want to contact them").kind).toBe("INTEREST_EXPLICITLY_NEGATED");
  });
  it("Indonesian 'saya tidak tertarik' → INTEREST_EXPLICITLY_NEGATED", () => {
    expect(classifyInterestIntent("saya tidak tertarik").kind).toBe("INTEREST_EXPLICITLY_NEGATED");
  });
  it("'no thanks I'm not interested' → INTEREST_EXPLICITLY_NEGATED", () => {
    expect(classifyInterestIntent("no thanks I'm not interested").kind).toBe("INTEREST_EXPLICITLY_NEGATED");
  });
});

describe("interest-intent · negatives (nothing to trigger)", () => {
  it("'hello' → NONE", () => {
    expect(classifyInterestIntent("hello").kind).toBe("NONE");
  });
  it("'find me hotels' → NONE", () => {
    expect(classifyInterestIntent("find me hotels").kind).toBe("NONE");
  });
  it("'tell me more about the first one' → NONE (that's ordinal · not interest)", () => {
    expect(classifyInterestIntent("tell me more about the first one").kind).toBe("NONE");
  });
  it("'does it have a pool?' → NONE (attribute question)", () => {
    expect(classifyInterestIntent("does it have a pool?").kind).toBe("NONE");
  });
  it("bare 'contact' → NONE (no target)", () => {
    expect(classifyInterestIntent("contact").kind).toBe("NONE");
  });
});

describe("interest-intent · adversarial", () => {
  it("'I'm interested in the second one, not the first' → still INTEREST_TO_CONTACT", () => {
    // The negation applies to "the first" not to "interested".
    // The interest lemma is not negated (nothing 3 tokens before it).
    const d = classifyInterestIntent("I'm interested in the second one, not the first");
    expect(d.kind).toBe("INTEREST_TO_CONTACT");
  });
  it("'contact the first one' → INTEREST_TO_CONTACT (imperative)", () => {
    const d = classifyInterestIntent("message them");
    expect(d.kind).toBe("INTEREST_TO_CONTACT");
  });
});

describe("interest-intent · language detection", () => {
  it("EN default", () => {
    expect(classifyInterestIntent("I'm interested").language).toBe("EN");
  });
  it("ID markers", () => {
    expect(classifyInterestIntent("saya ingin menghubungi mereka").language).toBe("ID");
  });
  it("MIXED", () => {
    expect(classifyInterestIntent("saya interested tapi").language).toBe("MIXED");
  });
});

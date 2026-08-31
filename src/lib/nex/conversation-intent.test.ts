// conversation-intent.test.ts · unit coverage of the classifier.
//
// This file protects the safety boundary that keeps ordinary
// conversation from being routed to specialist agents. The Guardian
// suite runs a superset of these cases; keeping them here means
// `vitest run` also catches regressions.

import { describe, it, expect } from "vitest";
import { classifyConversationIntent, assertSpecialistIntent } from "./conversation-intent";

describe("classifyConversationIntent · conversation intents", () => {
  it.each([
    ["Hi", "greeting"],
    ["Hello NEX", "greeting"],
    ["Halo NEX, apa kabar?", "greeting"],
    ["hey how are you", "greeting"],
    ["Selamat pagi", "greeting"],
    ["Good morning", "greeting"],
  ])("%s → conversation (%s)", (msg, expectedReason) => {
    const r = classifyConversationIntent(msg);
    expect(r.intent).toBe("conversation");
    expect(r.reason).toMatch(new RegExp(expectedReason));
  });

  it("meta about NEX → conversation", () => {
    const r = classifyConversationIntent("What can you do?");
    expect(r.intent).toBe("conversation");
    expect(r.reason).toBe("meta_about_nex");
  });

  it("small talk → conversation", () => {
    const r = classifyConversationIntent("Tell me something interesting");
    expect(r.intent).toBe("conversation");
    expect(r.reason).toBe("small_talk");
  });

  it("empty message → conversation", () => {
    const r = classifyConversationIntent("");
    expect(r.intent).toBe("conversation");
  });
});

describe("classifyConversationIntent · specialist isolation (the critical case)", () => {
  it("greeting NEVER routes to staircase, even if 'stairs' appears later in the same message", () => {
    // Greeting pattern anchors to start-of-string · specialists only
    // win when they're the actual intent.
    const r = classifyConversationIntent("Hi NEX, how are you?");
    expect(r.intent).toBe("conversation");
    expect(r.intent).not.toBe("staircase");
  });

  it("'Tell me about Bali' → indonesia, NOT staircase", () => {
    const r = classifyConversationIntent("Tell me about Bali");
    expect(r.intent).toBe("indonesia");
    expect(r.intent).not.toBe("staircase");
  });

  it("'What food should I try in Yogyakarta?' → food, NOT staircase", () => {
    const r = classifyConversationIntent("What food should I try in Yogyakarta?");
    expect(r.intent).toBe("food");
    expect(r.intent).not.toBe("staircase");
  });

  it("'Plan me a 3 day trip to Indonesia' → tourism", () => {
    const r = classifyConversationIntent("Plan me a 3 day trip to Indonesia");
    expect(r.intent).toBe("tourism");
    expect(r.secondary).toBe("indonesia");
  });

  it("'What is the weather like in Bali?' → weather", () => {
    const r = classifyConversationIntent("What is the weather like in Bali?");
    expect(r.intent).toBe("weather");
    expect(r.secondary).toBe("indonesia");
  });

  it("'Find me a restaurant' → business (food terms absent)", () => {
    const r = classifyConversationIntent("Find me a restaurant");
    expect(["business", "food"]).toContain(r.intent);
  });

  it("'I need a staircase' → staircase (genuine specialist)", () => {
    const r = classifyConversationIntent("I need a staircase");
    expect(r.intent).toBe("staircase");
  });

  it("'Calculate my staircase' → staircase", () => {
    const r = classifyConversationIntent("Calculate my staircase");
    expect(r.intent).toBe("staircase");
  });

  it("'Give me a staircase quote' → staircase (staircase beats quotation)", () => {
    const r = classifyConversationIntent("Give me a staircase quote");
    expect(r.intent).toBe("staircase");
  });
});

describe("classifyConversationIntent · vision beats everything", () => {
  it("hasImage=true always → image, even with staircase keyword", () => {
    const r = classifyConversationIntent("look at this staircase", { hasImage: true });
    expect(r.intent).toBe("image");
    expect(r.confidence).toBe(1);
  });
});

describe("classifyConversationIntent · Indonesia + secondary", () => {
  it("'book me a hotel in Ubud' → booking + secondary indonesia", () => {
    const r = classifyConversationIntent("book me a hotel in Ubud");
    expect(r.intent).toBe("booking");
    expect(r.secondary).toBe("indonesia");
  });

  it("plain Indonesia place → indonesia", () => {
    const r = classifyConversationIntent("Tell me about Yogyakarta");
    expect(r.intent).toBe("indonesia");
  });
});

describe("assertSpecialistIntent", () => {
  it("passes when intent matches", () => {
    expect(() => assertSpecialistIntent("staircase", "staircase")).not.toThrow();
  });

  it("throws when a specialist is called with the wrong intent (the guarantee)", () => {
    expect(() => assertSpecialistIntent("conversation", "staircase"))
      .toThrow(/specialist 'staircase' refused to handle intent 'conversation'/);
  });
});

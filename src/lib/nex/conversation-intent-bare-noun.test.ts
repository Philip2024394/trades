// src/lib/nex/conversation-intent-bare-noun.test.ts
//
// Stage 3.41.e · Bare-noun vocabulary regression tests.
//
// Positive tests · each new standalone signal establishes the
// correct vertical.
// Guard tests · ambiguous conversation MUST NOT suddenly get forced
// into an arbitrary vertical.

import { describe, expect, it } from "vitest";
import { classifyConversationIntent } from "./conversation-intent";

// ─── Positive · food · standalone meal-time nouns ──────────────

describe("3.41.e · food · bare meal-time nouns route to food", () => {
  it.each([
    "dinner",
    "lunch",
    "breakfast",
    "brunch",
    "Maybe dinner",           // the exact T3 utterance from the observation transcript
    "how about lunch",
    "want breakfast",
    "grab a meal",
    "let's eat",
    "want to eat",
  ])("EN '%s' → food", (msg) => {
    const r = classifyConversationIntent(msg, { userMarket: "ID" });
    expect(r.intent).toBe("food");
  });

  it.each([
    "makan malam",
    "makan siang",
    "makan pagi",
    "sarapan",
    "mau makan",
    "makan yuk",
  ])("ID '%s' → food", (msg) => {
    const r = classifyConversationIntent(msg, { userMarket: "ID" });
    expect(r.intent).toBe("food");
  });
});

// ─── Positive · commerce · bare product nouns ──────────────────

describe("3.41.e · commerce · bare product nouns route to commerce", () => {
  it.each([
    "jewellery",
    "jewelry",
    "find me some jewellery",   // exact T7 utterance from observation
    "some phones",
    "a laptop",
    "new shoes",
    "any bags",
    "the watches",
  ])("EN '%s' → commerce", (msg) => {
    const r = classifyConversationIntent(msg, { userMarket: "ID" });
    expect(r.intent).toBe("commerce");
  });

  it.each([
    "perhiasan",
    "cari kalung",
    "beli cincin",
    "mau gelang",
  ])("ID '%s' → commerce", (msg) => {
    const r = classifyConversationIntent(msg, { userMarket: "ID" });
    expect(r.intent).toBe("commerce");
  });
});

// ─── Guard · ambiguous conversation MUST NOT force a vertical ──

describe("3.41.e · guard · ambiguous conversation is NOT forced into a vertical", () => {
  it.each([
    "I'm bored tonight",
    "Something with my girlfriend",
    "hey",
    "hello",
    "how are you",
    "what's up",
    "I don't know what I want",
    "just chatting",
    "tell me a joke",
    "nothing much",
  ])("EN '%s' does NOT classify as any specific vertical", (msg) => {
    const r = classifyConversationIntent(msg, { userMarket: "ID" });
    expect(r.intent).not.toBe("food");
    expect(r.intent).not.toBe("commerce");
    expect(r.intent).not.toBe("accommodation");
    expect(r.intent).not.toBe("business");
  });

  it.each([
    "phone call",             // "phone" as noun in a non-shopping phrase (via bare word)
    "shoes are wet",          // "shoes" in a non-shopping sentence
    "bag of chips",           // "bag" in a non-shopping sentence
  ])("EN false-positive guard '%s' does NOT classify as commerce", (msg) => {
    const r = classifyConversationIntent(msg, { userMarket: "ID" });
    expect(r.intent).not.toBe("commerce");
  });
});

// ─── Regression · existing behaviour preserved ────────────────

describe("3.41.e · existing classifier behaviour unchanged", () => {
  it("'find me a hotel near Malioboro' still → accommodation", () => {
    const r = classifyConversationIntent("find me a hotel near Malioboro", { userMarket: "ID" });
    expect(r.intent).toBe("accommodation");
  });

  it("'nasi goreng' still → food", () => {
    const r = classifyConversationIntent("nasi goreng", { userMarket: "ID" });
    expect(r.intent).toBe("food");
  });

  it("'buy me headphones' still → commerce", () => {
    const r = classifyConversationIntent("buy me headphones", { userMarket: "ID" });
    expect(r.intent).toBe("commerce");
  });

  it("'weather in Yogyakarta' still → weather (or knowledge · not food/commerce)", () => {
    const r = classifyConversationIntent("weather in Yogyakarta", { userMarket: "ID" });
    expect(r.intent).not.toBe("food");
    expect(r.intent).not.toBe("commerce");
  });
});

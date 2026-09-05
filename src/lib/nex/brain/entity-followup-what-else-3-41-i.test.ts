// src/lib/nex/brain/entity-followup-what-else-3-41-i.test.ts
//
// Stage 3.41.i · Entity-followup "what else" vocabulary regression tests.
//
// Extends detectEntityFollowup to recognise alternative-asking phrasings.
// The detector marks INTENT · it does not decide what NEX says. Existing
// composer/reasoning layers stay responsible for honest answers.

import { describe, expect, it } from "vitest";
import { detectEntityFollowup } from "./entity-followup-detector";

// ─── Positive · EN "what else / anything else / other options" ─────

describe("3.41.i · EN 'what else' family matches", () => {
  it.each([
    "what else do they have",
    "what else do they have?",
    "What else do they have?",   // capitalised · the T6 utterance exactly
    "what else",
    "what else?",
    "what else can I get",
    "what else can I order",
    "what else can I try",
    "what else is there",
    "what else do you have",
    "what else do you know",
    "anything else",
    "anything else?",
    "anything more?",
    "got more",
    "got more?",
    "got any more",
    "any other options",
    "other options",
    "what other things do they have",
    "what other options",
    "what other choices",
  ])("EN '%s' → matched=true · language=en", (msg) => {
    const r = detectEntityFollowup(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe("en");
  });
});

// ─── Positive · ID "apa lagi / yang lain / pilihan lain" ───────────

describe("3.41.i · ID 'what else' family matches", () => {
  it.each([
    "apa lagi",
    "apa lagi?",
    "ada yang lain",
    "ada yang lain?",
    "ada lagi",
    "ada lagi?",
    "yang lain",
    "yang lainnya",
    "yang lain?",
    "pilihan lain",
    "pilihan lainnya",
    "pilihan lain?",
  ])("ID '%s' → matched=true · language=id", (msg) => {
    const r = detectEntityFollowup(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe("id");
  });
});

// ─── Guard · existing followup phrases still match ─────────────────

describe("3.41.i · existing followup phrasings still match (regression)", () => {
  it.each([
    ["what's good about it?",    "en"],
    ["what's good about that one?", "en"],
    ["tell me more",             "en"],
    ["tell me about it",         "en"],
    ["why this one?",            "en"],
    ["what about this one?",     "en"],
    ["more info",                "en"],
    ["kenapa yang ini?",         "id"],
    ["ceritakan lebih dong",     "id"],
    ["info lagi dong",           "id"],
  ] as const)("still matches '%s' as '%s'", (msg, lang) => {
    const r = detectEntityFollowup(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe(lang);
  });
});

// ─── Guard · unrelated sentences do NOT match ──────────────────────

describe("3.41.i · unrelated sentences MUST NOT match entity_followup", () => {
  it.each([
    "I'm bored",
    "hello",
    "hey what's up",
    "find me a hotel",
    "somewhere around Malioboro",
    "yes send it",
    "no thanks",
    "the second one",             // reference-only · NOT a followup question
    "message them",               // action · NOT a followup
    "what time is it",            // question but not about the current entity
    "what does jewellery mean",   // knowledge question
    "how does the app work",      // meta question
    "what should I do tonight",   // vague · not entity-scoped
    "cancel that",                // decline · not followup
  ])("'%s' does not match entity_followup", (msg) => {
    const r = detectEntityFollowup(msg);
    expect(r.matched).toBe(false);
  });
});

// ─── Guard · fail-closed at caller · empty message ────────────────

describe("3.41.i · empty / whitespace input never matches", () => {
  it.each(["", "   ", "\n\t"])("'%j' → matched=false", (msg) => {
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ─── Documented callsite contract ──────────────────────────────────
//
// The detector is intent-only. It DOES NOT know or care whether a
// currentReference exists. The caller (API route / observation
// harness) MUST combine `detection.matched && sessionHasCurrentReference`
// before treating the turn as entity_followup. If the session has no
// current reference, the message stays honestly unclassified · never
// answered from fabricated context.
//
// This test just documents the intent of the contract by showing
// that the detector fires the same way whether there's a reference
// or not (state is a caller concern).
describe("3.41.i · detector is state-free · caller composes with session", () => {
  it("'what else do they have?' matches regardless of external state", () => {
    const r = detectEntityFollowup("what else do they have?");
    expect(r.matched).toBe(true);
    expect(r.language).toBe("en");
  });
});

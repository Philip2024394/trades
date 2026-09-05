// src/lib/nex/brain/conversation-router.test.ts
//
// Stage 3.42 · Conversation Layer regression tests (Philip 2026-09-01).
//
// Load-bearing invariants:
//   1. Philip's exact failing transcripts now route to social_reply or
//      context_signal · NEVER clarify_ambiguous.
//   2. Existing hot brain signals (world_cards / reasoning / action)
//      still win · router steps aside.
//   3. Bare place-name misspellings (indonisea → indonesia, jogyakarta
//      → yogyakarta) resolve via fuzzy match.
//   4. Constitutional negative boundary preserved: existing detectors
//      (abandonment/refinement/entity-followup) unchanged.

import { describe, expect, it } from "vitest";
import { routeConversation, fuzzyPlaceMatch } from "./conversation-router";
import { extractPragmaticFeatures } from "./pragmatic-features";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { detectEntityFollowup } from "./entity-followup-detector";
import type { SessionState } from "./session";

// ─── Fixtures ────────────────────────────────────────────────────────

function emptySession(): SessionState {
  return {
    conversationId: "test",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function sessionAfterGreeting(): SessionState {
  return {
    ...emptySession(),
    dialogueTurns: [
      { role: "user", text: "hi",                              atIso: "2026-09-01T00:00:00Z" },
      { role: "nex",  text: "Hey — what are we doing?",        atIso: "2026-09-01T00:00:01Z" },
    ],
    lastNexQuestion: "Hey — what are we doing?",
  };
}

function sessionAfterContextAsk(): SessionState {
  return {
    ...emptySession(),
    dialogueTurns: [
      { role: "user", text: "hi",                                                       atIso: "2026-09-01T00:00:00Z" },
      { role: "nex",  text: "Hey — what are we doing?",                                 atIso: "2026-09-01T00:00:01Z" },
      { role: "user", text: "im good and you",                                          atIso: "2026-09-01T00:00:02Z" },
      { role: "nex",  text: "Good to hear. What are you in the mood to do today?",     atIso: "2026-09-01T00:00:03Z" },
    ],
    lastNexQuestion: "Good to hear. What are you in the mood to do today?",
  };
}

// ─── PART 1 · Philip's exact failing transcripts ─────────────────────

describe("Conversation Router · Philip's failing transcript", () => {
  it("'im good and you' after greeting → social_reply (NOT clarify_ambiguous)", () => {
    const session = sessionAfterGreeting();
    const route = routeConversation({
      message: "im good and you",
      pragmatic: extractPragmaticFeatures("im good and you"),
      session,
      brainHasHotSignals: false,
    });
    expect(route).not.toBeNull();
    // Either social_reply OR acknowledged_answer to the NEX greeting question · both are correct
    expect(["social_reply", "acknowledged_answer"]).toContain(route?.kind);
  });

  it("'indonisea' (misspelled) after context ask → context_signal or acknowledged_answer", () => {
    const session = sessionAfterContextAsk();
    const route = routeConversation({
      message: "indonisea",
      pragmatic: extractPragmaticFeatures("indonisea"),
      session,
      brainHasHotSignals: false,
    });
    expect(route).not.toBeNull();
    expect(["context_signal", "acknowledged_answer"]).toContain(route?.kind);
    // Must resolve the misspelling to "indonesia"
    const signalOrAnswer = route?.kind === "context_signal" ? route.signal
                         : route?.kind === "acknowledged_answer" ? route.answer
                         : "";
    expect(signalOrAnswer).toBe("indonesia");
  });

  it("'indonesia' (correct spelling) after greeting → context_signal or acknowledged_answer", () => {
    const session = sessionAfterGreeting();
    const route = routeConversation({
      message: "indonesia",
      pragmatic: extractPragmaticFeatures("indonesia"),
      session,
      brainHasHotSignals: false,
    });
    expect(route).not.toBeNull();
    expect(["context_signal", "acknowledged_answer"]).toContain(route?.kind);
  });
});

// ─── PART 2 · Fuzzy place matching ───────────────────────────────────

describe("fuzzyPlaceMatch · misspelling tolerance without vocab bloat", () => {
  it.each([
    ["indonesia",   "indonesia"],
    ["indonisea",   "indonesia"],
    ["indonisia",   "indonesia"],
    ["Indonesia",   "indonesia"],
    ["jogyakarta",  "yogyakarta"],
    ["yogyakarta",  "yogyakarta"],
    ["yogyakart",   "yogyakarta"],
    ["jakarta",     "jakarta"],
    ["jakrta",      "jakarta"],
    ["bali",        "bali"],
    ["Bali",        "bali"],
    ["jogja",       "jogja"],
    ["bandung",     "bandung"],
  ])("'%s' resolves to '%s'", (input, expected) => {
    expect(fuzzyPlaceMatch(input)).toBe(expected);
  });

  it.each([
    "hello",           // greeting · not a place
    "food",            // topic · not a place
    "z",               // too short
    "xyz",             // random noise
    "kali",            // must NOT collide with bali (Indonesian word for river)
    "ke",              // too short
  ])("'%s' does NOT match any place", (input) => {
    expect(fuzzyPlaceMatch(input)).toBeNull();
  });
});

// ─── PART 3 · Hot brain signals win · router steps aside ─────────────

describe("Router · hot brain signals cause router to step aside", () => {
  it("brainHasHotSignals=true → router returns null (existing selector handles)", () => {
    const route = routeConversation({
      message: "im good and you",
      pragmatic: extractPragmaticFeatures("im good and you"),
      session: sessionAfterGreeting(),
      brainHasHotSignals: true,
    });
    expect(route).toBeNull();
  });
});

// ─── PART 4 · Constitutional negative boundary preserved ─────────────

describe("Router · constitutional negative boundary", () => {
  const SAMPLES_TO_PROTECT = [
    "gak jadi beli",
    "lupakan",
    "cancel that",
    "batalkan pesanan",
    "yang lebih murah",
    "jangan yang boutique hotel, bintang 5 aja",
    "yang direct flight",
    "apa lagi?",
    "yang second one",
    "yang tadi",
    "the last one",
  ];

  it.each(SAMPLES_TO_PROTECT)("'%s' · running router does NOT change abandonment detector output", (msg) => {
    const before = detectAbandonment(msg).matched;
    routeConversation({
      message: msg,
      pragmatic: extractPragmaticFeatures(msg),
      session: emptySession(),
      brainHasHotSignals: false,
    });
    const after = detectAbandonment(msg).matched;
    expect(after).toBe(before);
  });

  it.each(SAMPLES_TO_PROTECT)("'%s' · running router does NOT change refinement detector output", (msg) => {
    const before = detectRefinement(msg).matched;
    routeConversation({
      message: msg,
      pragmatic: extractPragmaticFeatures(msg),
      session: emptySession(),
      brainHasHotSignals: false,
    });
    const after = detectRefinement(msg).matched;
    expect(after).toBe(before);
  });

  it.each(SAMPLES_TO_PROTECT)("'%s' · running router does NOT change entity-followup detector output", (msg) => {
    const before = detectEntityFollowup(msg).matched;
    routeConversation({
      message: msg,
      pragmatic: extractPragmaticFeatures(msg),
      session: emptySession(),
      brainHasHotSignals: false,
    });
    const after = detectEntityFollowup(msg).matched;
    expect(after).toBe(before);
  });
});

// ─── PART 5 · Social reply variations ────────────────────────────────

describe("Router · social_reply cases (NO active goal, acknowledgement pragmatic role)", () => {
  it.each([
    "im good",
    "not bad",
    "great thanks",
    "iya",
    "oke",
    "sip",
    "nice",
    "cool",
    "thanks",
    "makasih",
  ])("'%s' after greeting → social_reply or acknowledged_answer", (msg) => {
    const route = routeConversation({
      message: msg,
      pragmatic: extractPragmaticFeatures(msg),
      session: sessionAfterGreeting(),
      brainHasHotSignals: false,
    });
    expect(route).not.toBeNull();
    expect(["social_reply", "acknowledged_answer"]).toContain(route?.kind);
  });
});

// ─── PART 6 · Context signals · bare place names ─────────────────────

describe("Router · context_signal cases (bare place names, no prior question)", () => {
  it.each([
    "Yogyakarta",
    "Bali",
    "Jakarta",
    "Bandung",
  ])("'%s' bare place name → context_signal", (msg) => {
    const route = routeConversation({
      message: msg,
      pragmatic: extractPragmaticFeatures(msg),
      session: emptySession(),  // no prior question
      brainHasHotSignals: false,
    });
    expect(route).not.toBeNull();
    expect(route?.kind).toBe("context_signal");
  });
});

// ─── PART 7 · Router does NOT swallow domain messages ────────────────

describe("Router · leaves domain messages for existing pipeline", () => {
  it.each([
    "find me a hotel near Malioboro",
    "cari restoran dekat sini",
    "book that one",
    "message them",
    "yes send it",
    "what's good about it?",
    "compare griya sentana and gaotama hotel",
  ])("'%s' · router either returns null or delegates cleanly (never swallows)", (msg) => {
    // These messages have domain content · brainHasHotSignals=true simulates
    // the real path where the classifier picked up a vertical. Router MUST
    // step aside.
    const route = routeConversation({
      message: msg,
      pragmatic: extractPragmaticFeatures(msg),
      session: emptySession(),
      brainHasHotSignals: true,
    });
    expect(route).toBeNull();
  });
});

// src/lib/nex/brain/ordinal-anchor.test.ts
//
// P0.4 · Fresh-Conversation Ordinal Contamination Guard tests
// Philip 2026-09-05 · AUTHORIZE §7
//
// Covers all 8 required cases A-H plus adversarial coverage on the
// lexical-vs-reference distinction.

import { describe, it, expect } from "vitest";
import type { SessionState, SessionEntity } from "./session";
import {
  detectOrdinalReference,
  hasValidConversationalAnchor,
  decideOrdinalGate,
} from "./ordinal-anchor";

// ─── Helpers · minimal session shapes ────────────────────────────

const emptySession = (turnCount = 1): SessionState => ({
  conversationId: "test",
  turnCount,
  entities: [],
} as unknown as SessionState);

const sessionWithPresentedHotels = (): SessionState => {
  const entities: SessionEntity[] = [
    { id: "e1", kind: "business_name", raw: "Gaotama Hotel", canonical: "gaotama hotel", refId: "place:accommodation:#AC-2026-0000D", source: "nex_reply", atIso: "2026-09-05T00:00:00Z", presentedOffset: 1 } as unknown as SessionEntity,
    { id: "e2", kind: "business_name", raw: "Selaras Inn", canonical: "selaras inn", refId: "place:accommodation:#AC-2026-00010", source: "nex_reply", atIso: "2026-09-05T00:00:00Z", presentedOffset: 2 } as unknown as SessionEntity,
  ];
  return {
    conversationId: "test",
    turnCount: 2,
    entities,
  } as unknown as SessionState;
};

const sessionWithResolvedReference = (): SessionState => ({
  conversationId: "test",
  turnCount: 3,
  entities: [],
  currentReference: {
    resolved: true,
    resolvedInTurn: 2,
    business: { canonical: "gaotama hotel", raw: "Gaotama Hotel", refId: "place:accommodation:#AC-2026-0000D" },
  },
} as unknown as SessionState);

const sessionWithActiveGoal = (): SessionState => ({
  conversationId: "test",
  turnCount: 2,
  entities: [],
  goal: { kind: "accommodation", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, id: "g1", summary: "hotels" },
} as unknown as SessionState);

// ─── detectOrdinalReference ──────────────────────────────────────

describe("detectOrdinalReference · precise reference-vs-entity distinction", () => {
  it("matches 'the first hotel'", () => {
    const r = detectOrdinalReference("Tell me about the first hotel.");
    expect(r.matched).toBe(true);
    expect(r.kind).toBe("ordinal_the");
    expect(r.matched_phrase?.toLowerCase()).toContain("the first hotel");
    expect(r.category_noun).toBe("hotel");
  });

  it("matches 'the first one'", () => {
    const r = detectOrdinalReference("Tell me more about the first one.");
    expect(r.matched).toBe(true);
    expect(r.kind).toBe("ordinal_the");
    expect(r.category_noun).toBe("one");
  });

  it("matches 'the second one'", () => {
    const r = detectOrdinalReference("what about the second one?");
    expect(r.matched).toBe(true);
    expect(r.category_noun).toBe("one");
  });

  it("matches 'that hotel' (deictic)", () => {
    const r = detectOrdinalReference("what do you know about that hotel");
    expect(r.matched).toBe(true);
    expect(r.kind).toBe("deictic");
  });

  it("matches 'this one'", () => {
    const r = detectOrdinalReference("book this one for me");
    expect(r.matched).toBe(true);
    expect(r.kind).toBe("deictic");
  });

  it("matches 'the previous one' (special reference)", () => {
    const r = detectOrdinalReference("go back to the previous one");
    expect(r.matched).toBe(true);
    expect(r.kind).toBe("special");
  });

  it("matches 'which hotel'", () => {
    const r = detectOrdinalReference("which hotel would you choose?");
    expect(r.matched).toBe(true);
    expect(r.kind).toBe("which");
  });

  it("matches 'the first gym'", () => {
    const r = detectOrdinalReference("tell me about the first gym");
    expect(r.matched).toBe(true);
    expect(r.category_noun).toBe("gym");
  });

  it("matches 'the third restaurant'", () => {
    const r = detectOrdinalReference("show me the third restaurant");
    expect(r.matched).toBe(true);
    expect(r.category_noun).toBe("restaurant");
  });

  it("DOES NOT match 'First Living Hotel' — proper noun with word between ordinal and category", () => {
    const r = detectOrdinalReference("Find First Living Hotel in Yogyakarta");
    expect(r.matched).toBe(false);
  });

  it("DOES NOT match 'the First Living Hotel' — same reason", () => {
    const r = detectOrdinalReference("Please book the First Living Hotel");
    expect(r.matched).toBe(false);
  });

  it("DOES NOT match plain 'first class hotel' — 'class' between", () => {
    const r = detectOrdinalReference("looking for a first class hotel");
    expect(r.matched).toBe(false);
  });

  it("DOES NOT match 'hotel in Yogyakarta' — no ordinal", () => {
    const r = detectOrdinalReference("hotel in Yogyakarta");
    expect(r.matched).toBe(false);
  });

  it("DOES NOT match 'find me a hotel' — no ordinal", () => {
    const r = detectOrdinalReference("find me a hotel");
    expect(r.matched).toBe(false);
  });

  it("DOES NOT match 'the best hotel' — 'best' is not an ordinal", () => {
    const r = detectOrdinalReference("tell me about the best hotel");
    expect(r.matched).toBe(false);
  });
});

// ─── hasValidConversationalAnchor ───────────────────────────────

describe("hasValidConversationalAnchor · fresh vs anchored session", () => {
  it("fresh empty session → false", () => {
    expect(hasValidConversationalAnchor(emptySession())).toBe(false);
  });

  it("null session → false", () => {
    expect(hasValidConversationalAnchor(null)).toBe(false);
    expect(hasValidConversationalAnchor(undefined)).toBe(false);
  });

  it("session with presented business_name entities → true", () => {
    expect(hasValidConversationalAnchor(sessionWithPresentedHotels())).toBe(true);
  });

  it("session with resolved currentReference → true", () => {
    expect(hasValidConversationalAnchor(sessionWithResolvedReference())).toBe(true);
  });

  it("session with ONLY an accommodation goal (no entities, no ref) → false — goal alone is not a prior anchor because it can be created same-turn", () => {
    // This regression was observed live: accommodation composer creates
    // a goal in response to "Tell me about the first hotel" on turn 1 ·
    // treating that goal as an anchor would let the ordinal contamination
    // through. The refined check requires prior-presented entities OR
    // a resolved reference, both of which imply a prior turn actually
    // happened.
    expect(hasValidConversationalAnchor(sessionWithActiveGoal())).toBe(false);
  });

  it("session with 'conversation' goal → false", () => {
    const s = {
      conversationId: "test",
      turnCount: 2,
      entities: [],
      goal: { kind: "conversation", status: "active" },
    } as unknown as SessionState;
    expect(hasValidConversationalAnchor(s)).toBe(false);
  });

  it("session with entities AND a goal → true (entities are the anchor)", () => {
    const base = sessionWithPresentedHotels();
    const s = { ...base, goal: { kind: "accommodation", status: "active" } } as unknown as SessionState;
    expect(hasValidConversationalAnchor(s)).toBe(true);
  });
});

// ─── §7 Test A · Valid existing reference → gate DOES NOT fire ──

describe("§7-A · Valid existing reference → gate does NOT fire", () => {
  it("session has presented hotels · 'tell me about the first one' → shouldGate false", () => {
    const d = decideOrdinalGate({
      userMessage: "Tell me more about the first one.",
      session: sessionWithPresentedHotels(),
    });
    expect(d.shouldGate).toBe(false);
    if (!d.shouldGate) expect(d.reason).toBe("valid_anchor_present");
  });

  it("session has resolved reference · 'that hotel' → shouldGate false", () => {
    const d = decideOrdinalGate({
      userMessage: "what do you know about that hotel",
      session: sessionWithResolvedReference(),
    });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── §7 Test B · Fresh 'the first hotel' → gate FIRES ───────────

describe("§7-B · Fresh conversation · 'the first hotel' → gate FIRES", () => {
  it("empty session · 'Tell me about the first hotel.' → shouldGate true · boundary reply mentions hotel", () => {
    const d = decideOrdinalGate({
      userMessage: "Tell me about the first hotel.",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reason).toContain("ordinal_no_anchor");
      expect(d.boundary_reply.toLowerCase()).toContain("hotel");
      expect(d.boundary_reply.toLowerCase()).toMatch(/don't have|belum/);
      // MUST NOT name any specific hotel
      expect(d.boundary_reply.toLowerCase()).not.toContain("griya sentana");
      expect(d.boundary_reply.toLowerCase()).not.toContain("first living");
    }
  });

  it("null session · 'the first hotel' → shouldGate true", () => {
    const d = decideOrdinalGate({
      userMessage: "the first hotel please",
      session: null,
    });
    expect(d.shouldGate).toBe(true);
  });
});

// ─── §7 Test C · Fresh 'the first one' → gate FIRES ─────────────

describe("§7-C · Fresh conversation · 'the first one' → gate FIRES", () => {
  it("empty session · 'Tell me about the first one.' → shouldGate true", () => {
    const d = decideOrdinalGate({
      userMessage: "Tell me about the first one.",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.boundary_reply.toLowerCase()).toMatch(/which one|previous list/);
    }
  });
});

// ─── §7 Test D · Lexical contamination protection ───────────────

describe("§7-D · Lexical contamination · 'the first hotel' does NOT bind to 'First Living' by keyword", () => {
  it("fresh session · gate fires regardless of what real hotels the DB contains", () => {
    // The gate is a PRE-retrieval semantic check based on message + session.
    // It fires whether or not the DB contains hotels with 'first' in the name.
    const d = decideOrdinalGate({
      userMessage: "Tell me about the first hotel",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      // Boundary text must not fabricate names
      expect(d.boundary_reply.toLowerCase()).not.toContain("living");
      expect(d.boundary_reply.toLowerCase()).not.toContain("griya");
      expect(d.boundary_reply.toLowerCase()).not.toContain("gaotama");
    }
  });
});

// ─── §7 Test E · Explicit entity search remains valid ───────────

describe("§7-E · Explicit entity search · 'Find First Living Hotel' → gate does NOT fire", () => {
  it("proper-noun compound 'First Living Hotel' does not match ordinal pattern", () => {
    const d = decideOrdinalGate({
      userMessage: "Find First Living Hotel in Yogyakarta",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(false);
    if (!d.shouldGate) expect(d.reason).toBe("no_ordinal_pattern");
  });

  it("'the First Living Hotel' also does not match (word between)", () => {
    const d = decideOrdinalGate({
      userMessage: "please book the First Living Hotel",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(false);
  });

  it("generic search 'find me a hotel' → gate does NOT fire", () => {
    const d = decideOrdinalGate({
      userMessage: "find me a hotel near Malioboro",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── §7 Test F · Ordinal after real results → gate does NOT fire ─

describe("§7-F · Multi-turn · ordinal after presented results resolves correctly", () => {
  it("presented hotels session · 'second one' → gate does NOT fire", () => {
    const d = decideOrdinalGate({
      userMessage: "tell me about the second one",
      session: sessionWithPresentedHotels(),
    });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── Adversarial · gate does not mis-fire on common phrases ─────

describe("adversarial · gate does not mis-fire", () => {
  it("'best hotel' does not fire", () => {
    expect(decideOrdinalGate({ userMessage: "the best hotel in Yogyakarta", session: emptySession() }).shouldGate).toBe(false);
  });

  it("'nearest hotel' does not fire ('nearest' not an ordinal)", () => {
    expect(decideOrdinalGate({ userMessage: "the nearest hotel to Malioboro", session: emptySession() }).shouldGate).toBe(false);
  });

  it("'cheapest hotel' does not fire", () => {
    expect(decideOrdinalGate({ userMessage: "which is the cheapest hotel", session: emptySession() }).shouldGate).toBe(false);
  });

  it("'first class' does not fire (not ordinal reference)", () => {
    expect(decideOrdinalGate({ userMessage: "looking for a first class hotel", session: emptySession() }).shouldGate).toBe(false);
  });

  it("empty message does not throw", () => {
    expect(decideOrdinalGate({ userMessage: "", session: null }).shouldGate).toBe(false);
    expect(decideOrdinalGate({ userMessage: "   ", session: null }).shouldGate).toBe(false);
  });

  it("boundary reply is voice-safe (natural sentence, no template markers)", () => {
    const d = decideOrdinalGate({ userMessage: "tell me about the first hotel", session: emptySession() });
    if (!d.shouldGate) throw new Error("expected gate to fire");
    expect(d.boundary_reply).not.toMatch(/\{|\$\{|<|>/);
    expect(d.boundary_reply.length).toBeGreaterThan(20);
    expect(d.boundary_reply.length).toBeLessThan(400);
    expect(d.boundary_reply.trim().endsWith("?")).toBe(true); // ends with a question
  });
});

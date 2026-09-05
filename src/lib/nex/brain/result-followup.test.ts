// src/lib/nex/brain/result-followup.test.ts
//
// P0 Result-Follow-Up Provenance regression fix · SEMANTIC contract tests.
// Philip 2026-09-05 · AUTHORIZE · NEX LANGUAGE INTELLIGENCE FOUNDATION

import { describe, it, expect } from "vitest";
import type { SessionState, SessionEntity } from "./session";
import {
  detectResultFollowup,
  decideResultFollowupGate,
  extractPresentedEntities,
  inferDominantVertical,
  type ProvenanceState,
} from "./result-followup";

// ─── Helpers ─────────────────────────────────────────────────────

const emptySession = (): SessionState => ({
  conversationId: "test", turnCount: 1, entities: [],
} as unknown as SessionState);

const sessionWithHotels = (): SessionState => {
  const entities: SessionEntity[] = [
    { id: "e1", kind: "business_name", raw: "Gaotama Hotel", canonical: "gaotama hotel", refId: "place:accommodation:#AC-2026-0000D", source: "nex_reply", atIso: "2026-09-05T00:00:00Z", presentedOffset: 1 } as unknown as SessionEntity,
    { id: "e2", kind: "business_name", raw: "Selaras Inn", canonical: "selaras inn", refId: "place:accommodation:#AC-2026-00010", source: "nex_reply", atIso: "2026-09-05T00:00:00Z", presentedOffset: 2 } as unknown as SessionEntity,
  ];
  return { conversationId: "test", turnCount: 2, entities } as unknown as SessionState;
};

const sessionWithGyms = (): SessionState => {
  const entities: SessionEntity[] = [
    { id: "e1", kind: "business_name", raw: "360 MOVE Gym", canonical: "360 move gym", refId: "place:service:#SB-2026-10GX6", source: "nex_reply", atIso: "2026-09-05T00:00:00Z", presentedOffset: 1 } as unknown as SessionEntity,
  ];
  return { conversationId: "test", turnCount: 2, entities } as unknown as SessionState;
};

// ─── §8 · Semantic detection · all required surface forms ───────
//
// The gate must handle these through the semantic classifier — NOT
// via a phrase-specific rule per input. The unit-level guarantee is:
// each input parses to intent `result_provenance_followup`.

describe("§8 · detectResultFollowup · required semantic variants (semantic pathway)", () => {
  const required = [
    "where you find them",
    "where did you find these?",
    "where are these from?",
    "how did you find them?",
    "what source are these from?",
    "where did these come from?",
    "how did you find these?",
  ];
  for (const input of required) {
    it(`"${input}" → matched=true`, () => {
      const r = detectResultFollowup(input);
      expect(r.matched).toBe(true);
    });
  }
});

// ─── §9 · Location-vs-provenance distinction ────────────────────
//
// "where is the hotel?" must be LOCATION_REQUEST, not provenance.
// The classifier rules on stative verb + singular reference.

describe("§9 · location questions must NOT match provenance follow-up", () => {
  it("'where is the hotel?' → does not match", () => {
    expect(detectResultFollowup("where is the hotel?").matched).toBe(false);
  });
  it("'where is it located?' → does not match", () => {
    expect(detectResultFollowup("where is it located?").matched).toBe(false);
  });
  it("'where is this restaurant?' → does not match", () => {
    expect(detectResultFollowup("where is this restaurant?").matched).toBe(false);
  });
});

// ─── §11 · Ordinary hotel searches never match ──────────────────

describe("§11 · ordinary hotel searches must NOT match", () => {
  const ordinary = [
    "find me a hotel",
    "find me another hotel",
    "show me hotels near Malioboro",
    "find a hotel in Jakarta",
    "i am looking for hotel",
  ];
  for (const m of ordinary) {
    it(`"${m}" → does not match`, () => {
      expect(detectResultFollowup(m).matched).toBe(false);
    });
  }
});

// ─── SEMANTIC-NOT-PHRASE GUARANTEE ──────────────────────────────
//
// The whole point of this rewrite: novel surface forms that reuse
// the same feature vocabulary should classify correctly WITHOUT any
// new rule being added.

describe("semantic guarantee · novel surface forms handled without patching", () => {
  const novel = [
    "how did you retrieve them?",
    "where did you pull those from?",
    "where did you get these?",
    "how were these sourced?",
    "where do they come from?",
  ];
  for (const m of novel) {
    it(`"${m}" → matches without a phrase-specific rule`, () => {
      expect(detectResultFollowup(m).matched).toBe(true);
    });
  }
});

// ─── extractPresentedEntities / inferDominantVertical ───────────

describe("session inspection primitives", () => {
  it("empty session → []", () => {
    expect(extractPresentedEntities(emptySession())).toEqual([]);
  });
  it("null session → []", () => {
    expect(extractPresentedEntities(null)).toEqual([]);
  });
  it("hotel session → 2 entities", () => {
    expect(extractPresentedEntities(sessionWithHotels()).length).toBe(2);
  });
  it("hotel session → accommodation vertical", () => {
    expect(inferDominantVertical(extractPresentedEntities(sessionWithHotels()))).toBe("accommodation");
  });
  it("gym session → service vertical", () => {
    expect(inferDominantVertical(extractPresentedEntities(sessionWithGyms()))).toBe("service");
  });
  it("no entities → null vertical", () => {
    expect(inferDominantVertical([])).toBeNull();
  });
});

// ─── ANSWER-CONTRACT ENFORCEMENT ────────────────────────────────
//
// Only 4 provenance states are permitted: KNOWN_SOURCE ·
// LIMITED_SOURCE (reserved) · NO_SOURCE_INFORMATION · NO_ANCHOR.

describe("answer contract · provenance_state discipline", () => {
  it("anchored + accommodation vertical → KNOWN_SOURCE + source-only text (no capability language)", () => {
    const d = decideResultFollowupGate({
      userMessage: "where you find them",
      session: sessionWithHotels(),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      const state: ProvenanceState = d.provenance_state;
      expect(state).toBe("KNOWN_SOURCE");
      expect(d.provenance_from_evidence).toBe(true);
      // Provenance mentions SOURCE without conflating with CAPABILITY.
      expect(d.reply).toContain("NEX");
      expect(d.reply).toContain("OpenStreetMap");
      // §8 · SOURCE ≠ CAPABILITY. Booking is a separate dimension —
      // never mixed into the provenance reply.
      expect(d.reply.toLowerCase()).not.toContain("live booking");
      expect(d.reply.toLowerCase()).not.toContain("not live booking");
      // Internal table identifiers must not leak.
      expect(d.reply).not.toContain("nex.accommodation_business");
      expect(d.reply.toLowerCase()).not.toContain("nex.food_business");
      // Never re-emits list
      expect(d.reply.toLowerCase()).not.toContain("521 real listings");
      expect(d.reply.toLowerCase()).not.toContain("gaotama hotel");
    }
  });

  it("anchored + unknown vertical → NO_SOURCE_INFORMATION + honest reply", () => {
    const session: SessionState = {
      conversationId: "t", turnCount: 2,
      entities: [
        { id: "e1", kind: "business_name", raw: "Something", canonical: "something", refId: "unknown_shape_no_vertical", source: "nex_reply", atIso: "2026-09-05T00:00:00Z" } as unknown as SessionEntity,
      ],
    } as unknown as SessionState;
    const d = decideResultFollowupGate({ userMessage: "where you find them", session });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.provenance_state).toBe("NO_SOURCE_INFORMATION");
      expect(d.provenance_from_evidence).toBe(false);
    }
  });

  it("fresh conv (no anchor) → NO_ANCHOR + never invents topic", () => {
    const d = decideResultFollowupGate({
      userMessage: "where did you find them?",
      session: emptySession(),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.provenance_state).toBe("NO_ANCHOR");
      expect(d.provenance_from_evidence).toBe(false);
      expect(d.reply.toLowerCase()).toMatch(/haven't shown|belum menampilkan/);
      expect(d.reply.toLowerCase()).not.toContain("openstreetmap");
      expect(d.reply.toLowerCase()).not.toContain("previous discussion");
      expect(d.reply.toLowerCase()).not.toContain("indonesia");
    }
  });

  it("null session → NO_ANCHOR", () => {
    const d = decideResultFollowupGate({ userMessage: "where did these come from?", session: null });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) expect(d.provenance_state).toBe("NO_ANCHOR");
  });
});

// ─── FRESH-CONV FABRICATION PREVENTION · §5 §13 ─────────────────

describe("§5 §13 · fresh-conversation fabrication prevention", () => {
  const provocations = [
    "where did you find them?",
    "how were these sourced?",
    "what source are these from?",
    "where did these come from?",
  ];
  for (const m of provocations) {
    it(`"${m}" on fresh session → honest boundary · no fabricated context`, () => {
      const d = decideResultFollowupGate({ userMessage: m, session: emptySession() });
      expect(d.shouldGate).toBe(true);
      if (d.shouldGate) {
        expect(d.provenance_state).toBe("NO_ANCHOR");
        // Assert no manufacturing.
        expect(d.reply.toLowerCase()).not.toContain("previous discussion");
        expect(d.reply.toLowerCase()).not.toContain("previous hotel");
        expect(d.reply.toLowerCase()).not.toContain("previous search");
        expect(d.reply.toLowerCase()).not.toContain("indonesia");
        expect(d.reply.toLowerCase()).not.toContain("yogyakarta");
      }
    });
  }
});

// ─── VERTICAL VARIATION · service vs accommodation ──────────────

describe("provenance varies by vertical", () => {
  it("gym (service) session → service provenance text", () => {
    const d = decideResultFollowupGate({ userMessage: "where you find them", session: sessionWithGyms() });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.inferred_vertical).toBe("service");
      expect(d.provenance_state).toBe("KNOWN_SOURCE");
      expect(d.reply).toContain("service");
    }
  });
});

// ─── Voice-safe reply shape ─────────────────────────────────────

describe("reply shape · voice-safe", () => {
  it("non-empty · ends with punctuation · no template markers", () => {
    const d = decideResultFollowupGate({ userMessage: "where you find them", session: sessionWithHotels() });
    if (!d.shouldGate) throw new Error("expected gate");
    expect(d.reply.length).toBeGreaterThan(20);
    expect(d.reply).not.toMatch(/\{|\}|\$\{/);
    const last = d.reply.trim().slice(-1);
    expect([".", "?", "!"]).toContain(last);
  });
});

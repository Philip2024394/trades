// src/lib/nex/brain/conversational-continuation-slice.test.ts
//
// NEX Conversational Continuation Slice · unit tests
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · D3 + D4
//
// D3 · Quantity continuation with active result set
// D4 · Vertical / topic switch when current-turn domain differs
//
// The AUTHORIZE forbids phrase-list patches; these tests exercise the
// SEMANTIC pathways only (detectQuantity's INCREMENTAL constraint +
// analyzeScope's TOPIC_SHIFT transition + mapDomainNounToVertical).
// A test that only checks "message.includes('one more')" would be
// checking the wrong thing — every assertion here checks the semantic
// state that the gates emit and consume.

import { describe, expect, it } from "vitest";
import { decideQuantityGate } from "./quantity-intelligence";
import { analyzeScope, decideFrameScopeGate, mapDomainNounToVertical } from "./frame-scope-intelligence";
import type { SessionState } from "./session";

// ═════════════════════════════════════════════════════════════
// D3 · QUANTITY CONTINUATION
// ═════════════════════════════════════════════════════════════

// ─── A · INCREMENTAL + active result set → positive continuation ─

describe("D3 · quantity gate · INCREMENTAL + active result set", () => {
  const entities = [
    { raw: "Gaotama Hotel",           presentedOffset: 1, refId: "place:accommodation:#AC-2026-0000D" },
    { raw: "Selaras Inn",             presentedOffset: 2, refId: "place:accommodation:#AC-2026-0000E" },
    { raw: "Indonesia Hotel",         presentedOffset: 3, refId: "place:accommodation:#AC-2026-0000F" },
    { raw: "Griya Sentana",           presentedOffset: 4, refId: "place:accommodation:#AC-2026-0000G" },
    { raw: "Hotel Trim Tiga",         presentedOffset: 5, refId: "place:accommodation:#AC-2026-0000H" },
  ];

  it("'one more' with 5 entities + 3 visibly shown → names entity #4", () => {
    const d = decideQuantityGate({
      userMessage: "one more",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reason.startsWith("incremental_continuation")).toBe(true);
      expect(d.reply).toContain("Griya Sentana");
      // NOT Gaotama (already shown)
      expect(d.reply).not.toContain("Gaotama Hotel");
    }
  });

  it("'two more' → names entities #4 and #5", () => {
    const d = decideQuantityGate({
      userMessage: "two more",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reply).toContain("Griya Sentana");
      expect(d.reply).toContain("Hotel Trim Tiga");
    }
  });

  it("'another one' → same as 'one more'", () => {
    const d = decideQuantityGate({
      userMessage: "another one",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reply).toContain("Griya Sentana");
    }
  });

  it("Indonesian '2 lagi' → INCREMENTAL delta=2", () => {
    const d = decideQuantityGate({
      userMessage: "2 lagi",
      hasActiveResultSet: true,
      activeLanguage: "ID",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      // ID reply
      expect(d.reply).toContain("Berikut");
      expect(d.reply).toContain("Griya Sentana");
      expect(d.reply).toContain("Hotel Trim Tiga");
    }
  });
});

// ─── B · INCREMENTAL + active result set exhausted → honest boundary ─

describe("D3 · quantity gate · INCREMENTAL when active set is exhausted", () => {
  it("all 3 already shown → honest 'that's everything' reply", () => {
    const entities = [
      { raw: "Gaotama Hotel",   presentedOffset: 1, refId: "id1" },
      { raw: "Selaras Inn",     presentedOffset: 2, refId: "id2" },
      { raw: "Indonesia Hotel", presentedOffset: 3, refId: "id3" },
    ];
    const d = decideQuantityGate({
      userMessage: "one more",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reason).toBe("incremental_exhausted");
      expect(d.reply.toLowerCase()).toMatch(/that's everything|widen the search/);
      // Must NEVER re-emit hotel names as "more"
      expect(d.reply).not.toContain("Gaotama Hotel");
    }
  });
});

// ─── C · INCREMENTAL + fresh conv → defensive clarification (unchanged) ─

describe("D3 · quantity gate · defensive fresh-conv still works", () => {
  it("'one more' with no active result set → clarification", () => {
    const d = decideQuantityGate({
      userMessage: "one more",
      hasActiveResultSet: false,
      activeLanguage: "EN",
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reason).toBe("incremental_without_result_set");
      expect(d.reply.toLowerCase()).toMatch(/haven't shown|more of what/);
    }
  });
});

// ─── D · INCREMENTAL + active set BUT topic-shift → defer ────────

describe("D3 · quantity gate · defers to topic-shift", () => {
  it("'one more' with deferToTopicShift=true → does NOT fire", () => {
    const entities = [
      { raw: "Gaotama Hotel",   presentedOffset: 1, refId: "id1" },
      { raw: "Selaras Inn",     presentedOffset: 2, refId: "id2" },
      { raw: "Indonesia Hotel", presentedOffset: 3, refId: "id3" },
      { raw: "Griya Sentana",   presentedOffset: 4, refId: "id4" },
    ];
    const d = decideQuantityGate({
      userMessage: "I need one more restaurant",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
      deferToTopicShift: true,
    });
    // Positive gate MUST NOT fire · frame-scope will handle the shift
    expect(d.shouldGate).toBe(false);
    if (!d.shouldGate) {
      expect(d.reason.startsWith("no_gate_needed")).toBe(true);
    }
  });
});

// ─── E · Non-INCREMENTAL constraints unchanged ─────────────────

describe("D3 · non-INCREMENTAL constraints pass through", () => {
  it("'find me two hotels' (EXACT) does not fire positive continuation", () => {
    const entities = [
      { raw: "Gaotama Hotel",   presentedOffset: 1, refId: "id1" },
      { raw: "Selaras Inn",     presentedOffset: 2, refId: "id2" },
      { raw: "Indonesia Hotel", presentedOffset: 3, refId: "id3" },
      { raw: "Griya Sentana",   presentedOffset: 4, refId: "id4" },
    ];
    const d = decideQuantityGate({
      userMessage: "find me two hotels",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      activeResultSetEntities: entities,
      visibleShownCount: 3,
    });
    // EXACT with active set does NOT force continuation
    expect(d.shouldGate).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// D4 · VERTICAL / TOPIC SWITCH
// ═════════════════════════════════════════════════════════════

function sessionWithHotels(): SessionState {
  return {
    conversationId: "cid",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turnCount: 1,
    entities: [
      { id: "b1", kind: "business_name", canonical: "gaotama hotel", raw: "Gaotama Hotel",
        source: "nex_reply", atIso: new Date().toISOString(), refId: "place:accommodation:#AC-2026-0000D",
        presentedOffset: 1 },
      { id: "b2", kind: "business_name", canonical: "selaras inn", raw: "Selaras Inn",
        source: "nex_reply", atIso: new Date().toISOString(), refId: "place:accommodation:#AC-2026-0000E",
        presentedOffset: 2 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  } as unknown as SessionState;
}

// ─── F · mapDomainNounToVertical works semantically ─────────────

describe("D4 · mapDomainNounToVertical · vocabulary equivalence", () => {
  it("hotels / villas / penginapan → accommodation", () => {
    expect(mapDomainNounToVertical("hotel")).toBe("accommodation");
    expect(mapDomainNounToVertical("hotels")).toBe("accommodation");
    expect(mapDomainNounToVertical("villa")).toBe("accommodation");
    expect(mapDomainNounToVertical("penginapan")).toBe("accommodation");
  });
  it("restaurant / restoran / cafe → food", () => {
    expect(mapDomainNounToVertical("restaurant")).toBe("food");
    expect(mapDomainNounToVertical("restaurants")).toBe("food");
    expect(mapDomainNounToVertical("restoran")).toBe("food");
    expect(mapDomainNounToVertical("cafe")).toBe("food");
  });
  it("phone / laptop / car → commerce", () => {
    expect(mapDomainNounToVertical("phone")).toBe("commerce");
    expect(mapDomainNounToVertical("laptop")).toBe("commerce");
    expect(mapDomainNounToVertical("car")).toBe("commerce");
  });
  it("flight → transport", () => {
    expect(mapDomainNounToVertical("flight")).toBe("transport");
    expect(mapDomainNounToVertical("flights")).toBe("transport");
  });
  it("null / unknown → null", () => {
    expect(mapDomainNounToVertical(null)).toBe(null);
    expect(mapDomainNounToVertical("undefined_noun")).toBe(null);
  });
});

// ─── G · analyzeScope · explicit topic shift with "actually" ─────

describe("D4 · analyzeScope · explicit topic-shift marker + new vertical", () => {
  it("'actually, I need a restaurant' after hotels → TOPIC_SHIFT with vertical mismatch", () => {
    const a = analyzeScope({ message: "actually, I need a restaurant", session: sessionWithHotels() });
    expect(a.transition).toBe("TOPIC_SHIFT");
    expect(a.active_domain_hint).toBe("restaurant");
    expect(a.prior_domain_hint).toBe("accommodation");
    expect(a.topic_shift_marker).toBe("actually");
  });
});

// ─── H · analyzeScope · IMPLICIT topic shift (no "actually") ────

describe("D4 · analyzeScope · implicit topic-shift via different-vertical domain noun", () => {
  it("'I need a restaurant' (no 'actually') after hotels → still TOPIC_SHIFT", () => {
    const a = analyzeScope({ message: "I need a restaurant", session: sessionWithHotels() });
    expect(a.transition).toBe("TOPIC_SHIFT");
    expect(a.active_domain_hint).toBe("restaurant");
    expect(a.reason.startsWith("implicit_topic_shift")).toBe(true);
  });
});

// ─── I · analyzeScope · SAME-vertical noun does NOT trigger shift ─

describe("D4 · analyzeScope · same-vertical noun stays in frame", () => {
  it("'I need another hotel' after hotels → NOT TOPIC_SHIFT", () => {
    const a = analyzeScope({ message: "I need another hotel", session: sessionWithHotels() });
    expect(a.transition).not.toBe("TOPIC_SHIFT");
  });
});

// ─── J · decideFrameScopeGate · positive topic-shift fires ────

describe("D4 · frame-scope gate · positive topic-shift with vertical switch", () => {
  it("'actually, I need a restaurant' after hotels → GATE + vertical_switch_target=food", () => {
    const d = decideFrameScopeGate({
      userMessage: "actually, I need a restaurant",
      session: sessionWithHotels(),
      activeLanguage: "EN",
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reason.startsWith("topic_shift_vertical_switch")).toBe(true);
      expect(d.vertical_switch_target).toBe("food");
      expect(d.reply.toLowerCase()).toMatch(/switching to restaurants|switching to food/);
    }
  });

  it("Indonesian: 'sebenarnya saya perlu restoran' → gate fires in ID", () => {
    const d = decideFrameScopeGate({
      userMessage: "sebenarnya saya perlu restoran",
      session: sessionWithHotels(),
      activeLanguage: "ID",
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.vertical_switch_target).toBe("food");
      expect(d.reply.toLowerCase()).toContain("restoran");
    }
  });

  it("same-vertical continuation 'find another hotel' → does NOT gate", () => {
    const d = decideFrameScopeGate({
      userMessage: "find another hotel",
      session: sessionWithHotels(),
      activeLanguage: "EN",
    });
    // Fresh accommodation search on top of accommodation is not a shift
    expect(d.shouldGate).toBe(false);
  });
});

// ─── K · Fresh conversation → no fabricated context ──────────

describe("D4 · fresh conversation with topic-shift marker", () => {
  it("'actually, I need a restaurant' with NO prior session → no gate, no fabrication", () => {
    const d = decideFrameScopeGate({
      userMessage: "actually, I need a restaurant",
      session: null,
      activeLanguage: "EN",
    });
    // No active result set → nothing to shift from
    expect(d.shouldGate).toBe(false);
  });
});

// ─── L · Preservation · empty activeResultSetEntities → no positive gate ─

describe("D3 preservation · empty active entities → no positive gate", () => {
  it("no activeResultSetEntities → positive continuation does NOT fire even with hasActiveResultSet", () => {
    const d = decideQuantityGate({
      userMessage: "one more",
      hasActiveResultSet: true,
      activeLanguage: "EN",
      // Intentionally no activeResultSetEntities
    });
    // Without entities, we cannot name any continuation entity honestly.
    // The gate falls through and lets other pipeline paths respond.
    expect(d.shouldGate).toBe(false);
    if (!d.shouldGate) {
      expect(d.reason).toBe("no_gate_needed:INCREMENTAL");
    }
  });
});

// src/lib/nex/brain/abandonment-3-41-k-landing-1.test.ts
//
// Stage 3.41.k Landing #1 · Abandonment detector + orchestrator gate.
//
// Constitutional invariant (Philip 2026-08-31):
//   abandonment > vertical keywords > sticky-vertical > entity reference
//
// Guarantees exercised here:
//   1. Detector matches the abandonment family (EN + ID) with fail-closed
//      guards on "don't forget X" / "jangan lupakan" / "gak jadi masalah".
//   2. `applyAbandonmentReset` clears currentReference, prunes
//      business_name entities, marks goal.status = "abandoned".
//   3. Orchestrator gate short-circuits BEFORE vertical keyword routing:
//      "forget dinner" does NOT trigger food discovery on this turn,
//      even though "dinner" is a food keyword.
//   4. Guards still hold: "don't forget dinner" continues normally.

import { describe, expect, it, beforeEach } from "vitest";
import { detectAbandonment } from "./abandonment-detector";
import {
  applyAbandonmentReset,
  upsertSession,
  getSession,
  _resetSessionsForTests,
  type SessionState,
} from "./session";
import { orchestrateChatTurnLive } from "./orchestrate";

// ─── 1 · Detector positives · EN ─────────────────────────────────────

describe("3.41.k#1 · EN abandonment · positive matches", () => {
  it.each([
    "forget it",
    "forget that",
    "Forget dinner.",
    "forget dinner",
    "forget lunch",
    "forget the hotel",
    "forget the restaurant",
    "forget the search",
    "forget about it",
    "forget about dinner",
    "nevermind",
    "never mind",
    "nvm",
    "cancel that",
    "cancel it",
    "cancel the search",
    "drop it",
    "drop that",
    "drop the search",
    "scratch that",
    "not looking for a hotel anymore",
    "not searching for hotels anymore",
    "stop the search",
    "stop searching",
    "stop looking",
    "stop",
    // "actually" / "hold on" / "wait" prefixed reversals
    "actually forget that",
    "actually forget dinner",
    "actually forget it",
    "actually cancel that",
    "hold on cancel that",
    "wait no forget it",
    "wait forget that",
    "no wait scratch that",
    "hmm actually forget dinner",
    // Skip + change-mind family
    "skip that",
    "skip it",
    "skip this",
    "change my mind",
    "changed my mind",
    "changing my mind",
    "I changed my mind",
    // "let's move on / let's skip this" — collective walk-away
    "let's move on",
    "lets move on",
    "let's skip this",
    "let's skip that",
    "lets skip it",
  ])("EN '%s' → matched=true · language=en", (msg) => {
    const r = detectAbandonment(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe("en");
  });
});

// ─── 2 · Detector positives · ID ─────────────────────────────────────

describe("3.41.k#1 · ID abandonment · positive matches", () => {
  it.each([
    "lupakan",
    "lupakan aja",
    "lupain",
    "lupain aja deh",
    "gak jadi",
    "nggak jadi",
    "ga jadi",
    "ngga jadi",
    "tidak jadi",
    "udah gak jadi",
    "udah nggak jadi",
    "batal",
    "batalkan",
    "batalin",
    "udahin aja",
    "udahi dulu",
    "stop dulu",
    "cancel aja",
    "gak usah",
    "nggak usah deh",
    // Contracted / postpone
    "gajadi",
    "skip dulu",
    "tunda dulu",
  ])("ID '%s' → matched=true · language=id", (msg) => {
    const r = detectAbandonment(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe("id");
  });
});

// ─── 3 · Guards · MUST NOT match ─────────────────────────────────────

describe("3.41.k#1 · guards · abandonment does NOT fire on non-abandonment", () => {
  it.each([
    // Negations · reminders · not abandonments
    "don't forget dinner",
    "do not forget the hotel",
    "jangan lupakan aku",
    "jangan lupain kado",
    // "gak jadi X" idioms that DON'T mean abandonment
    "gak jadi masalah",
    "nggak jadi masalah",
    "gak jadi apa-apa",
    "tidak jadi soal",
    // "gak usah" idioms that DON'T mean abandonment
    "gak usah pusing",
    "nggak usah khawatir",
    "tidak usah takut",
    "gak usah malu",
    // Unrelated
    "hello",
    "find me a hotel",
    "cari makan malam",
    "yang lain bagus",
    "the second one",
    "message them",
    "what's good about it?",
    "I'll never forget you",     // "forget" mid-sentence · not command
    "I stopped by the shop",     // "stop" not a command
    "let me think about it",     // "about it" not abandonment
    "",
    "   ",
  ])("'%s' does not match abandonment", (msg) => {
    const r = detectAbandonment(msg);
    expect(r.matched).toBe(false);
  });
});

// ─── 4 · Session helper · applyAbandonmentReset ──────────────────────

describe("3.41.k#1 · applyAbandonmentReset · state discipline", () => {
  it("clears currentReference and prunes business_name entities", () => {
    const prior: SessionState = {
      conversationId: "c1",
      createdAt: 0,
      updatedAt: 0,
      turnCount: 4,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentReference: { resolved: true } as any,
      entities: [
        { id: "business_name:gaotama", kind: "business_name", canonical: "gaotama hotel", raw: "Gaotama Hotel", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 },
        { id: "business_name:griya",   kind: "business_name", canonical: "griya sentana", raw: "Griya Sentana", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 2 },
        { id: "date_ref:tonight",      kind: "date_ref",      canonical: "tonight",       raw: "tonight",       source: "user_message", atIso: "2026-08-31T00:00:00Z" },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goal: { id: "g1", kind: "food", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, summary: "food search" } as any,
    };
    const next = applyAbandonmentReset(prior);
    expect(next.currentReference).toBeUndefined();
    expect(next.entities?.some((e) => e.kind === "business_name")).toBe(false);
    expect(next.entities?.some((e) => e.kind === "date_ref")).toBe(true);
    expect(next.goal?.status).toBe("abandoned");
    expect(next.turnCount).toBe(4); // preserved
  });

  it("does not mutate the input SessionState", () => {
    const prior: SessionState = {
      conversationId: "c1",
      createdAt: 0,
      updatedAt: 0,
      turnCount: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentReference: { resolved: true } as any,
      entities: [{ id: "business_name:x", kind: "business_name", canonical: "x", raw: "X", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const before = JSON.stringify(prior);
    applyAbandonmentReset(prior);
    expect(JSON.stringify(prior)).toBe(before);
  });

  it("handles missing goal cleanly", () => {
    const prior: SessionState = {
      conversationId: "c2",
      createdAt: 0,
      updatedAt: 0,
      turnCount: 1,
      entities: [],
    };
    const next = applyAbandonmentReset(prior);
    expect(next.goal).toBeUndefined();
    expect(next.currentReference).toBeUndefined();
  });
});

// ─── 5 · Orchestrator gate · abandonment beats vertical keywords ────

describe("3.41.k#1 · orchestrator · abandonment gate wins over vertical keywords", () => {
  beforeEach(() => {
    _resetSessionsForTests();
  });

  it("'forget dinner' does NOT trigger food discovery on this turn", async () => {
    const conversationId = "abandon-forget-dinner";
    // Seed a live food session with a resolved reference and food entities
    upsertSession({
      conversationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turnCount: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentReference: { resolved: true, business: { canonical: "gudeg wijilan" }, resolvedInTurn: 3 } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goal: { id: "g", kind: "food", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, summary: "food search" } as any,
      entities: [{ id: "business_name:gudeg", kind: "business_name", canonical: "gudeg wijilan", raw: "Gudeg Wijilan", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 }],
    });

    const reply = await orchestrateChatTurnLive("forget dinner", {
      conversationId,
      useLiveWorld: true,
      userMarket: "ID",
    });

    expect(reply.intent).toBe("abandonment");
    expect(reply.reply).toMatch(/dropped it|batalin/i);
    // NEX did NOT rediscover — no food vertical fired
    expect(reply.world_query?.vertical).toBeUndefined();
    expect(reply.card).toBeUndefined();

    // Session state has been cleared
    const after = getSession(conversationId);
    expect(after?.currentReference).toBeUndefined();
    expect(after?.entities?.some((e) => e.kind === "business_name")).toBe(false);
    expect(after?.goal?.status).toBe("abandoned");
  });

  it("'lupakan' clears state + returns ID acknowledgement", async () => {
    const conversationId = "abandon-lupakan";
    upsertSession({
      conversationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turnCount: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentReference: { resolved: true, business: { canonical: "hotel x" }, resolvedInTurn: 2 } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goal: { id: "g", kind: "accommodation", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, summary: "hotel search" } as any,
      entities: [{ id: "business_name:hotelx", kind: "business_name", canonical: "hotel x", raw: "Hotel X", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 1 }],
    });

    const reply = await orchestrateChatTurnLive("lupakan", {
      conversationId,
      useLiveWorld: true,
      userMarket: "ID",
    });

    expect(reply.intent).toBe("abandonment");
    expect(reply.reply).toBe("Sip, aku batalin.");
    expect(reply.world_query?.vertical).toBeUndefined();

    const after = getSession(conversationId);
    expect(after?.currentReference).toBeUndefined();
    expect(after?.goal?.status).toBe("abandoned");
  });

  it("'don't forget dinner' does NOT abandon — passes through normally", async () => {
    const conversationId = "guard-dont-forget";
    upsertSession({
      conversationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turnCount: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goal: { id: "g", kind: "food", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, summary: "food search" } as any,
    });
    const reply = await orchestrateChatTurnLive("don't forget dinner", {
      conversationId,
      useLiveWorld: true,
      userMarket: "ID",
    });
    // Not an abandonment reply
    expect(reply.intent).not.toBe("abandonment");
    // Goal must not have been flipped to abandoned by the gate
    const after = getSession(conversationId);
    expect(after?.goal?.status).not.toBe("abandoned");
  });

  it("'gak jadi masalah' does NOT abandon (idiom guard)", async () => {
    const conversationId = "guard-gakjadi-masalah";
    upsertSession({
      conversationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turnCount: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goal: { id: "g", kind: "accommodation", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, summary: "hotel search" } as any,
    });
    const reply = await orchestrateChatTurnLive("gak jadi masalah", {
      conversationId,
      useLiveWorld: true,
      userMarket: "ID",
    });
    expect(reply.intent).not.toBe("abandonment");
    const after = getSession(conversationId);
    expect(after?.goal?.status).not.toBe("abandoned");
  });
});

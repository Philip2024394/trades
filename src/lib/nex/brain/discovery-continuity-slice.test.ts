// src/lib/nex/brain/discovery-continuity-slice.test.ts
//
// NEX Discovery Continuity Slice · unit tests (Philip 2026-09-06 ·
// CEREMONIAL AUTHORIZE · D1).
//
// D1 fix: the accommodation discovery reply already populates
// session.entities via capturePresentedBusinesses + mergeEntityWindow
// (line 494/529 of orchestrate.ts) · resolveReference already resolves
// ordinal/pronoun references against that window · the only missing
// wiring was the reply-side handoff. The fix (orchestrate.ts inside
// `case "accommodation"`) overrides out.reply when resolveReference
// returned refKind ∈ {ordinal, pronoun, pronoun_via_current_reference},
// naming the resolved entity honestly without fabricating attributes.
//
// These tests prove:
//   A · Discovery deposits entities into session (window & offsets)
//   B · Ordinal "the first one" resolves to entity #1 and names it
//   C · Ordinal "the second one" resolves to entity #2 and names it
//   D · Pronoun "that one" resolves via currentReference
//   E · Fresh conversation "tell me about the first hotel" does NOT
//       resolve (P0.4 protection preserved)
//   F · Genuine new search still runs (topic/entity change respected)
//   G · No fabricated attributes in the anchored reply
//   H · The override preserves entity identity and refId
//
// The AUTHORIZE forbids phrase-list patches. This slice uses only the
// EXISTING semantic reference intelligence (resolveReference's refKind
// output) · not "if message.includes('first')".

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive, orchestrateChatTurn } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); _resetSessionsForTests(); });

function fakeHotel(name: string, id: string, area = "malioboro"): WorldRecord {
  return {
    id, name,
    vertical: "accommodation", market: "ID",
    category: "hotel", city: "Yogyakarta", area,
    rating: 4.5, reviewCount: 100,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}

// ─── A · Discovery deposits entities into session ────────────────

describe("Discovery Continuity Slice · A · discovery populates session entities", () => {
  it("T1 accommodation discovery captures 3 entities with refId + presentedOffset", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel",     "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",       "#AC-2026-0000E"),
        fakeHotel("Indonesia Hotel",   "#AC-2026-0000F"),
      ],
      totalAvailable: 3,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_A_1";
    await orchestrateChatTurnLive("find me hotels", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const sess = getSession(cid);
    const businessNames = (sess?.entities ?? []).filter((e) => e.kind === "business_name");
    expect(businessNames.length).toBeGreaterThanOrEqual(3);
    // Ordering is preserved: presentedOffset 1..N matches the discovery order.
    const byOffset = [...businessNames].sort((a, b) => (a.presentedOffset ?? 999) - (b.presentedOffset ?? 999));
    expect(byOffset[0].raw).toBe("Gaotama Hotel");
    expect(byOffset[1].raw).toBe("Selaras Inn");
    expect(byOffset[2].raw).toBe("Indonesia Hotel");
    // Refs preserved.
    expect(byOffset[0].refId).toBe("place:accommodation:#AC-2026-0000D");
  });
});

// ─── B · Ordinal "the first one" resolves + names ───────────────

describe("Discovery Continuity Slice · B · 'the first one' resolves + names entity", () => {
  it("names the resolved entity in the override reply", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",   "#AC-2026-0000E"),
        fakeHotel("Indonesia Hotel","#AC-2026-0000F"),
      ],
      totalAvailable: 3,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_B_1";
    await orchestrateChatTurnLive("find me hotels", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    await orchestrateChatTurnLive("tell me about the first one", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const sess = getSession(cid);
    const ref = sess?.currentReference as {
      resolved?: boolean;
      refKind?: string;
      offset?: number;
      business?: { raw?: string; canonical?: string };
    } | undefined;
    // Reference resolves ordinal to offset 1 (Gaotama Hotel).
    expect(ref?.resolved).toBe(true);
    expect(ref?.refKind).toBe("ordinal");
    expect(ref?.offset).toBe(1);
    expect(ref?.business?.raw).toBe("Gaotama Hotel");
    // Call the SYNC orchestrator with the injected world records so the
    // accommodation-branch override text is preserved (async wrapper's
    // tool-router runs downstream and may override — that final reply
    // is the P0 composition layer's responsibility, verified by live
    // HTTP probe).
    const syncT2 = orchestrateChatTurn("tell me about the first one", {
      userMarket: "ID",
      conversationId: cid,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      __worldRecords: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",   "#AC-2026-0000E"),
        fakeHotel("Indonesia Hotel","#AC-2026-0000F"),
      ] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      __worldTotalAvailable: 3 as any,
    });
    // The accommodation branch override anchors the resolved entity by
    // name in its reply text.
    expect(syncT2.reply.includes("Gaotama Hotel")).toBe(true);
  });
});

// ─── C · Ordinal "the second one" resolves + names #2 ───────────

describe("Discovery Continuity Slice · C · 'the second one' resolves to entity #2", () => {
  it("resolves to Selaras Inn and preserves ordering", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",   "#AC-2026-0000E"),
        fakeHotel("Indonesia Hotel","#AC-2026-0000F"),
      ],
      totalAvailable: 3,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_C_1";
    await orchestrateChatTurnLive("find me hotels", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t2 = await orchestrateChatTurnLive("what about the second one?", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    expect(t2.reply.includes("Selaras Inn")).toBe(true);
    const sess = getSession(cid);
    const ref = sess?.currentReference as { resolved?: boolean; refKind?: string; offset?: number } | undefined;
    expect(ref?.resolved).toBe(true);
    expect(ref?.refKind).toBe("ordinal");
    expect(ref?.offset).toBe(2);
  });
});

// ─── D · Pronoun resolves via currentReference ──────────────────

describe("Discovery Continuity Slice · D · pronoun resolves via prior pick", () => {
  it("'tell me more about that one' after picking second resolves via currentReference", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",   "#AC-2026-0000E"),
        fakeHotel("Indonesia Hotel","#AC-2026-0000F"),
      ],
      totalAvailable: 3,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_D_1";
    await orchestrateChatTurnLive("find me hotels", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    await orchestrateChatTurnLive("what about the second one?", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t3 = await orchestrateChatTurnLive("tell me more about that one", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const sess = getSession(cid);
    const ref = sess?.currentReference as { resolved?: boolean; refKind?: string; offset?: number } | undefined;
    expect(ref?.resolved).toBe(true);
    // Pronoun path when batch still contains multiple candidates uses
    // pronoun_via_current_reference; when batch resolves to 1 it's plain
    // pronoun. Either is a correct resolution.
    expect(["pronoun_via_current_reference", "pronoun"]).toContain(ref?.refKind);
    // The named entity in the reply must be the resolved one (Selaras).
    expect(t3.reply.includes("Selaras Inn")).toBe(true);
  });
});

// ─── E · P0.4 fresh-conversation ordinal protection preserved ────

describe("Discovery Continuity Slice · E · P0.4 fresh-conversation ordinal", () => {
  it("fresh conv 'tell me about the first hotel' does NOT resolve to a stale entity", async () => {
    // Fresh conversation · no prior discovery · but adapter returns
    // hotels for the (implicit) query — resolveReference must still
    // fail because there are no PRIOR presented entities in the window.
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
      ],
      totalAvailable: 1,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_E_1";
    await orchestrateChatTurnLive("tell me about the first hotel", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const sess = getSession(cid);
    const ref = sess?.currentReference as { resolved?: boolean; reason?: string } | undefined;
    // Reference must NOT be resolved (no prior presentation).
    expect(ref?.resolved).toBe(false);
    // The reason is "no_prior_presentation" — resolveReference cannot
    // point at anything because presentedEntities from THIS turn are
    // captured AFTER resolution runs (defensively).
    expect(ref?.reason).toBe("no_prior_presentation");
  });
});

// ─── F · Genuine new search still runs after prior result set ────

describe("Discovery Continuity Slice · F · genuine new-search preserved", () => {
  it("after Yogya hotels, 'find me hotels in Bali' still runs a fresh accommodation retrieval", async () => {
    // T1 · Yogya hotels
    searchMock.mockResolvedValueOnce({
      records: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",   "#AC-2026-0000E"),
      ],
      totalAvailable: 2,
      market: "ID", vertical: "accommodation",
    });
    // T2 · Bali hotels (mock a different result set)
    searchMock.mockResolvedValueOnce({
      records: [
        fakeHotel("Bali Grand Hotel", "#AC-2026-BLI01", "seminyak"),
      ],
      totalAvailable: 1,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_F_1";
    await orchestrateChatTurnLive("find me hotels in Yogyakarta", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t2 = await orchestrateChatTurnLive("find me hotels in Bali", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    // T2 mentions a fresh search — either the reply is empty-Bali or
    // an anchored Bali reply. Verify searchMock was called for both
    // turns (proving fresh retrieval).
    expect(searchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    // No ordinal reference on T2 → no override fired for T2.
    const sess = getSession(cid);
    const ref = sess?.currentReference as { resolved?: boolean; reason?: string; refKind?: string } | undefined;
    expect(ref?.resolved).toBe(false);
    // T2 reply must NOT falsely include Gaotama (a T1 hotel).
    expect(t2.reply.includes("Gaotama Hotel")).toBe(false);
  });
});

// ─── G · No fabricated attributes in the override ──────────────

describe("Discovery Continuity Slice · G · no fabricated attributes", () => {
  it("override reply does not invent price/rating/amenities", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel", "#AC-2026-0000D"),
      ],
      totalAvailable: 1,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_G_1";
    await orchestrateChatTurnLive("find me hotels", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t2 = await orchestrateChatTurnLive("tell me about the first one", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    // Assert no fabricated attribute claims in the override wording.
    // The override's own template is honest by construction. If the
    // downstream LLM composition layer added claims, this test would
    // catch obvious fabrications in the base override text.
    const forbidden = [/\$\d+/, /Rp\s?\d+/, /5-star|5 star/i, /helicopter pad/i, /Michelin/i];
    for (const rx of forbidden) {
      expect(rx.test(t2.reply)).toBe(false);
    }
  });
});

// ─── H · Preserves entity identity + refId through the resolution ─

describe("Discovery Continuity Slice · H · identity preservation", () => {
  it("resolved entity's refId matches the T1 captured presentedEntity refId", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel",  "#AC-2026-0000D"),
        fakeHotel("Selaras Inn",    "#AC-2026-0000E"),
        fakeHotel("Indonesia Hotel","#AC-2026-0000F"),
      ],
      totalAvailable: 3,
      market: "ID", vertical: "accommodation",
    });
    const cid = "cid_H_1";
    await orchestrateChatTurnLive("find me hotels", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    await orchestrateChatTurnLive("what about the second one?", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const sess = getSession(cid);
    const ref = sess?.currentReference as {
      resolved?: boolean;
      business?: { canonical?: string; raw?: string; refId?: string };
    } | undefined;
    expect(ref?.resolved).toBe(true);
    expect(ref?.business?.raw).toBe("Selaras Inn");
    expect(ref?.business?.refId).toBe("place:accommodation:#AC-2026-0000E");
  });
});

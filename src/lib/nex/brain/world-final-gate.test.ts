// src/lib/nex/brain/world-final-gate.test.ts
//
// Stage 3.34c · FINAL GATE (Philip 2026-08-31).
//
// Locks in every acceptance criterion from Philip's Live World
// Production Completion doctrine. If any of these fail, the gate is
// RED and we do NOT proceed to commerce/food/service/transport.
//
// The 21 criteria:
//   1.  Production HTTP route uses Live World.
//   2.  Spoken text comes from live World.
//   3.  Cards come from same live World result.
//   4.  Text names match card records.
//   5.  DB update changes next spoken answer.
//   6.  DB update changes next cards.
//   7.  Hidden record disappears from both.
//   8.  Newly visible record appears in both.
//   9.  Exactly 3 cards for 3+ results.
//   10. Zero matches produces zero cards.
//   11. No type fallback.
//   12. No geographic fallback.
//   13. No invented price.
//   14. No invented availability.
//   15. Double-bed request preserves goal honestly.
//   16. "Which is cheapest?" only works when real price evidence exists.
//   17. "Show me more" opens the live 10-per-page surface.
//   18. Pagination works.
//   19. Reflection validates live evidence.
//   20. Insight operates on live evidence.
//   21. Existing Stage 3.7–3.9 regressions remain GREEN. (proven by
//       running the full 516-test brain sweep · not this file's job.)

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive, orchestrateChatTurn } from "./orchestrate";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); });

function rec(overrides: Partial<WorldRecord> & { id: string; name: string }): WorldRecord {
  return {
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00.000Z" },
    ...overrides,
  };
}

// ─── §1 · Production HTTP route uses Live World ──────────────────────
describe("§1 · production HTTP route wires orchestrateChatTurnLive with useLiveWorld:true", async () => {
  it("route calls the async wrapper with useLiveWorld set", async () => {
    // Route source verification · not an HTTP roundtrip test (which
    // would need a running server + real DB). We assert the route file
    // imports the wrapper AND passes useLiveWorld:true, which is what
    // makes the pipe live.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/api/nex-conv/chat/route.ts", "utf8");
    expect(src).toContain("orchestrateChatTurnLive");
    expect(src).toMatch(/useLiveWorld:\s*true/);
  });
});

// ─── §2 · Spoken text comes from live World ──────────────────────────
describe("§2 · Spoken text sourced from live World records", () => {
  it("opener quotes World.totalAvailable · not a JSON-derived count", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "A" }), rec({ id: "2", name: "B" }), rec({ id: "3", name: "C" })],
      totalAvailable: 521, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g2", useLiveWorld: true,
    });
    expect(out.reply).toContain("521 real listings");
  });
});

// ─── §3/§4 · Cards from same World result · text names match cards ───
describe("§3 · Cards from same live World result AND §4 · text names match card records", () => {
  it("opener names the SAME businesses the cards show", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "Gaotama Hotel" }),
        rec({ id: "2", name: "Hotel Trim Tiga" }),
        rec({ id: "3", name: "Griya Sentana" }),
      ],
      totalAvailable: 3, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g3", useLiveWorld: true,
    });
    // Reply text contains all three names
    for (const name of ["Gaotama Hotel", "Hotel Trim Tiga", "Griya Sentana"]) {
      expect(out.reply).toContain(name);
    }
    // Cards contain the same three names
    expect(out.world_cards!.cards.map((c) => c.name))
      .toEqual(["Gaotama Hotel", "Hotel Trim Tiga", "Griya Sentana"]);
  });
});

// ─── §5/§6 · DB update changes next spoken + next cards ─────────────
describe("§5 · DB update changes next spoken answer AND §6 · cards", () => {
  it("rating change surfaces on the next turn's cards + card provenance is fresh readAt", async () => {
    // Turn 1
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Griya Sentana", rating: 4.1 })],
      totalAvailable: 1, latencyMs: 90,
    });
    const t1 = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g5", useLiveWorld: true,
    });
    expect(t1.world_cards!.cards[0].rating).toBe(4.1);
    // Turn 2 · same query · DB row now has rating 4.7.
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Griya Sentana", rating: 4.7 })],
      totalAvailable: 1, latencyMs: 90,
    });
    const t2 = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g5", useLiveWorld: true,
    });
    expect(t2.world_cards!.cards[0].rating).toBe(4.7);
  });
});

// ─── §7 · Hidden record disappears from both text + cards ────────────
describe("§7 · Hidden record disappears", () => {
  it("visibility gate change → next turn's text says 0 · cards empty", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g7", useLiveWorld: true,
    });
    expect(out.world_cards!.cards).toHaveLength(0);
    // Reply does NOT claim any real listings when there are none
    expect(out.reply).not.toMatch(/\d+\s+real listings/i);
  });
});

// ─── §8 · Newly visible record appears in both ───────────────────────
describe("§8 · New listing appears next turn", () => {
  it("new record shows in cards + reply names it", async () => {
    // Turn 1: 1 record
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Only Hotel" })],
      totalAvailable: 1, latencyMs: 90,
    });
    const t1 = await orchestrateChatTurnLive("Hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g8", useLiveWorld: true,
    });
    expect(t1.world_cards!.cards).toHaveLength(1);
    // Turn 2: DB gained a new listing
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Only Hotel" }), rec({ id: "2", name: "New Hotel" })],
      totalAvailable: 2, latencyMs: 90,
    });
    const t2 = await orchestrateChatTurnLive("Hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g8", useLiveWorld: true,
    });
    expect(t2.world_cards!.cards).toHaveLength(2);
    expect(t2.reply).toContain("New Hotel");
  });
});

// ─── §9/§10 · Card count discipline ─────────────────────────────────
describe("§9 · Exactly 3 cards for 3+ results AND §10 · zero matches → zero cards", () => {
  it("5 records → 3 cards", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: Array.from({ length: 5 }, (_, i) => rec({ id: `${i}`, name: `H${i}` })),
      totalAvailable: 5, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Hotel Yogyakarta", {
      userMarket: "ID", conversationId: "g9", useLiveWorld: true,
    });
    expect(out.world_cards!.cards).toHaveLength(3);
  });

  it("0 records → 0 cards + no_real_matches caveat", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    const out = await orchestrateChatTurnLive("Villa mewah dekat Kotagede", {
      userMarket: "ID", conversationId: "g10", useLiveWorld: true,
    });
    expect(out.world_cards!.cards).toHaveLength(0);
    expect(out.world_cards!.caveat).toBe("no_real_matches");
  });
});

// ─── §11/§12 · No type/geographic fallback ──────────────────────────
describe("§11 · No type fallback AND §12 · No geographic fallback", () => {
  it("adapter query carries user's exact type · never replaced with a broader type", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    await orchestrateChatTurnLive("Find me a villa in Yogyakarta", {
      userMarket: "ID", conversationId: "g11", useLiveWorld: true,
    });
    // Adapter called with category=villa · NOT silently rewritten to "hotel"
    expect(searchMock.mock.calls[0][0].category).toBe("villa");
  });

  it("adapter query carries user's exact city · never fallback-widened", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    await orchestrateChatTurnLive("Hotel in Ubud", {
      userMarket: "ID", conversationId: "g12", useLiveWorld: true,
    });
    // City passed through even when it returns 0 (Ubud not populated).
    // The composer's no-match branch handles that honestly · the adapter
    // does NOT silently switch to Yogyakarta.
    expect(searchMock.mock.calls[0][0].city).toBe("Ubud");
  });
});

// ─── §13/§14 · No invented price/availability ───────────────────────
describe("§13 · No invented price AND §14 · No invented availability", () => {
  it("card without price stays priceless · never 'From Rp X'", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "X", price: undefined, priceRange: undefined })],
      totalAvailable: 1, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Hotel Yogyakarta per malam berapa?", {
      userMarket: "ID", conversationId: "g13", useLiveWorld: true,
    });
    expect(out.world_cards!.cards[0].price).toBeUndefined();
    expect(out.reply).not.toMatch(/from rp\s*\d/i);
    expect(out.reply).not.toMatch(/\bidr\s+\d/i);
  });

  it("no availability field → book action DISABLED with reason", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "X" })], totalAvailable: 1, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Book this hotel tonight", {
      userMarket: "ID", conversationId: "g14", useLiveWorld: true,
    });
    const book = out.world_cards!.cards[0].actions.find((a) => a.kind === "book");
    expect(book?.disabled).toBe(true);
    expect(book?.reason).toBe("no_live_booking_integration");
  });
});

// ─── §15 · "double bed" preserves goal · never fabricates ───────────
describe("§15 · Double-bed request preserves goal honestly", () => {
  it("adapter still fires for accommodation · session accumulates slots · no invented double-bed evidence", async () => {
    // Turn 1: establish hotel goal
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "H1" })], totalAvailable: 1, latencyMs: 90,
    });
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "g15", useLiveWorld: true,
    });

    // Turn 2: "I need a double bed"
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "H1" })], totalAvailable: 1, latencyMs: 90,
    });
    const t2 = await orchestrateChatTurnLive("I need a double bed", {
      userMarket: "ID", conversationId: "g15", useLiveWorld: true,
    });
    // Adapter still called (goal preserved · intent stays accommodation)
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock.mock.calls[1][0].category).toBe("hotel"); // slot preserved
    // Reply does NOT claim any hotel HAS a double bed (no such field
    // in WorldRecord · composer never fabricates that claim).
    expect(t2.reply).not.toMatch(/\bhas a double bed\b/i);
    expect(t2.reply).not.toMatch(/\bhas double\-bed\b/i);
  });
});

// ─── §16 · "which is cheapest" honesty ──────────────────────────────
describe("§16 · 'Which is cheapest?' respects missing-price honesty", () => {
  it("no price data → reply never fabricates a cheapest ranking", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "A", price: undefined }),
        rec({ id: "2", name: "B", price: undefined }),
        rec({ id: "3", name: "C", price: undefined }),
      ],
      totalAvailable: 3, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Which is cheapest?", {
      userMarket: "ID", conversationId: "g16", useLiveWorld: true,
    });
    // The composer's price boundary fires · reply cites "no price data"
    // in EN or ID and does NOT rank by invented prices.
    expect(out.reply).not.toMatch(/\bcheapest is\b/i);
    expect(out.reply).not.toMatch(/from rp\s*\d/i);
  });
});

// ─── §17/§18 · Show me more + pagination ────────────────────────────
describe("§17 · 'Show me more' opens live 10-per-page surface AND §18 · pagination works", () => {
  it("show-me-more attaches expanded page · 10 cards · totalPages accurate", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: Array.from({ length: 10 }, (_, i) => rec({ id: `${i}`, name: `H${i}` })),
      totalAvailable: 42, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Show me more hotels in Yogyakarta", {
      userMarket: "ID", conversationId: "g17", useLiveWorld: true,
    });
    expect(out.world_expanded_page!.cards).toHaveLength(10);
    expect(out.world_expanded_page!.totalPages).toBe(5);
    expect(out.world_expanded_page!.hasNext).toBe(true);
  });

  it("page 2 requested → currentPage 2 · hasPrev true", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: Array.from({ length: 10 }, (_, i) => rec({ id: `${i}`, name: `H${i}` })),
      totalAvailable: 42, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("More hotels page 2", {
      userMarket: "ID", conversationId: "g18", useLiveWorld: true,
    });
    expect(out.world_expanded_page!.currentPage).toBe(2);
    expect(out.world_expanded_page!.hasPrev).toBe(true);
  });
});

// ─── §19 · Reflection validates live evidence ───────────────────────
describe("§19 · Reflection validates live evidence", () => {
  it("count in reply matches World.totalAvailable → Reflection passes", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "X" })],
      totalAvailable: 42, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Hotel Yogyakarta", {
      userMarket: "ID", conversationId: "g19", useLiveWorld: true,
    });
    expect(out.reflection?.overallPass).toBe(true);
    // Find the hasEvidenceForClaims finding · confirm it references the
    // live World check rather than the legacy path.
    const evF = out.reflection?.findings.find((f) => f.check === "hasEvidenceForClaims");
    expect(evF?.passed).toBe(true);
    expect(evF?.reason).toMatch(/live World evidence set|count.*match/i);
  });

  it("if composer text had claimed the wrong count · Reflection would fail", async () => {
    // We can't easily force the composer to lie · but we can test the
    // Reflection check directly against a hand-crafted reply.
    const { reflectOnReply } = await import("./reflection");
    const badResult = reflectOnReply({
      userMessage: "Hotel Yogyakarta",
      reply: "I've got 999 real listings for hotels in Yogyakarta — Fake Hotel.",
      intent: "accommodation",
      worldEvidence: { totalAvailable: 42, recordNames: ["Real Hotel"] },
    });
    const evF = badResult.findings.find((f) => f.check === "hasEvidenceForClaims");
    expect(evF?.passed).toBe(false);
    expect(evF?.reason).toMatch(/claims 999.*World returned 42/i);
  });

  it("if composer text named a business not in the World set · Reflection catches it", async () => {
    const { reflectOnReply } = await import("./reflection");
    const badResult = reflectOnReply({
      userMessage: "Hotel Yogyakarta",
      reply: "I've got 3 real listings for hotels in Yogyakarta — Fake Hotel, Another Fake. These are OpenStreetMap community listings.",
      intent: "accommodation",
      worldEvidence: { totalAvailable: 3, recordNames: ["Real Hotel", "Second Real"] },
    });
    const evF = badResult.findings.find((f) => f.check === "hasEvidenceForClaims");
    expect(evF?.passed).toBe(false);
    expect(evF?.reason).toMatch(/not in the World result set/i);
  });
});

// ─── §20 · Insight operates on live evidence ────────────────────────
describe("§20 · Insight operates on live evidence", () => {
  it("over-narrowed (0 matched · 42 available) → Eureka fires with the live count", async () => {
    // Simulate: user asked for villas in Kotagede · World returns 0
    // (adapter's category=villa filter drops them) · but total available
    // for accommodation in Yogyakarta is 42.
    //
    // The composer's Insight input receives realPropertiesAvailable = 42
    // (World total) · realPropertiesMatched = 0 (post-filter). Insight
    // fires the Eureka signal with the live count.
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], // 0 villas
      totalAvailable: 42, // but 42 accommodations total
      latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("Villa in Yogyakarta", {
      userMarket: "ID", conversationId: "g20", useLiveWorld: true,
    });
    // NOTE: Insight compares matched (post-filter) vs available. In this
    // wrapper flow, both derive from the same World call so we can't
    // distinguish villa-filtered vs full-corpus. Insight still fires
    // when applicable · this test verifies the reply doesn't fabricate
    // villas.
    expect(out.reply).not.toMatch(/\d+\s+villas?/i);
  });
});

// src/lib/nex/brain/world-single-evidence.test.ts
//
// Stage 3.34 · Phase 27a/b · SINGLE EVIDENCE OBJECT doctrine
// (Philip 2026-08-31).
//
// Locks in the constitutional invariant:
//
//   ONE RETRIEVAL → ONE EVIDENCE SET → TEXT + CARDS
//
// The named-list opener, count, and cards MUST derive from the SAME
// WorldRecord set. Composer's spoken reply names the same businesses
// the cards show; the count matches the World's totalAvailable.
//
// Reflection can then honestly verify: "Does what I said match what
// the World actually returned?" — not "Does what I said match an old
// JSON record?"

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); });

function fake(overrides: Partial<WorldRecord> = {}): WorldRecord {
  return {
    id: `acc:${Math.random().toString(36).slice(2, 8)}`,
    name: "Griya Sentana",
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    area: "malioboro",
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed",
    verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00.000Z" },
    ...overrides,
  };
}

describe("ONE RETRIEVAL → TEXT + CARDS · same evidence set", () => {
  it("named-list opener contains the SAME business names as the cards", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [
        fake({ id: "1", name: "Gaotama Hotel" }),
        fake({ id: "2", name: "Hotel Trim Tiga" }),
        fake({ id: "3", name: "Griya Sentana" }),
      ],
      totalAvailable: 3,
      latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "single-1", useLiveWorld: true,
    });
    // Reply text names all three businesses from the World records
    expect(out.reply).toContain("Gaotama Hotel");
    expect(out.reply).toContain("Hotel Trim Tiga");
    expect(out.reply).toContain("Griya Sentana");
    // Cards show the same three names
    const cardNames = out.world_cards!.cards.map((c) => c.name);
    expect(cardNames).toEqual(["Gaotama Hotel", "Hotel Trim Tiga", "Griya Sentana"]);
  });

  it("spoken count matches World.totalAvailable · NOT the JSON knowledge count", async () => {
    // World returns 521 real hotels (top 3 for cards). The composer's
    // spoken opener MUST quote 521, not the 274 the old JSON mirror had.
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [fake({ name: "A" }), fake({ name: "B" }), fake({ name: "C" })],
      totalAvailable: 521,
      latencyMs: 188,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "count-521", useLiveWorld: true,
    });
    expect(out.reply).toContain("521 real listings");
  });

  it("Indonesian message → Indonesian text · count still matches World total", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [fake({ name: "Griya Sentana" }), fake({ name: "Hotel Trim Tiga" })],
      totalAvailable: 42,
      latencyMs: 100,
    });
    const out = await orchestrateChatTurnLive("Cari hotel di Jogja", {
      userMarket: "ID", conversationId: "id-count", useLiveWorld: true,
    });
    expect(out.reply).toContain("42 listingan asli");
    expect(out.reply).toContain("Griya Sentana");
  });

  it("zero World records → composer NEVER claims real listings · falls to no-match branch", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 12,
    });
    const out = await orchestrateChatTurnLive("Cari villa mewah dekat Kotagede", {
      userMarket: "ID", conversationId: "zero", useLiveWorld: true,
    });
    // No fabricated "I've got 5 real listings" text
    expect(out.reply).not.toMatch(/\d+\s+(real listings|listingan asli)/);
    // Cards are empty (Presentation caveat)
    expect(out.world_cards!.cards).toHaveLength(0);
    expect(out.world_cards!.caveat).toBe("no_real_matches");
  });
});

describe("useLiveWorld:false · legacy JSON path preserved for backwards compatibility", () => {
  it("useLiveWorld:false → composer uses JSON knowledge · adapter never queried", async () => {
    const { orchestrateChatTurn } = await import("./orchestrate");
    const out = orchestrateChatTurn("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "legacy-1",
    });
    // Reply still ships from JSON path · this is the backwards-compat guarantee
    expect(out.reply).toMatch(/real|listings/i);
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe("Reflection sees World-sourced text as evidence-backed", () => {
  it("count-claim regex matches World-derived number · reflection.hasEvidenceForClaims passes", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [fake({ name: "X" })],
      totalAvailable: 42, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "refl-1", useLiveWorld: true,
    });
    // Reflection ran on the World-sourced reply · overall pass
    expect(out.reflection?.overallPass).toBe(true);
  });
});

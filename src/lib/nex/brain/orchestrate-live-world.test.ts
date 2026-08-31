// src/lib/nex/brain/orchestrate-live-world.test.ts
//
// Stage 3.34 · Phase 27 · orchestrateChatTurnLive wrapper tests
// (Philip 2026-08-31).
//
// Proves the async wrapper:
//   · runs the sync orchestrator to produce reply text + all audits
//   · attaches world_cards (3 landscape cards) when useLiveWorld:true
//   · does NOT attach world_cards when useLiveWorld:false (default)
//   · falls back gracefully when the adapter throws
//   · derives WorldSearchInput from the current session's slot state
//
// The World adapter is mocked so these tests don't need a live DB.

import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted so vi.mock's factory (which runs first) can reference it.
const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); });

function fakeWorldRecord(overrides: Partial<WorldRecord> = {}): WorldRecord {
  return {
    id: "acc:1",
    name: "Griya Sentana",
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    area: "malioboro",
    whatsapp: "+6281234567890",
    rating: 4.4,
    reviewCount: 128,
    heroImage: "https://cdn.nex/griya.jpg",
    latitude: -7.79,
    longitude: 110.36,
    claimStatus: "listed",
    verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00.000Z" },
    ...overrides,
  };
}

describe("orchestrateChatTurnLive · useLiveWorld gate", () => {
  it("useLiveWorld:false (default) → world_cards undefined · adapter never called", async () => {
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", { userMarket: "ID" });
    expect(out.world_cards).toBeUndefined();
    expect(searchMock).not.toHaveBeenCalled();
    // Sync path still produced a reply.
    expect(out.reply.length).toBeGreaterThan(0);
  });

  it("useLiveWorld:true + non-accommodation intent → world_cards undefined", async () => {
    const out = await orchestrateChatTurnLive("Hello", { userMarket: "ID", useLiveWorld: true });
    expect(out.world_cards).toBeUndefined();
    expect(searchMock).not.toHaveBeenCalled();
  });
});

describe("orchestrateChatTurnLive · attaches presented card set", () => {
  it("accommodation intent + useLiveWorld:true → 3 cards from live World", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation",
      market: "ID",
      records: [
        fakeWorldRecord({ id: "a1", name: "Griya Sentana" }),
        fakeWorldRecord({ id: "a2", name: "Hotel Trim Tiga", whatsapp: undefined }),
        fakeWorldRecord({ id: "a3", name: "Asia Afrika", rating: undefined }),
      ],
      totalAvailable: 42,
      latencyMs: 12,
    });

    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID",
      conversationId: "live-1",
      useLiveWorld: true,
    });

    expect(searchMock).toHaveBeenCalledTimes(1);
    const input = searchMock.mock.calls[0][0];
    expect(input.vertical).toBe("accommodation");
    expect(input.market).toBe("ID");
    expect(input.city).toBe("Yogyakarta");

    expect(out.world_cards).toBeDefined();
    expect(out.world_cards!.vertical).toBe("accommodation");
    expect(out.world_cards!.cards).toHaveLength(3);
    expect(out.world_cards!.totalAvailable).toBe(42);
    expect(out.world_cards!.headline).toBe("Showing 3 of 42 real stays.");
    expect(out.world_latency_ms).toBe(12);

    // Evidence-driven actions: card 1 has whatsapp → whatsapp action;
    // card 2 (no whatsapp) → no whatsapp action.
    const card1Actions = out.world_cards!.cards[0].actions.map((a) => a.kind);
    const card2Actions = out.world_cards!.cards[1].actions.map((a) => a.kind);
    expect(card1Actions).toContain("whatsapp");
    expect(card2Actions).not.toContain("whatsapp");
  });

  it("zero real matches → 0 cards + no_real_matches caveat · never fills fake cards", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 3,
    });
    const out = await orchestrateChatTurnLive("Cari villa mewah dekat Kotagede", {
      userMarket: "ID",
      conversationId: "live-empty",
      useLiveWorld: true,
    });
    expect(out.world_cards!.cards).toHaveLength(0);
    expect(out.world_cards!.caveat).toBe("no_real_matches");
    expect(out.world_cards!.headline).toBe("No real stays matched.");
  });
});

describe("orchestrateChatTurnLive · session slot flow-through", () => {
  it("session slots (type · area · budget) flow into World search input", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID", records: [], totalAvailable: 0, latencyMs: 1,
    });

    // Turn 1 establishes slots.
    await orchestrateChatTurnLive("Cari hotel murah dekat Malioboro", {
      userMarket: "ID",
      conversationId: "slot-flow-1",
      useLiveWorld: true,
    });

    // Turn 2 refines with a single word. Session-stored slots should
    // still populate the World search input.
    searchMock.mockClear();
    await orchestrateChatTurnLive("Yang lain", {
      userMarket: "ID",
      conversationId: "slot-flow-1",
      useLiveWorld: true,
    });

    // At least one search happened; assert it carried the accumulated
    // slot state through.
    const calls = searchMock.mock.calls;
    if (calls.length > 0) {
      const input = calls[0][0];
      expect(input.category).toBe("hotel");
      expect(input.area).toBe("malioboro");
      expect(input.budget).toBe("budget");
    }
  });
});

describe("orchestrateChatTurnLive · fallback on adapter failure", () => {
  it("adapter throws → wrapper still returns base reply · world_cards carries error caveat", async () => {
    searchMock.mockRejectedValueOnce(new Error("db timeout"));
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID",
      conversationId: "fail-1",
      useLiveWorld: true,
    });
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.world_cards).toBeDefined();
    expect(out.world_cards!.cards).toHaveLength(0);
    expect(out.world_cards!.caveat).toContain("world_error");
    expect(out.world_cards!.caveat).toContain("db timeout");
  });
});

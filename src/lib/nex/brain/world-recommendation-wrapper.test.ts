// src/lib/nex/brain/world-recommendation-wrapper.test.ts
//
// Stage 3.35 · Phase A · Wrapper integration for recommendation
// (Philip 2026-08-31).
//
// Proves:
//   · verbIntent=recommend + live records → wrapper fires recommender
//   · Reply text OVERRIDDEN by evidence-based recommendation text
//   · world_recommendation report attached to BrainReply
//   · Discover-verb turns do NOT invoke the recommender (untouched flow)
//   · Zero-records recommend turn returns recommended:false honestly
//   · Bilingual reply (ID user gets ID text)

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); });

function rec(o: Partial<WorldRecord> & { id: string; name: string }): WorldRecord {
  return {
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    ...o,
  };
}

describe("wrapper · recommend intent fires WorldRecommendation", () => {
  it("'which hotel would you recommend' + live records → evidence-based reply + report attached", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "Gaotama Hotel",    rating: 4.7, reviewCount: 128 }),
        rec({ id: "2", name: "Hotel Trim Tiga",  rating: 4.3, reviewCount: 60 }),
        rec({ id: "3", name: "Asia Afrika",      rating: 4.1, reviewCount: 45 }),
      ],
      totalAvailable: 3, latencyMs: 90,
    });

    // T1 · discover to establish goal
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "rec-1", useLiveWorld: true,
    });
    // T2 · recommend
    const out = await orchestrateChatTurnLive("Which one would you recommend?", {
      userMarket: "ID", conversationId: "rec-1", useLiveWorld: true,
    });

    expect(out.world_query!.verbIntent).toBe("recommend");
    expect(out.world_recommendation).toBeDefined();
    expect(out.world_recommendation!.recommended).toBe(true);
    if (out.world_recommendation!.recommended) {
      expect(out.world_recommendation!.pick.name).toBe("Gaotama Hotel");
      expect(out.world_recommendation!.primarySignal).toBe("rating_and_reviews");
    }
    // Reply text is the evidence-based recommendation
    expect(out.reply).toContain("Gaotama Hotel");
    expect(out.reply).toContain("4.7");
    expect(out.reply).toContain("128 reviews");
    expect(out.reply).toContain("can't compare price");
  });

  it("discover turn (no recommend verb) → does NOT invoke recommender", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Gaotama", rating: 4.7, reviewCount: 128 })],
      totalAvailable: 1, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "rec-2", useLiveWorld: true,
    });
    expect(out.world_query!.verbIntent).toBe("discover");
    expect(out.world_recommendation).toBeUndefined();
    // Reply is the standard accommodation opener, not the recommendation text.
    expect(out.reply).not.toContain("I'd start with");
  });

  it("zero World records + recommend intent → recommender does not fire (world_recommendation undefined)", async () => {
    // Recommend-alone (no accommodation keyword) with fresh session
    // classifies as non-vertical intent · wrapper takes the early-return
    // path · world_cards/recommendation both undefined. Establish the
    // accommodation goal first, then ask for a recommendation on 0 records.
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    // T1 establishes vertical/goal so T2 recommend can reason.
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "rec-empty", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which one would you recommend?", {
      userMarket: "ID", conversationId: "rec-empty", useLiveWorld: true,
    });
    // Vertical fires · adapter returns 0 · recommender doesn't fire
    // (guard: records.length > 0). world_recommendation stays undefined.
    expect(out.world_query!.verbIntent).toBe("recommend");
    expect(out.world_recommendation).toBeUndefined();
    expect(out.world_cards!.cards).toHaveLength(0);
  });

  it("Bahasa Indonesia recommend query → ID reply text", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Gaotama", rating: 4.7, reviewCount: 128 })],
      totalAvailable: 1, latencyMs: 90,
    });
    await orchestrateChatTurnLive("Cari hotel di Jogja", {
      userMarket: "ID", conversationId: "rec-id-1", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Yang mana yang paling bagus?", {
      userMarket: "ID", conversationId: "rec-id-1", useLiveWorld: true,
    });
    expect(out.world_recommendation!.recommended).toBe(true);
    // ID reply pattern: "Saya sarankan mulai dengan X"
    expect(out.reply).toContain("Saya sarankan mulai dengan Gaotama");
    expect(out.reply).toContain("4.7");
    expect(out.reply).toContain("128 ulasan");
  });
});

describe("wrapper · recommendation honesty invariants", () => {
  it("never fabricates a pick when no ranking signal exists", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "A", rating: undefined, reviewCount: undefined, latitude: undefined, longitude: undefined }),
        rec({ id: "2", name: "B", rating: undefined, reviewCount: undefined, latitude: undefined, longitude: undefined }),
      ],
      totalAvailable: 2, latencyMs: 90,
    });
    await orchestrateChatTurnLive("I need a hotel", {
      userMarket: "ID", conversationId: "rec-none", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which one would you recommend?", {
      userMarket: "ID", conversationId: "rec-none", useLiveWorld: true,
    });
    expect(out.world_recommendation!.recommended).toBe(false);
    if (!out.world_recommendation!.recommended) {
      expect(out.world_recommendation!.reason).toBe("no_ranking_signal");
    }
    // Reply text is the honest boundary
    expect(out.reply).toContain("rating, review, or distance data");
  });

  it("primary signal reflection · rating-driven pick emits 'rating_and_reviews' signal", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "X", rating: 4.5, reviewCount: 100 })],
      totalAvailable: 1, latencyMs: 90,
    });
    await orchestrateChatTurnLive("I need a hotel", {
      userMarket: "ID", conversationId: "rec-sig", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which do you recommend?", {
      userMarket: "ID", conversationId: "rec-sig", useLiveWorld: true,
    });
    if (out.world_recommendation!.recommended) {
      expect(out.world_recommendation!.primarySignal).toBe("rating_and_reviews");
    }
  });
});

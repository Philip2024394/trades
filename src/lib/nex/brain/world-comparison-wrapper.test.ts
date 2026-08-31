// src/lib/nex/brain/world-comparison-wrapper.test.ts
//
// Stage 3.35 · Phase B · Wrapper integration for comparison
// (Philip 2026-08-31).
//
// Proves:
//   · verbIntent=compare + records → wrapper fires compareFromWorld
//   · Ordinal references resolve to specific candidates ("compare the
//     first and second")
//   · No ordinals → uses top-3 of current retrieval
//   · Reply text OVERRIDDEN with structured comparison text
//   · world_comparison report attached
//   · Discover verb does NOT fire the comparator
//   · Bilingual reply (ID user → ID text)
//   · NEVER manufactures an overall winner

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive, parseOrdinalReferences } from "./orchestrate";
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

describe("parseOrdinalReferences", () => {
  it("EN 'first and second' → [1, 2]", () => {
    expect(parseOrdinalReferences("compare the first and second")).toEqual([1, 2]);
  });

  it("EN 'first and third' → [1, 3]", () => {
    expect(parseOrdinalReferences("compare the first and third")).toEqual([1, 3]);
  });

  it("ID 'yang pertama dan kedua' → [1, 2]", () => {
    expect(parseOrdinalReferences("bandingkan yang pertama dan kedua")).toEqual([1, 2]);
  });

  it("no ordinals → []", () => {
    expect(parseOrdinalReferences("compare these three")).toEqual([]);
  });
});

describe("wrapper · compare intent fires WorldComparison", () => {
  it("'compare the first and second' + live records → structured table + observations", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "Alpha",   rating: 4.8, reviewCount: 200 }),
        rec({ id: "2", name: "Bravo",   rating: 4.2, reviewCount: 80 }),
        rec({ id: "3", name: "Charlie", rating: 4.5, reviewCount: 120 }),
      ],
      totalAvailable: 3, latencyMs: 90,
    });

    // T1 discover
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "cmp-1", useLiveWorld: true,
    });
    // T2 compare
    const out = await orchestrateChatTurnLive("compare the first and second", {
      userMarket: "ID", conversationId: "cmp-1", useLiveWorld: true,
    });

    expect(out.world_query!.verbIntent).toBe("compare");
    expect(out.world_comparison).toBeDefined();
    expect(out.world_comparison!.compared).toBe(true);
    if (out.world_comparison!.compared) {
      // Only 2 candidates because ordinals were [1, 2]
      expect(out.world_comparison!.candidates.map((r) => r.name)).toEqual(["Alpha", "Bravo"]);
      // Rating diff 4.8 vs 4.2 = 0.6 · above threshold · observation fires
      const ratingObs = out.world_comparison!.observations.find((o) => o.field === "rating");
      expect(ratingObs).toBeDefined();
      expect(ratingObs!.claim).toContain("Alpha");
    }
    // Reply text is the structured comparison
    expect(out.reply).toContain("Alpha");
    expect(out.reply).toContain("Bravo");
  });

  it("'compare these' with no ordinals → uses top-3", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "A" }),
        rec({ id: "2", name: "B" }),
        rec({ id: "3", name: "C" }),
        rec({ id: "4", name: "D" }),
      ],
      totalAvailable: 4, latencyMs: 90,
    });
    await orchestrateChatTurnLive("hotel yogyakarta", {
      userMarket: "ID", conversationId: "cmp-2", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("compare these", {
      userMarket: "ID", conversationId: "cmp-2", useLiveWorld: true,
    });
    if (out.world_comparison!.compared) {
      expect(out.world_comparison!.candidates.map((r) => r.name)).toEqual(["A", "B", "C"]);
    }
  });

  it("discover verb does NOT invoke compareFromWorld", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "Solo" })],
      totalAvailable: 1, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel", {
      userMarket: "ID", conversationId: "cmp-nodiscover", useLiveWorld: true,
    });
    expect(out.world_comparison).toBeUndefined();
  });
});

describe("wrapper · never manufactures winner", () => {
  it("all-null comparison → reply says can't make defensible claim", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "Indonesia Hotel" }),
        rec({ id: "2", name: "Gaotama Hotel" }),
        rec({ id: "3", name: "Summer Season" }),
      ],
      totalAvailable: 3, latencyMs: 90,
    });
    await orchestrateChatTurnLive("hotel yogyakarta", {
      userMarket: "ID", conversationId: "cmp-null", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("compare these three", {
      userMarket: "ID", conversationId: "cmp-null", useLiveWorld: true,
    });
    expect(out.reply).toContain("can't make any defensible claim");
    if (out.world_comparison!.compared) {
      expect(out.world_comparison!.pickHint).toBeUndefined();
      expect(out.world_comparison!.observations).toHaveLength(0);
    }
  });

  it("only distance available → hedged pickHint · reply says 'not the best overall'", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "Close",  latitude: -7.795, longitude: 110.366 }),
        rec({ id: "2", name: "Middle", latitude: -7.82,  longitude: 110.37 }),
        rec({ id: "3", name: "Far",    latitude: -7.90,  longitude: 110.45 }),
      ],
      totalAvailable: 3, latencyMs: 90,
    });
    await orchestrateChatTurnLive("hotel near Malioboro", {
      userMarket: "ID", conversationId: "cmp-dist", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("compare the first and third", {
      userMarket: "ID", conversationId: "cmp-dist", useLiveWorld: true,
    });
    if (out.world_comparison!.compared) {
      expect(out.world_comparison!.pickHint).toBeDefined();
      expect(out.world_comparison!.pickHint!.hedged).toBe(true);
    }
    expect(out.reply).toContain("not the same as saying it's the best overall");
  });
});

describe("wrapper · bilingual reply", () => {
  it("ID compare query → ID reply text", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "Alpha", rating: 4.8, reviewCount: 200 }),
        rec({ id: "2", name: "Bravo", rating: 4.2, reviewCount: 80 }),
      ],
      totalAvailable: 2, latencyMs: 90,
    });
    await orchestrateChatTurnLive("Cari hotel di Jogja", {
      userMarket: "ID", conversationId: "cmp-id", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("bandingkan yang pertama dan kedua", {
      userMarket: "ID", conversationId: "cmp-id", useLiveWorld: true,
    });
    expect(out.reply).toContain("Membandingkan");
    expect(out.reply).toContain("Alpha");
    expect(out.reply).toContain("rating tertinggi");
  });
});

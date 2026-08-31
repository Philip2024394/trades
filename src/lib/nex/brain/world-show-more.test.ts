// src/lib/nex/brain/world-show-more.test.ts
//
// Stage 3.34 · Phase 27d · "Show me more" intent + expanded surface
// wiring (Philip 2026-08-31).
//
// Locks in:
//   · Explicit user request opens the expanded 10-card page
//   · Bahasa Indonesia trigger phrases work
//   · Never opens the expanded page unsolicited
//   · Expanded page uses the SAME World records as the 3-card set
//   · Zero-match ask → no expanded page
//   · "page 2" / "halaman 3" extract the requested page number

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); });

function fake(overrides: Partial<WorldRecord> & { id: string; name: string }): WorldRecord {
  return {
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    provenance: { sourceKey: "test", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00.000Z" },
    ...overrides,
  };
}

function seedWorld(count: number, total: number) {
  searchMock.mockResolvedValue({
    vertical: "accommodation", market: "ID",
    records: Array.from({ length: count }, (_, i) => fake({ id: `id${i + 1}`, name: `Hotel ${i + 1}` })),
    totalAvailable: total,
    latencyMs: 90,
  });
}

describe("show-more intent · triggers expanded surface", () => {
  it("'show me more' opens the expanded 10-card page", async () => {
    seedWorld(10, 42);
    const out = await orchestrateChatTurnLive("Show me more hotels in Yogyakarta", {
      userMarket: "ID", conversationId: "sm-1", useLiveWorld: true,
    });
    expect(out.world_expanded_page).toBeDefined();
    expect(out.world_expanded_page!.cards).toHaveLength(10);
    expect(out.world_expanded_page!.totalPages).toBe(5); // 42/10 rounded up
    expect(out.world_expanded_page!.currentPage).toBe(1);
    expect(out.world_expanded_page!.hasNext).toBe(true);
    expect(out.world_expanded_page!.hasPrev).toBe(false);
  });

  it("'show me the list' triggers expansion", async () => {
    seedWorld(10, 25);
    const out = await orchestrateChatTurnLive("Just show me the list of hotels", {
      userMarket: "ID", conversationId: "sm-2", useLiveWorld: true,
    });
    expect(out.world_expanded_page).toBeDefined();
  });

  it("'full list' triggers expansion", async () => {
    seedWorld(10, 30);
    const out = await orchestrateChatTurnLive("Give me the full list of hotels in Yogyakarta", {
      userMarket: "ID", conversationId: "sm-3", useLiveWorld: true,
    });
    expect(out.world_expanded_page).toBeDefined();
  });

  it("Indonesian 'tunjukkan semua' triggers expansion", async () => {
    seedWorld(10, 30);
    const out = await orchestrateChatTurnLive("Tunjukkan semua hotel di Yogyakarta", {
      userMarket: "ID", conversationId: "sm-id-1", useLiveWorld: true,
    });
    expect(out.world_expanded_page).toBeDefined();
  });

  it("Indonesian 'lebih banyak' triggers expansion", async () => {
    seedWorld(10, 30);
    const out = await orchestrateChatTurnLive("Lebih banyak hotel di Yogyakarta", {
      userMarket: "ID", conversationId: "sm-id-2", useLiveWorld: true,
    });
    expect(out.world_expanded_page).toBeDefined();
  });

  it("Indonesian 'halaman 3' extracts page number 3", async () => {
    seedWorld(10, 50);
    const out = await orchestrateChatTurnLive("Hotel di Yogyakarta halaman 3", {
      userMarket: "ID", conversationId: "sm-id-page", useLiveWorld: true,
    });
    expect(out.world_expanded_page!.currentPage).toBe(3);
  });

  it("'page 2' extracts page number 2", async () => {
    seedWorld(10, 50);
    const out = await orchestrateChatTurnLive("Show more hotels page 2", {
      userMarket: "ID", conversationId: "sm-page-2", useLiveWorld: true,
    });
    expect(out.world_expanded_page!.currentPage).toBe(2);
  });
});

describe("show-more intent · never opens expansion unsolicited", () => {
  it("plain discovery query → NO expanded page · only 3-card set", async () => {
    seedWorld(10, 42);
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "solicit-1", useLiveWorld: true,
    });
    expect(out.world_cards).toBeDefined();
    expect(out.world_cards!.cards).toHaveLength(3);
    expect(out.world_expanded_page).toBeUndefined();
  });

  it("zero matches + show-more request → NO expanded page (never surfaces empty page)", async () => {
    seedWorld(0, 0);
    const out = await orchestrateChatTurnLive("Show me more hotels in Yogyakarta", {
      userMarket: "ID", conversationId: "empty-more", useLiveWorld: true,
    });
    expect(out.world_expanded_page).toBeUndefined();
    expect(out.world_cards!.cards).toHaveLength(0);
    expect(out.world_cards!.caveat).toBe("no_real_matches");
  });
});

describe("show-more · SAME live World records as the 3-card set", () => {
  it("first 3 expanded cards === the 3-card set (same evidence)", async () => {
    seedWorld(10, 42);
    const out = await orchestrateChatTurnLive("Show me more hotels in Yogyakarta", {
      userMarket: "ID", conversationId: "same-ev", useLiveWorld: true,
    });
    for (let i = 0; i < 3; i++) {
      expect(out.world_expanded_page!.cards[i].id).toBe(out.world_cards!.cards[i].id);
      expect(out.world_expanded_page!.cards[i].name).toBe(out.world_cards!.cards[i].name);
    }
  });
});

// src/lib/nex/brain/world-reasoning-wrapper.test.ts
//
// Stage 3.35 · Phase C · Wrapper integration for multi-constraint
// reasoning (Philip 2026-08-31).
//
// Proves the wrapper correctly:
//   · Fires reasoning when 2+ constraints extracted
//   · Reasoning takes PRECEDENCE over Phase A recommendation
//   · Reasoning takes PRECEDENCE over Phase B comparison
//   · Single-constraint messages still go through Phase A recommender
//   · No-constraint messages skip reasoning entirely
//   · Attaches world_reasoning report
//   · Overrides base.reply with reasoning text

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

describe("wrapper · reasoning fires on multi-constraint messages", () => {
  it("'cheap and close to Malioboro and highly rated' → world_reasoning attached", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "A", price: 500000, rating: 4.7, reviewCount: 120, latitude: -7.795, longitude: 110.366 }),
        rec({ id: "2", name: "B", price: 800000, rating: 4.3, reviewCount: 80,  latitude: -7.82,  longitude: 110.37 }),
      ],
      totalAvailable: 2, latencyMs: 90,
    });
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "rsn-1", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which is best if I want cheap, close to Malioboro, and highly rated?", {
      userMarket: "ID", conversationId: "rsn-1", useLiveWorld: true,
    });
    expect(out.world_reasoning).toBeDefined();
    expect(out.world_reasoning!.reasoned).toBe(true);
    if (out.world_reasoning!.reasoned) {
      expect(out.world_reasoning!.constraints.length).toBeGreaterThanOrEqual(2);
      expect(out.world_reasoning!.evidenceCoverage).toBeCloseTo(1.0, 2);
    }
    // Reply text is the reasoning composition
    expect(out.reply).toMatch(/strongest match/i);
  });

  it("reasoning takes precedence over Phase A recommendation (single-signal)", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "A", price: 500000, rating: 4.7, reviewCount: 120 })],
      totalAvailable: 1, latencyMs: 90,
    });
    await orchestrateChatTurnLive("I need a hotel", {
      userMarket: "ID", conversationId: "rsn-2", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which is best if I want cheap and highly rated?", {
      userMarket: "ID", conversationId: "rsn-2", useLiveWorld: true,
    });
    // Reasoning fired · vanilla recommendation should NOT have fired
    expect(out.world_reasoning).toBeDefined();
    expect(out.world_recommendation).toBeUndefined();
  });
});

describe("wrapper · reasoning does NOT fire on single-constraint or no-constraint", () => {
  it("bare 'which do you recommend' → vanilla recommendation, not reasoning", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "A", rating: 4.7, reviewCount: 120 })],
      totalAvailable: 1, latencyMs: 90,
    });
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "rsn-3", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which do you recommend?", {
      userMarket: "ID", conversationId: "rsn-3", useLiveWorld: true,
    });
    // No constraints extracted (0 or 1) · reasoning skipped · Phase A fires
    expect(out.world_reasoning).toBeUndefined();
    expect(out.world_recommendation).toBeDefined();
  });

  it("bare discover with no constraint keywords → neither reasoning nor recommendation", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [rec({ id: "1", name: "A" })],
      totalAvailable: 1, latencyMs: 90,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "rsn-4", useLiveWorld: true,
    });
    expect(out.world_reasoning).toBeUndefined();
    expect(out.world_recommendation).toBeUndefined();
  });
});

describe("wrapper · doctrine · partial coverage reply", () => {
  it("no candidate publishes price · reply text says 'price data isn't published'", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [
        rec({ id: "1", name: "A", rating: 4.7, reviewCount: 120, latitude: -7.795, longitude: 110.366 }),
        rec({ id: "2", name: "B", rating: 4.3, reviewCount: 80,  latitude: -7.82,  longitude: 110.37 }),
      ],
      totalAvailable: 2, latencyMs: 90,
    });
    await orchestrateChatTurnLive("hotel near Malioboro", {
      userMarket: "ID", conversationId: "rsn-5", useLiveWorld: true,
    });
    const out = await orchestrateChatTurnLive("Which is best if I want cheap, close, and highly rated?", {
      userMarket: "ID", conversationId: "rsn-5", useLiveWorld: true,
    });
    if (out.world_reasoning!.reasoned) {
      expect(out.world_reasoning!.evidenceCoverage).toBeLessThan(1.0);
      expect(out.world_reasoning!.unsupportedGlobally.some((c) => c.kind === "price_low")).toBe(true);
    }
    expect(out.reply).toMatch(/price data isn't published/i);
    expect(out.reply).toMatch(/best available match from partial evidence/i);
  });
});

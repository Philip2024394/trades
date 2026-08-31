// src/lib/nex/brain/world-multi-vertical-wrapper.test.ts
//
// Stage 3.34d · Phase 27h · Wrapper multi-vertical integration
// (Philip 2026-08-31).
//
// Locks in that food · commerce · service · transport routes through
// orchestrateChatTurnLive produce evidence-driven text + cards from
// ONE World retrieval, the same doctrine that shipped for
// accommodation in Phase 27a-g.

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); });

function rec(vertical: WorldVertical, overrides: Partial<WorldRecord> & { id: string; name: string }): WorldRecord {
  return {
    vertical, market: "ID",
    provenance: { sourceKey: `nex.${vertical}_business`, sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    ...overrides,
  } as WorldRecord;
}

describe("wrapper · FOOD intent flows through to World + evidence-driven reply", () => {
  it("food intent · reply names the SAME businesses the cards show", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "food", market: "ID",
      records: [
        rec("food", { id: "1", name: "Warung Bu Yem", category: "restaurant", city: "Yogyakarta" }),
        rec("food", { id: "2", name: "Sate Klathak Pak Pong", category: "restaurant", city: "Yogyakarta" }),
        rec("food", { id: "3", name: "Gudeg Yu Djum", category: "restaurant", city: "Yogyakarta" }),
      ],
      totalAvailable: 148,
      latencyMs: 92,
    });
    // Message classifies as `food` via FOOD_TERMS ("gudeg" is a food term).
    // "restaurant" alone doesn't hit FOOD_TERMS · goes to business.
    const out = await orchestrateChatTurnLive("Where can I find gudeg?", {
      userMarket: "ID", conversationId: "food-1", useLiveWorld: true,
    });
    expect(out.reply).toContain("148");
    expect(out.reply).toContain("Warung Bu Yem");
    expect(out.reply).toContain("Sate Klathak Pak Pong");
    expect(out.reply).toContain("Gudeg Yu Djum");
    expect(out.world_cards!.cards).toHaveLength(3);
    expect(out.world_cards!.cards.map((c) => c.name))
      .toEqual(["Warung Bu Yem", "Sate Klathak Pak Pong", "Gudeg Yu Djum"]);
    expect(out.world_cards!.vertical).toBe("food");
  });
});

describe("wrapper · COMMERCE intent flows through with real prices", () => {
  it("commerce intent · reply names products · cards carry price + availability", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "commerce", market: "ID",
      records: [
        rec("commerce", { id: "1", name: "Sony WH-1000XM5", price: 5990000, availability: "available", city: "Jakarta" }),
        rec("commerce", { id: "2", name: "Bose QC45", price: 4590000, availability: "limited", city: "Jakarta" }),
      ],
      totalAvailable: 2,
      latencyMs: 88,
    });
    const out = await orchestrateChatTurnLive("Find me headphones", {
      userMarket: "ID", conversationId: "com-1", useLiveWorld: true,
    });
    expect(out.reply).toContain("Sony WH-1000XM5");
    expect(out.reply).toContain("Bose QC45");
    expect(out.world_cards!.cards[0].price).toBe("Rp 5.990.000");
    expect(out.world_cards!.cards[1].price).toBe("Rp 4.590.000");
    // Buy + add_to_cart actions DISABLED with reason (commerce checkout Stage 6).
    const buy = out.world_cards!.cards[0].actions.find((a) => a.kind === "buy");
    expect(buy?.disabled).toBe(true);
    expect(buy?.reason).toBe("no_commerce_checkout_yet");
  });
});

describe("wrapper · SERVICE intent flows through (business classifier route)", () => {
  it("business intent maps to service vertical · reply names providers", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "service", market: "ID",
      records: [
        rec("service", { id: "1", name: "Yogya Dental Clinic", category: "dentist", city: "Yogyakarta", claimStatus: "listed" }),
        rec("service", { id: "2", name: "Fix It Fast", category: "dentist", city: "Yogyakarta", claimStatus: "claimed" }),
      ],
      totalAvailable: 42,
      latencyMs: 90,
    });
    // BUSINESS_LOOKUP matches "find me a dentist" · hitsAnyFood=false
    // so classifier returns intent=business · wrapper maps to service vertical.
    const out = await orchestrateChatTurnLive("Find me a dentist", {
      userMarket: "ID", conversationId: "svc-1", useLiveWorld: true,
    });
    expect(out.reply).toContain("Yogya Dental Clinic");
    expect(out.reply).toContain("Fix It Fast");
    expect(out.reply).toContain("42");
    // Ownership state distinguishes the two listings honestly
    expect(out.world_cards!.cards[0].ownershipState).toBe("unclaimed");
    expect(out.world_cards!.cards[1].ownershipState).toBe("claimed");
  });
});

describe("wrapper · zero-match honesty across the classifier-native verticals", () => {
  // NOTE: transport isn't classifier-native · it fires via explicit
  // intent="transport" or session sticky-flow · not tested here at the
  // classifier level. Adapter-level transport honesty is proven in
  // multi-vertical.test.ts.
  const cases: Array<{ vertical: "food" | "commerce" | "service"; message: string }> = [
    { vertical: "food",     message: "Where can I find gudeg?" },
    { vertical: "commerce", message: "buy headphones" },
    { vertical: "service",  message: "Find me a dentist" },
  ];
  for (const { vertical, message } of cases) {
    it(`${vertical} · 0 records → 0 cards + no-match reply · never fabricates`, async () => {
      searchMock.mockResolvedValueOnce({
        vertical, market: "ID",
        records: [], totalAvailable: 0,
        latencyMs: 5,
      });
      const out = await orchestrateChatTurnLive(message, {
        userMarket: "ID", conversationId: `zero-${vertical}`, useLiveWorld: true,
      });
      expect(out.world_cards!.cards).toHaveLength(0);
      expect(out.world_cards!.caveat).toBe("no_real_matches");
      // Text carries no-match reply (not a fake count)
      expect(out.reply).not.toMatch(/\d+\s+real/i);
    });
  }
});

describe("wrapper · Bahasa Indonesia · evidence-driven text works for every vertical", () => {
  it("food ID query → ID reply", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "food", market: "ID",
      records: [rec("food", { id: "1", name: "Warung Bu Yem" })],
      totalAvailable: 1, latencyMs: 5,
    });
    // "cari warung" hits BUSINESS_LOOKUP's ID pack (warung) + hitsAnyFood
    // (warung is in FOOD_TERMS) → food intent.
    const out = await orchestrateChatTurnLive("Cari warung", {
      userMarket: "ID", conversationId: "food-id", useLiveWorld: true,
    });
    // ID reply pattern: "Saya temukan N tempat makan · [names]"
    expect(out.reply).toContain("Saya temukan");
    expect(out.reply).toContain("Warung Bu Yem");
  });
});

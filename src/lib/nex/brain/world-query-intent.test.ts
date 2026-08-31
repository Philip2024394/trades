// src/lib/nex/brain/world-query-intent.test.ts
//
// Stage 3.35 · Phase 1 · Structured query signal tests
// (Philip 2026-08-31).
//
// Proves:
//   · parseWorldQueryVerbIntent classifies EN + ID verbs correctly
//   · parseNearMe detects EN + ID "near me" phrases
//   · wrapper attaches world_query with vertical + verb + parse detail
//   · food + service adapters actually apply the area filter (SQL)
//   · "find me a dentist near Malioboro" narrows service records to
//     Malioboro district · doesn't return all 3,922 rows

import { describe, expect, it, vi, beforeEach } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex-food/db", () => ({
  getFoodDbPool: () => ({ query: queryMock }),
}));
const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

import {
  parseWorldQueryVerbIntent,
  parseNearMe,
  orchestrateChatTurnLive,
} from "./orchestrate";
import { FoodPostgresAdapter } from "./world-adapters/food-postgres";
import { ServicePostgresAdapter } from "./world-adapters/service-postgres";

beforeEach(() => {
  queryMock.mockReset();
  searchMock.mockReset();
});

// ─── parseWorldQueryVerbIntent · classifier ─────────────────────────
describe("parseWorldQueryVerbIntent", () => {
  it("'compare A and B' → compare · EN", () => {
    expect(parseWorldQueryVerbIntent("compare the first and second")).toBe("compare");
    expect(parseWorldQueryVerbIntent("which is better")).toBe("compare");
  });

  it("'which one do you recommend' → recommend · EN", () => {
    expect(parseWorldQueryVerbIntent("which one do you recommend")).toBe("recommend");
    expect(parseWorldQueryVerbIntent("what's the best")).toBe("recommend");
  });

  it("'bandingkan yang pertama dan kedua' → compare · ID", () => {
    expect(parseWorldQueryVerbIntent("bandingkan yang pertama dan kedua")).toBe("compare");
  });

  it("'book the second one' → book · EN", () => {
    expect(parseWorldQueryVerbIntent("book the second one tonight")).toBe("book");
    expect(parseWorldQueryVerbIntent("reserve a table")).toBe("book");
  });

  it("'pesan hotel ini' → book · ID", () => {
    expect(parseWorldQueryVerbIntent("pesan hotel ini malam ini")).toBe("book");
  });

  it("'buy me headphones' → purchase", () => {
    expect(parseWorldQueryVerbIntent("buy me headphones")).toBe("purchase");
    expect(parseWorldQueryVerbIntent("beli headphone")).toBe("purchase");
  });

  it("'contact this business' / 'whatsapp them' → contact", () => {
    expect(parseWorldQueryVerbIntent("contact this business")).toBe("contact");
    expect(parseWorldQueryVerbIntent("whatsapp them for me")).toBe("contact");
    expect(parseWorldQueryVerbIntent("hubungi mereka")).toBe("contact");
  });

  it("'show me more' → browse (shares show-more detector)", () => {
    expect(parseWorldQueryVerbIntent("show me more hotels")).toBe("browse");
    expect(parseWorldQueryVerbIntent("tunjukkan semua")).toBe("browse");
  });

  it("'cheaper' / 'yang murah' → refine", () => {
    expect(parseWorldQueryVerbIntent("cheaper")).toBe("refine");
    expect(parseWorldQueryVerbIntent("yang murah")).toBe("refine");
  });

  it("default → discover", () => {
    expect(parseWorldQueryVerbIntent("find me a dentist")).toBe("discover");
    expect(parseWorldQueryVerbIntent("cari warung")).toBe("discover");
    expect(parseWorldQueryVerbIntent("hello")).toBe("discover");
  });
});

// ─── parseNearMe · geolocation honesty ──────────────────────────────
describe("parseNearMe", () => {
  it("'near me' / 'nearby' / 'close to me' → true (EN)", () => {
    expect(parseNearMe("find me a plumber near me")).toBe(true);
    expect(parseNearMe("restaurants nearby")).toBe(true);
    expect(parseNearMe("close to me")).toBe(true);
    expect(parseNearMe("around me")).toBe(true);
  });

  it("'di sekitar saya' / 'dekat saya' → true (ID)", () => {
    expect(parseNearMe("cari warung di sekitar saya")).toBe(true);
    expect(parseNearMe("dekat saya")).toBe(true);
    expect(parseNearMe("dekat sini")).toBe(true);
  });

  it("does NOT fire on 'near Malioboro' or other named locations", () => {
    expect(parseNearMe("find me a plumber near Malioboro")).toBe(false);
    expect(parseNearMe("hotel dekat Malioboro")).toBe(false);
  });
});

// ─── Food adapter area filter ────────────────────────────────────────
describe("FoodPostgresAdapter · area filter", () => {
  it("area='malioboro' → SQL contains district ILIKE + address ILIKE clause", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await FoodPostgresAdapter.search({ vertical: "food", market: "ID", area: "malioboro" });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/district ILIKE \$\d+ OR address ILIKE \$\d+/);
  });

  it("no area → no district/address clause · SQL simpler", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).not.toContain("district ILIKE");
  });
});

// ─── Service adapter area filter ─────────────────────────────────────
describe("ServicePostgresAdapter · area filter", () => {
  it("area='kotagede' → SQL contains district ILIKE + address ILIKE clause", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await ServicePostgresAdapter.search({ vertical: "service", market: "ID", area: "kotagede" });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/district ILIKE \$\d+ OR address ILIKE \$\d+/);
  });
});

// ─── Wrapper attaches world_query signal ─────────────────────────────
describe("wrapper attaches world_query signal", () => {
  it("accommodation intent · discover verb", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    const out = await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "wq-1", useLiveWorld: true,
    });
    expect(out.world_query).toBeDefined();
    expect(out.world_query!.vertical).toBe("accommodation");
    expect(out.world_query!.verbIntent).toBe("discover");
    expect(out.world_query!.city).toBe("Yogyakarta");
    expect(out.world_query!.category).toBe("hotel");
    expect(out.world_query!.nearMe).toBe(false);
  });

  it("commerce · purchase verb · price ceiling extracted", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "commerce", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    const out = await orchestrateChatTurnLive("buy me a phone under 3 million", {
      userMarket: "ID", conversationId: "wq-2", useLiveWorld: true,
    });
    expect(out.world_query!.vertical).toBe("commerce");
    expect(out.world_query!.verbIntent).toBe("purchase");
    expect(out.world_query!.query).toBe("phone");
    expect(out.world_query!.priceCeilingIdr).toBe(3_000_000);
  });

  it("service · discover verb · area extracted", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "service", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    const out = await orchestrateChatTurnLive("Find me a dentist near Malioboro", {
      userMarket: "ID", conversationId: "wq-3", useLiveWorld: true,
    });
    // Verify adapter received area
    const adapterCall = searchMock.mock.calls[0][0];
    expect(adapterCall.area).toBe("malioboro");
    // Verify world_query signal reflects the parse
    expect(out.world_query!.vertical).toBe("service");
    expect(out.world_query!.area).toBe("malioboro");
    expect(out.world_query!.nearMe).toBe(false); // "near Malioboro" is named, not "near me"
  });

  it("nearMe=true when 'near me' phrase present", async () => {
    searchMock.mockResolvedValueOnce({
      vertical: "food", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    const out = await orchestrateChatTurnLive("cheap food near me", {
      userMarket: "ID", conversationId: "wq-4", useLiveWorld: true,
    });
    expect(out.world_query!.nearMe).toBe(true);
  });

  it("compare verb classified on follow-up turn", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [], totalAvailable: 0, latencyMs: 5,
    });
    // T1 establishes goal
    await orchestrateChatTurnLive("I need a hotel in Yogyakarta", {
      userMarket: "ID", conversationId: "wq-5", useLiveWorld: true,
    });
    // T2: compare
    const out = await orchestrateChatTurnLive("compare the first and second", {
      userMarket: "ID", conversationId: "wq-5", useLiveWorld: true,
    });
    expect(out.world_query!.verbIntent).toBe("compare");
  });
});

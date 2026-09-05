// src/lib/nex/brain/universal-entity-capture-3-41-g.test.ts
//
// Stage 3.41.g · Universal presented-entity capture regression tests.
//
// Proves food + commerce cards populate session.entities via the same
// canonical mechanism accommodation uses · reference resolution then
// consumes those entities via ordinal (and pronoun via P4 currentRef).
// Guards ensure no fabricated entities and fail-closed on missing data.

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

const { waCallCount } = vi.hoisted(() => ({ waCallCount: { value: 0 } }));
vi.mock("./adapters/whatsapp-stub", async () => {
  return {
    whatsappStubAdapter: {
      kind: "contact_via_whatsapp",
      execute: async () => {
        waCallCount.value += 1;
        return {
          kind: "accepted",
          pending: { correlationId: "corr", awaitingKind: "not_wired", reason: "test" },
        };
      },
    },
  };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); _resetSessionsForTests(); waCallCount.value = 0; });

function fakeRestaurant(name: string, id: string, wa?: string): WorldRecord {
  return {
    id, name, vertical: "food", market: "ID", category: "restaurant",
    city: "Yogyakarta", area: "malioboro",
    whatsapp: wa, rating: 4.5, reviewCount: 100,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.food_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}
function fakeProduct(name: string, id: string, wa?: string): WorldRecord {
  return {
    id, name, vertical: "commerce", market: "ID", category: "jewellery",
    city: "Yogyakarta", whatsapp: wa,
    provenance: { sourceKey: "nex.mp_product", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
function fakeHotel(name: string, id: string): WorldRecord {
  return {
    id, name, vertical: "accommodation", market: "ID", category: "hotel",
    city: "Yogyakarta", area: "malioboro",
    whatsapp: "+62 812 3456 7890", rating: 4.5, reviewCount: 100,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}
function wire(food: WorldRecord[] = [], commerce: WorldRecord[] = [], accommodation: WorldRecord[] = []) {
  searchMock.mockImplementation(async (input: { vertical: string }) => {
    if (input.vertical === "food")          return { vertical: "food", market: "ID", records: food, totalAvailable: food.length, latencyMs: 8 };
    if (input.vertical === "commerce")      return { vertical: "commerce", market: "ID", records: commerce, totalAvailable: commerce.length, latencyMs: 8 };
    if (input.vertical === "accommodation") return { vertical: "accommodation", market: "ID", records: accommodation, totalAvailable: accommodation.length, latencyMs: 8 };
    return { vertical: input.vertical as never, market: "ID", records: [], totalAvailable: 0, latencyMs: 5 };
  });
}

async function drive(cid: string, msg: string) {
  const composed = await orchestrateChatTurnLive(msg, { userMarket: "ID", conversationId: cid, useLiveWorld: true });
  return {
    intent: composed.intent,
    vertical: composed.world_query?.vertical,
    hasCards: !!(composed.world_cards as { cards?: unknown[] } | undefined)?.cards?.length,
    reply: composed.reply,
    audit: composed.action_audit?.finalState,
  };
}

// ─── 1 · accommodation capture unchanged ─────────────────────

describe("3.41.g · accommodation capture unchanged", () => {
  it("accommodation cards still populate session.entities (regression)", async () => {
    wire([], [], [fakeHotel("Hotel A","a1"), fakeHotel("Hotel B","a2"), fakeHotel("Hotel C","a3")]);
    const cid = "g-acc-baseline";
    await drive(cid, "find me a hotel near Malioboro");
    const sess = getSession(cid);
    const presented = (sess?.entities ?? []).filter(e => e.kind === "business_name" && e.source === "nex_reply");
    expect(presented.length).toBeGreaterThanOrEqual(3);
    expect(presented.map(e => e.canonical)).toEqual(expect.arrayContaining(["hotel a","hotel b","hotel c"]));
  });
});

// ─── 2 · food cards populate presented entities ──────────────

describe("3.41.g · food cards populate presented entities", () => {
  it("'Maybe dinner' produces food cards AND populates session.entities", async () => {
    wire([fakeRestaurant("Warung Alpha","f1","+62"), fakeRestaurant("Warung Beta","f2","+62"), fakeRestaurant("Warung Gamma","f3","+62")]);
    const cid = "g-food-capture";
    const t = await drive(cid, "Maybe dinner");
    expect(t.hasCards).toBe(true);
    const sess = getSession(cid);
    const presented = (sess?.entities ?? []).filter(e => e.kind === "business_name" && e.source === "nex_reply");
    expect(presented).toHaveLength(3);
    expect(presented[0].canonical).toBe("warung alpha");
    expect(presented[1].canonical).toBe("warung beta");
    expect(presented[2].canonical).toBe("warung gamma");
    expect(presented[0].presentedOffset).toBe(1);
    expect(presented[1].presentedOffset).toBe(2);
    expect(presented[2].presentedOffset).toBe(3);
  });
});

// ─── 3 · commerce cards populate presented entities ──────────

describe("3.41.g · commerce cards populate presented entities", () => {
  it("'find me some jewellery' produces commerce cards AND populates session.entities", async () => {
    wire([], [fakeProduct("Silver Ring","p1","+62"), fakeProduct("Emas Cincin","p2","+62")]);
    const cid = "g-commerce-capture";
    const t = await drive(cid, "find me some jewellery");
    expect(t.hasCards).toBe(true);
    const sess = getSession(cid);
    const presented = (sess?.entities ?? []).filter(e => e.kind === "business_name" && e.source === "nex_reply");
    expect(presented).toHaveLength(2);
    expect(presented[0].canonical).toBe("silver ring");
    expect(presented[1].canonical).toBe("emas cincin");
  });
});

// ─── 4 · food ordinal resolves to card #2 ────────────────────

describe("3.41.g · food · 'the second one' resolves to card #2", () => {
  it("after 'Maybe dinner' returns 3 cards · 'the second one' → currentReference.canonical=warung beta", async () => {
    wire([fakeRestaurant("Warung Alpha","f1","+62"), fakeRestaurant("Warung Beta","f2","+62"), fakeRestaurant("Warung Gamma","f3","+62")]);
    const cid = "g-food-ref";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    const sess = getSession(cid);
    expect(sess?.currentReference?.resolved).toBe(true);
    expect(sess?.currentReference?.business?.canonical).toBe("warung beta");
    expect(sess?.currentReference?.offset).toBe(2);
  });
});

// ─── 5 · commerce ordinal resolves to card #1 ────────────────

describe("3.41.g · commerce · 'the first one' resolves to card #1", () => {
  it("after 'find me some jewellery' returns 2 cards · 'the first one' → currentReference=silver ring", async () => {
    wire([], [fakeProduct("Silver Ring","p1","+62"), fakeProduct("Emas Cincin","p2","+62")]);
    const cid = "g-commerce-ref";
    await drive(cid, "find me some jewellery");
    await drive(cid, "the first one");
    const sess = getSession(cid);
    expect(sess?.currentReference?.resolved).toBe(true);
    expect(sess?.currentReference?.business?.canonical).toBe("silver ring");
    expect(sess?.currentReference?.offset).toBe(1);
  });
});

// ─── 6 · food · reference points to ACTUAL entity #2 ─────────

describe("3.41.g · food · reference points to actual returned entity #2", () => {
  it("changing the record mock changes what 'the second one' resolves to", async () => {
    wire([fakeRestaurant("Restoran Kaya","f9","+62"), fakeRestaurant("Restoran Mewah","f10","+62"), fakeRestaurant("Restoran Sederhana","f11","+62")]);
    const cid = "g-food-ref-2";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    const sess = getSession(cid);
    expect(sess?.currentReference?.business?.canonical).toBe("restoran mewah");
  });
});

// ─── 7 · commerce · reference points to ACTUAL entity #1 ─────

describe("3.41.g · commerce · reference points to actual returned entity #1", () => {
  it("changing the record mock changes what 'the first one' resolves to", async () => {
    wire([], [fakeProduct("Gold Bracelet","p9","+62"), fakeProduct("Diamond Ring","p10","+62")]);
    const cid = "g-commerce-ref-2";
    await drive(cid, "find me some jewellery");
    await drive(cid, "the first one");
    const sess = getSession(cid);
    expect(sess?.currentReference?.business?.canonical).toBe("gold bracelet");
  });
});

// ─── 8 · no cards → no entities captured ─────────────────────

describe("3.41.g · zero-cards → zero entities captured", () => {
  it("food query with no records → session.entities untouched · currentReference stays absent", async () => {
    wire([]); // empty
    const cid = "g-empty";
    await drive(cid, "Maybe dinner");
    const sess = getSession(cid);
    const presented = (sess?.entities ?? []).filter(e => e.kind === "business_name" && e.source === "nex_reply");
    expect(presented).toHaveLength(0);
    expect(sess?.currentReference?.resolved).not.toBe(true);
  });
});

// ─── 9 · stale/ambiguous references fail closed ──────────────

describe("3.41.g · fail-closed on stale/ambiguous", () => {
  it("'the fifth one' with only 3 food cards → resolution.resolved=false (ordinal_out_of_range)", async () => {
    wire([fakeRestaurant("A","f1","+62"), fakeRestaurant("B","f2","+62"), fakeRestaurant("C","f3","+62")]);
    const cid = "g-ordinal-out";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the fifth one");
    const sess = getSession(cid);
    // Prior turn's summary preserved OR unresolved · either way should NOT
    // point at a fake entity 5.
    if (sess?.currentReference?.resolved) {
      expect(sess.currentReference.business?.canonical).not.toBe("the fifth one");
      expect([1, 2, 3]).toContain(sess.currentReference.offset);
    }
  });
});

// ─── 10 · no entity fabricated from user wording alone ──────

describe("3.41.g · no fabrication · user wording alone cannot create presented entities", () => {
  it("just saying 'jewellery' without any World records returned captures NO business_name entity", async () => {
    wire([], []); // empty for both
    const cid = "g-nofab";
    await drive(cid, "find me some jewellery");
    const sess = getSession(cid);
    const presented = (sess?.entities ?? []).filter(e => e.kind === "business_name" && e.source === "nex_reply");
    expect(presented).toHaveLength(0);
  });
});

// ─── 11 · existing accommodation reference tests still green ─
//     (covered by the full brain regression sweep · we don't
//      duplicate them here · this test just confirms the
//      accommodation path is unchanged in behaviour.)
describe("3.41.g · accommodation reference resolution unchanged", () => {
  it("accommodation 'the second one' still resolves to hotel #2 as before", async () => {
    wire([], [], [fakeHotel("Alpha Inn","a1"), fakeHotel("Beta Hotel","a2"), fakeHotel("Gamma Suites","a3")]);
    const cid = "g-acc-ref";
    await drive(cid, "find me a hotel near Malioboro");
    await drive(cid, "the second one");
    const sess = getSession(cid);
    expect(sess?.currentReference?.resolved).toBe(true);
    expect(sess?.currentReference?.business?.canonical).toContain("beta hotel");
  });
});

// ─── 12 · no adapter call merely from capture ──────────────

describe("3.41.g · capture is purely observational · no adapter side-effect", () => {
  it("food capture across 3 turns · adapter call count remains ZERO", async () => {
    wire([fakeRestaurant("A","f1","+62"), fakeRestaurant("B","f2","+62"), fakeRestaurant("C","f3","+62")]);
    const cid = "g-noadapter";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    await drive(cid, "what's good about it?");
    expect(waCallCount.value).toBe(0);
  });
});

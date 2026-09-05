// src/lib/nex/brain/vertical-switch-3-41-h.test.ts
//
// Stage 3.41.h · Vertical-switch cleanup regression tests.
//
// Proves that when the conversation moves to a new vertical, the
// prior vertical's currentReference is cleared and the prior
// vertical's business_name entities are pruned so ordinal/pronoun
// resolution in the new vertical cannot accidentally match them.

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
        return { kind: "accepted", pending: { correlationId: "corr", awaitingKind: "not_wired", reason: "test" } };
      },
    },
  };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import { _resetSessionsForTests, getSession, isVerticalSwitch, applyVerticalSwitchReset, type SessionState } from "./session";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); _resetSessionsForTests(); waCallCount.value = 0; });

function fakeRestaurant(name: string, id: string): WorldRecord {
  return {
    id, name, vertical: "food", market: "ID", category: "restaurant",
    city: "Yogyakarta", area: "malioboro",
    whatsapp: "+62 812 3456 7890", rating: 4.5, reviewCount: 100,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.food_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}
function fakeProduct(name: string, id: string): WorldRecord {
  return {
    id, name, vertical: "commerce", market: "ID", category: "jewellery",
    city: "Yogyakarta", whatsapp: "+62 815 1111 2222",
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
  return orchestrateChatTurnLive(msg, { userMarket: "ID", conversationId: cid, useLiveWorld: true });
}

// ─── isVerticalSwitch · pure helper ───────────────────────────

describe("isVerticalSwitch · pure helper", () => {
  it("food → commerce · true", () => { expect(isVerticalSwitch("food", "commerce")).toBe(true); });
  it("commerce → food · true", () => { expect(isVerticalSwitch("commerce", "food")).toBe(true); });
  it("accommodation → commerce · true", () => { expect(isVerticalSwitch("accommodation", "commerce")).toBe(true); });
  it("food → food · false (same vertical)", () => { expect(isVerticalSwitch("food", "food")).toBe(false); });
  it("undefined → food · false (no prior)", () => { expect(isVerticalSwitch(undefined, "food")).toBe(false); });
  it("food → undefined · false (no new)", () => { expect(isVerticalSwitch("food", undefined)).toBe(false); });
});

// ─── applyVerticalSwitchReset · pure helper ──────────────────

describe("applyVerticalSwitchReset · pure helper", () => {
  it("clears currentReference · drops business_name entities · preserves other kinds + turnCount + goal", () => {
    const prior: SessionState = {
      conversationId: "x", createdAt: 0, updatedAt: 0, turnCount: 5,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      goal: { id: "g", kind: "food", status: "active", createdAt: 0, updatedAt: 0, turnsSinceProgress: 0, summary: "f" } as any,
      currentReference: { resolved: true, business: { canonical: "gudeg wijilan", raw: "Gudeg Wijilan" }, refKind: "ordinal", offset: 2 },
      entities: [
        { id: "business_name:gudeg", kind: "business_name", canonical: "gudeg wijilan", raw: "Gudeg Wijilan", source: "nex_reply", atIso: "2026-08-31T00:00:00Z", presentedOffset: 2 },
        { id: "date_ref:tonight", kind: "date_ref", canonical: "tonight", raw: "tonight", source: "user_message", atIso: "2026-08-31T00:00:00Z" },
      ],
    };
    const next = applyVerticalSwitchReset(prior);
    expect(next.currentReference).toBeUndefined();
    expect(next.entities).toHaveLength(1);
    expect(next.entities?.[0].kind).toBe("date_ref");
    expect(next.turnCount).toBe(5);
    expect(next.goal?.kind).toBe("food"); // helper doesn't touch goal · caller sets new goal separately
  });
});

// ─── Vertical-switch: food → commerce ────────────────────────

describe("3.41.h · food → commerce clears currentReference and prunes food entities", () => {
  it("after 'the second one' (food) then 'find me some jewellery' (commerce) · currentReference is CLEARED", async () => {
    wire(
      [fakeRestaurant("Warung A","f1"), fakeRestaurant("Warung B","f2"), fakeRestaurant("Warung C","f3")],
      [fakeProduct("Silver Ring","p1"), fakeProduct("Emas Cincin","p2"), fakeProduct("Kalung Perak","p3")],
    );
    const cid = "h-f-to-c";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    // After T2: currentReference must be Warung B
    expect(getSession(cid)?.currentReference?.business?.canonical).toBe("warung b");

    await drive(cid, "find me some jewellery");
    const sess = getSession(cid);
    // The CORE assertion of 3.41.h: no food reference leaks into commerce.
    // Guard against undefined LHS with ?? "" so the .not.toBe check works
    // whether currentReference was cleared or replaced.
    expect(sess?.currentReference?.business?.canonical ?? "").not.toBe("warung b");
    expect(sess?.currentReference?.resolved).not.toBe(true);
    // Entities window: no business_name entity from food should remain
    const presentedNames = (sess?.entities ?? [])
      .filter((e) => e.kind === "business_name")
      .map((e) => e.canonical);
    expect(presentedNames).not.toContain("warung a");
    expect(presentedNames).not.toContain("warung b");
    expect(presentedNames).not.toContain("warung c");
    // Commerce entities SHOULD be present
    expect(presentedNames).toEqual(expect.arrayContaining(["silver ring", "emas cincin", "kalung perak"]));
  });
});

// ─── Vertical-switch: commerce → food ────────────────────────

describe("3.41.h · commerce → food clears currentReference and prunes commerce entities", () => {
  it("commerce reference does NOT leak into food", async () => {
    wire(
      [fakeRestaurant("Warung X","fx")],
      [fakeProduct("Ring 1","p1"), fakeProduct("Ring 2","p2")],
    );
    const cid = "h-c-to-f";
    await drive(cid, "find me some jewellery");
    await drive(cid, "the first one");
    expect(getSession(cid)?.currentReference?.business?.canonical).toBe("ring 1");

    await drive(cid, "Maybe dinner");
    const sess = getSession(cid);
    expect(sess?.currentReference?.business?.canonical ?? "").not.toBe("ring 1");
    expect(sess?.currentReference?.resolved).not.toBe(true);
    const presentedNames = (sess?.entities ?? [])
      .filter((e) => e.kind === "business_name")
      .map((e) => e.canonical);
    expect(presentedNames).not.toContain("ring 1");
    expect(presentedNames).not.toContain("ring 2");
    expect(presentedNames).toContain("warung x");
  });
});

// ─── Vertical-switch: accommodation → commerce ───────────────

describe("3.41.h · accommodation → commerce clears currentReference and prunes accommodation entities", () => {
  it("accommodation reference does NOT leak into commerce", async () => {
    wire([], [fakeProduct("Ring 1","p1")], [fakeHotel("Alpha Inn","a1"), fakeHotel("Beta Hotel","a2"), fakeHotel("Gamma Suites","a3")]);
    const cid = "h-a-to-c";
    await drive(cid, "find me a hotel near Malioboro");
    await drive(cid, "the second one");
    expect(getSession(cid)?.currentReference?.business?.canonical).toContain("beta hotel");

    await drive(cid, "find me some jewellery");
    const sess = getSession(cid);
    // Cleared reference: business should be undefined OR at minimum not point at beta hotel
    expect(sess?.currentReference?.business?.canonical ?? "").not.toContain("beta hotel");
    expect(sess?.currentReference?.resolved).not.toBe(true);
    const presentedNames = (sess?.entities ?? [])
      .filter((e) => e.kind === "business_name")
      .map((e) => e.canonical);
    expect(presentedNames).not.toContain("beta hotel");
    expect(presentedNames).not.toContain("alpha inn");
    expect(presentedNames).toContain("ring 1");
  });
});

// ─── Same-vertical preserves reference ──────────────────────

describe("3.41.h · same-vertical does NOT clear the reference", () => {
  it("food → food (refinement) preserves the food reference", async () => {
    wire([fakeRestaurant("Alpha","f1"), fakeRestaurant("Beta","f2"), fakeRestaurant("Gamma","f3")]);
    const cid = "h-f-to-f";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    expect(getSession(cid)?.currentReference?.business?.canonical).toBe("beta");
    // Another food turn (refinement · same vertical)
    await drive(cid, "Somewhere around Malioboro");
    // Reference should still be Beta (preserved · we didn't switch vertical)
    expect(getSession(cid)?.currentReference?.business?.canonical).toBe("beta");
  });

  it("commerce → commerce preserves the commerce reference", async () => {
    wire([], [fakeProduct("Ring 1","p1"), fakeProduct("Ring 2","p2")]);
    const cid = "h-c-to-c";
    await drive(cid, "find me some jewellery");
    await drive(cid, "the first one");
    expect(getSession(cid)?.currentReference?.business?.canonical).toBe("ring 1");
    await drive(cid, "Something not too expensive");
    expect(getSession(cid)?.currentReference?.business?.canonical).toBe("ring 1");
  });
});

// ─── No invention · fail-closed after switch ────────────────

describe("3.41.h · no invented reference after switch", () => {
  it("after switch to commerce · currentReference stays unresolved (no auto-pick commerce #1)", async () => {
    wire([fakeRestaurant("A","f1"), fakeRestaurant("B","f2"), fakeRestaurant("C","f3")], [fakeProduct("R1","p1"), fakeProduct("R2","p2")]);
    const cid = "h-noinvent";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    await drive(cid, "find me some jewellery");
    const sess = getSession(cid);
    expect(sess?.currentReference?.resolved).not.toBe(true);
    // No auto-pick of commerce #1 · reference is honestly empty
    expect(sess?.currentReference?.business?.canonical).toBeUndefined();
  });
});

// ─── Action after switch cannot target prior vertical entity ─

describe("3.41.h · post-switch action gate cannot target the prior vertical's entity", () => {
  it("after food→commerce switch · 'message them' with no fresh commerce reference does NOT mint a proposal targeting Warung B", async () => {
    wire([fakeRestaurant("Warung A","f1"), fakeRestaurant("Warung B","f2")], [fakeProduct("Ring 1","p1")]);
    const cid = "h-action-safety";
    await drive(cid, "Maybe dinner");
    await drive(cid, "the second one");
    // At this point currentReference = Warung B
    await drive(cid, "find me some jewellery");
    // Switch has cleared the food reference · commerce turn didn't
    // include a reference (just discovery).
    await drive(cid, "message them");
    const sess = getSession(cid);
    // If any proposal minted, it MUST NOT target Warung B (food entity)
    if (sess?.pendingProposal) {
      expect(sess.pendingProposal.target.canonical.toLowerCase()).not.toContain("warung b");
    }
    // Adapter must not have fired for a food entity
    expect(waCallCount.value).toBe(0);
  });
});

// ─── Regression · accommodation reference behaviour unchanged ─

describe("3.41.h · accommodation-only flow still resolves references cleanly", () => {
  it("full accommodation flow (find → the second) still works exactly as 3.41.d shipped", async () => {
    wire([], [], [fakeHotel("Alpha Inn","a1"), fakeHotel("Beta Hotel","a2"), fakeHotel("Gamma Suites","a3")]);
    const cid = "h-acc-regress";
    await drive(cid, "find me a hotel near Malioboro");
    await drive(cid, "the second one");
    expect(getSession(cid)?.currentReference?.business?.canonical).toContain("beta hotel");
  });
});

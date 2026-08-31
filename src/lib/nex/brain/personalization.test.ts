// Stage 3.27 · Phase 20 · Personalization unit tests.

import { describe, it, expect } from "vitest";
import { decidePersonalization } from "./personalization";
import type { LongTermPreferences } from "./long-term-memory";

const NOW = Date.now();

function ltm(overrides: Partial<LongTermPreferences> = {}): LongTermPreferences {
  return {
    userId: "u1", createdAt: NOW, updatedAt: NOW, interactionCount: 3,
    locationPreference: { canonical: "yogyakarta", count: 3 },
    typePreference: { canonical: "hotel", count: 3 },
    _counts: {},
    ...overrides,
  };
}

describe("decidePersonalization · gating", () => {
  it("no LTM → none", () => {
    const r = decidePersonalization({ longTermMemory: null, isFirstAccommodationTurnThisConversation: true });
    expect(r.signal.kind).toBe("none");
    expect(r.isReturningUser).toBe(false);
  });

  it("interactionCount=1 → none (first-time)", () => {
    const r = decidePersonalization({
      longTermMemory: ltm({ interactionCount: 1 }),
      isFirstAccommodationTurnThisConversation: true,
    });
    expect(r.signal.kind).toBe("none");
    expect(r.isReturningUser).toBe(false);
  });

  it("returning user but no preferences with count ≥ 2 → none", () => {
    const r = decidePersonalization({
      longTermMemory: ltm({
        interactionCount: 2,
        locationPreference: { canonical: "yogyakarta", count: 1 },
        typePreference: undefined,
      }),
      isFirstAccommodationTurnThisConversation: true,
    });
    expect(r.signal.kind).toBe("none");
    expect(r.isReturningUser).toBe(true);
  });
});

describe("decidePersonalization · returning user with preferences", () => {
  it("fires with greeting on first accommodation turn", () => {
    const r = decidePersonalization({
      longTermMemory: ltm(),
      isFirstAccommodationTurnThisConversation: true,
    });
    expect(r.signal.kind).not.toBe("none");
    if (r.signal.kind !== "none") {
      expect(r.signal.greeting).toBeTruthy();
      expect(r.signal.greeting?.toLowerCase()).toContain("welcome back");
      expect(r.signal.greeting?.toLowerCase()).toContain("yogyakarta");
      expect(r.signal.greeting?.toLowerCase()).toContain("hotel");
      expect(r.signal.preferences.length).toBeGreaterThan(0);
    }
  });

  it("fires WITHOUT greeting on subsequent turn (spam prevention)", () => {
    const r = decidePersonalization({
      longTermMemory: ltm(),
      isFirstAccommodationTurnThisConversation: false,
    });
    expect(r.signal.kind).not.toBe("none");
    if (r.signal.kind !== "none") {
      expect(r.signal.greeting).toBeUndefined();
      expect(r.signal.preferences.length).toBeGreaterThan(0);
    }
  });

  it("kind=preference_reinforced when current slot matches LTM preference", () => {
    const r = decidePersonalization({
      longTermMemory: ltm(),
      currentSlots: { location: "yogyakarta", type: "hotel" },
      isFirstAccommodationTurnThisConversation: true,
    });
    expect(r.signal.kind).toBe("preference_reinforced");
    if (r.signal.kind === "preference_reinforced") {
      const locPref = r.signal.preferences.find((p) => p.dimension === "location");
      expect(locPref?.reinforcedByCurrentTurn).toBe(true);
    }
  });

  it("kind=returning_user_ack when current slots don't match LTM prefs", () => {
    const r = decidePersonalization({
      longTermMemory: ltm(),
      currentSlots: { location: "bali", type: "villa" },
      isFirstAccommodationTurnThisConversation: true,
    });
    expect(r.signal.kind).toBe("returning_user_ack");
  });
});

describe("decidePersonalization · preferences list", () => {
  it("filters out preferences below count threshold", () => {
    const r = decidePersonalization({
      longTermMemory: ltm({
        interactionCount: 5,
        locationPreference: { canonical: "yogyakarta", count: 5 },
        typePreference: { canonical: "hotel", count: 1 }, // below threshold
        budgetPreference: { canonical: "budget", count: 3 },
      }),
      isFirstAccommodationTurnThisConversation: true,
    });
    if (r.signal.kind !== "none") {
      const dims = r.signal.preferences.map((p) => p.dimension);
      expect(dims).toContain("location");
      expect(dims).toContain("budget");
      expect(dims).not.toContain("type"); // filtered by count<2
    }
  });

  it("never fabricates dimensions the LTM doesn't hold", () => {
    const r = decidePersonalization({
      longTermMemory: ltm({
        interactionCount: 4,
        locationPreference: { canonical: "yogyakarta", count: 4 },
        typePreference: undefined,
        budgetPreference: undefined,
        areaPreference: undefined,
      }),
      isFirstAccommodationTurnThisConversation: true,
    });
    if (r.signal.kind !== "none") {
      expect(r.signal.preferences).toHaveLength(1);
      expect(r.signal.preferences[0].dimension).toBe("location");
    }
  });
});

describe("decidePersonalization · greeting content", () => {
  it("greeting mentions each preference at least once", () => {
    const r = decidePersonalization({
      longTermMemory: ltm({
        interactionCount: 4,
        locationPreference: { canonical: "yogyakarta", count: 4 },
        typePreference: { canonical: "guesthouse", count: 3 },
        budgetPreference: { canonical: "budget", count: 3 },
      }),
      isFirstAccommodationTurnThisConversation: true,
    });
    if (r.signal.kind !== "none" && r.signal.greeting) {
      expect(r.signal.greeting.toLowerCase()).toContain("yogyakarta");
      expect(r.signal.greeting.toLowerCase()).toContain("guesthouse");
      expect(r.signal.greeting.toLowerCase()).toContain("budget");
    }
  });
});

// src/lib/nex-native/business/__tests__/engine.test.ts
//
// NEX Business Experience · engine smoke tests.
// Rev 6 FROZEN · 2026-10-02.
//
// This suite is the first adversarial check that the architecture holds
// end-to-end. It covers:
//
//   · Finding #4 · naming discipline is enforced (available ≠ recommended ≠ enabled)
//   · Finding #7 · two-tier feasibility (enabled + ready + content present)
//   · Hard invariant · universal availability (no subtype gates availability)
//   · Owner override · survives subtype change
//   · 3 of the 15 daily-business scenarios (restaurant, hotel+restaurant, nail artist+products)
//
// The suite does NOT yet cover all 15 scenarios · additional tests land as
// the content tables, cover rendering, and management UIs come online.

import { describe, expect, test } from "vitest";

import {
  AVAILABLE_CAPABILITIES,
  getAvailableCapabilities,
  getEnabledCapabilities,
  getFeasibleCapabilities,
  getRecommendedCapabilities,
  isCapabilityReady,
} from "../capabilities";
import {
  AVAILABLE_CONTENT_TYPES,
  getAvailableContentTypes,
  getEnabledContentTypes,
  getRecommendedContentTypes,
} from "../content";
import { computeEffectiveBusinessState } from "../engine";
import { resolvePrimaryCta } from "../cta";
import type { BusinessEngineInput, BusinessProfile, CapabilityKey, ContentTypeKey } from "../types";

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function mkInput(partial: Partial<BusinessEngineInput> = {}): BusinessEngineInput {
  return {
    owner_state: {
      profile: null,
      capability_overrides: {},
      content_overrides: {},
      terminology_overrides: {},
      documentary_evidence: {},
      cta_preference: null,
      ...(partial.owner_state ?? {}),
    },
    capability_data: partial.capability_data ?? {},
    content_counts: partial.content_counts ?? {},
  };
}

function profileOf(primary: { category: BusinessEngineInput["owner_state"]["profile"] extends infer _T ? never : never }): never {
  // guard · never used · forces callers to use mkProfile
  throw new Error("use mkProfile");
}
void profileOf; // satisfy lint

function mkProfile(primarySubtype: string, secondary: readonly string[] = []): BusinessProfile {
  const categoryOf = (st: string) => {
    if (["restaurant","cafe","bakery","food_maker","catering","drinks","food_delivery"].includes(st)) return "food" as const;
    if (["hotel","villa","guesthouse","homestay","resort","short_rental"].includes(st)) return "accommodation" as const;
    if (["for_sale","for_rent","developer","agent"].includes(st)) return "property" as const;
    if (["retail","manufacturer","wholesale","local_artisan","exporter"].includes(st)) return "products" as const;
    return "services" as const;
  };
  return {
    primary: { category: categoryOf(primarySubtype), subtype: primarySubtype as never },
    secondary: secondary.map((st) => ({ category: categoryOf(st), subtype: st as never })),
  };
}

// =============================================================================
// Hard invariant · universal availability
// =============================================================================

describe("Hard invariant · universal availability (never gated by subtype)", () => {
  test("every content type is available on every subtype", () => {
    const subtypes = [
      "hotel", "villa", "restaurant", "beauty", "trade_construction",
      "for_sale", "manufacturer", "events", "creative",
    ];
    const universal = new Set(getAvailableContentTypes());
    expect(universal.size).toBe(AVAILABLE_CONTENT_TYPES.length);
    for (const _subtype of subtypes) {
      // AVAILABLE is subtype-independent · the function doesn't even take a subtype
      const seen = new Set(getAvailableContentTypes());
      expect(seen).toEqual(universal);
    }
  });

  test("every capability is available on every subtype", () => {
    const universal = new Set(getAvailableCapabilities());
    expect(universal.size).toBe(AVAILABLE_CAPABILITIES.length);
    // The function has no subtype parameter · by signature, availability
    // cannot be gated by subtype. This is the architectural defence.
    expect(getAvailableCapabilities()).toEqual(AVAILABLE_CAPABILITIES);
  });
});

// =============================================================================
// Finding #4 · naming discipline
// =============================================================================

describe("Finding #4 · naming discipline (available ≠ recommended ≠ enabled)", () => {
  test("available, recommended, enabled are three distinct sets on a food/cafe", () => {
    const input = mkInput({ owner_state: { profile: mkProfile("cafe"),
      capability_overrides: {}, content_overrides: {}, terminology_overrides: {},
      documentary_evidence: {}, cta_preference: null } });
    const state = computeEffectiveBusinessState(input);

    // Available > Recommended (strictly; cafe doesn't recommend every capability)
    expect(state.availableCapabilities.length).toBeGreaterThan(state.recommendedCapabilities.length);
    // Recommended > 0 (cafe DOES recommend something)
    expect(state.recommendedCapabilities.length).toBeGreaterThan(0);
    // Enabled ≈ recommended (no owner overrides yet)
    expect(state.enabledCapabilities.size).toBe(state.recommendedCapabilities.length);
  });

  test("owner can enable a capability that was NOT recommended for their subtype", () => {
    // Hotel owner enables `appointments` (not in hotel's recommendation).
    const input = mkInput({ owner_state: {
      profile: mkProfile("hotel"),
      capability_overrides: { appointments: true },
      content_overrides: {},
      terminology_overrides: {},
      documentary_evidence: {},
      cta_preference: null,
    }});
    const state = computeEffectiveBusinessState(input);

    expect(state.recommendedCapabilities.includes("appointments" as CapabilityKey)).toBe(false);
    expect(state.enabledCapabilities.has("appointments" as CapabilityKey)).toBe(true);
  });

  test("owner can disable a capability that WAS recommended for their subtype", () => {
    // Restaurant disables `dine_in` (they're takeaway-only).
    const input = mkInput({ owner_state: {
      profile: mkProfile("restaurant"),
      capability_overrides: { dine_in: false },
      content_overrides: {}, terminology_overrides: {}, documentary_evidence: {},
      cta_preference: null,
    }});
    const state = computeEffectiveBusinessState(input);

    expect(state.recommendedCapabilities.includes("dine_in" as CapabilityKey)).toBe(true);
    expect(state.enabledCapabilities.has("dine_in" as CapabilityKey)).toBe(false);
  });

  test("content: owner can enable a content type that was NOT recommended for their subtype", () => {
    // Hotel enables Product (branded towels).
    const input = mkInput({ owner_state: {
      profile: mkProfile("hotel"),
      capability_overrides: {},
      content_overrides: { product: true },
      terminology_overrides: {}, documentary_evidence: {},
      cta_preference: null,
    }});
    const state = computeEffectiveBusinessState(input);

    expect(state.recommendedContentTypes.includes("product" as ContentTypeKey)).toBe(false);
    expect(state.enabledContentTypes.has("product" as ContentTypeKey)).toBe(true);
  });
});

// =============================================================================
// Finding #5 · owner override survives subtype change
// =============================================================================

describe("Finding #5 · owner override survives subtype change", () => {
  test("capability override persists across subtype change", () => {
    // Start as restaurant with appointments explicitly ON (chef's table)
    const starting = mkInput({ owner_state: {
      profile: mkProfile("restaurant"),
      capability_overrides: { appointments: true },
      content_overrides: {}, terminology_overrides: {}, documentary_evidence: {},
      cta_preference: null,
    }});
    expect(computeEffectiveBusinessState(starting).enabledCapabilities.has("appointments")).toBe(true);

    // Change subtype to beauty (where appointments IS recommended)
    const afterChange: BusinessEngineInput = {
      ...starting,
      owner_state: { ...starting.owner_state, profile: mkProfile("beauty") },
    };
    expect(computeEffectiveBusinessState(afterChange).enabledCapabilities.has("appointments")).toBe(true);
    // Change subtype to automotive (also recommends appointments)
    const afterSecondChange: BusinessEngineInput = {
      ...starting,
      owner_state: { ...starting.owner_state, profile: mkProfile("automotive") },
    };
    expect(computeEffectiveBusinessState(afterSecondChange).enabledCapabilities.has("appointments")).toBe(true);
  });
});

// =============================================================================
// Finding #7 · two-tier feasibility (enabled + ready + content present)
// =============================================================================

describe("Finding #7 · two-tier feasibility (enabled + ready + content present)", () => {
  test("isCapabilityReady: local_delivery flagged ON but no zones configured → NOT ready", () => {
    const input = mkInput({
      owner_state: { profile: mkProfile("restaurant"),
        capability_overrides: { local_delivery: true },
        content_overrides: {}, terminology_overrides: {},
        documentary_evidence: {}, cta_preference: null },
      capability_data: {}, // no delivery_zones
    });
    expect(isCapabilityReady("local_delivery", input)).toBe(false);
  });

  test("isCapabilityReady: local_delivery with zones configured → ready", () => {
    const input = mkInput({
      owner_state: { profile: mkProfile("restaurant"),
        capability_overrides: { local_delivery: true },
        content_overrides: {}, terminology_overrides: {},
        documentary_evidence: {}, cta_preference: null },
      capability_data: { local_delivery: { delivery_zones: [{ name: "Dalam Kota", fee: 10000 }] } },
    });
    expect(isCapabilityReady("local_delivery", input)).toBe(true);
  });

  test("Owner-preferred CTA `book` on a NEX with no accommodation units → falls through", () => {
    const input = mkInput({
      owner_state: {
        profile: mkProfile("hotel"),
        capability_overrides: { room_booking: true, enquiry_contact: true },
        content_overrides: {},
        terminology_overrides: {},
        documentary_evidence: {},
        cta_preference: "book",
      },
      capability_data: {
        room_booking: { check_in_time: "14:00", check_out_time: "11:00" },
      },
      content_counts: {}, // no accommodation_unit rows yet
    });
    const cta = resolvePrimaryCta(input, ["hotel"]);
    // `book` is infeasible (no accommodation_unit items), falls through.
    expect(cta.intent).not.toBe("book");
    expect(cta.source).not.toBe("owner_preference");
    // enquire is feasible (enquiry_contact enabled + ready).
    expect(cta.intent).toBe("enquire");
    expect(cta.feasible).toBe(true);
  });

  test("Order CTA requires at least one actual orderable item, not just an enabled content type", () => {
    const input = mkInput({
      owner_state: {
        profile: mkProfile("cafe"),
        capability_overrides: { pickup: true, enquiry_contact: true },
        content_overrides: {},
        terminology_overrides: {},
        documentary_evidence: {},
        cta_preference: null,
      },
      capability_data: {},
      content_counts: {}, // no menu_item rows
    });
    const feasible = getFeasibleCapabilities(input, ["cafe"]);
    expect(feasible.has("pickup")).toBe(true); // pickup is ready
    const cta = resolvePrimaryCta(input, ["cafe"]);
    // order needs menu/product/offer rows with items. None exist → NOT order.
    expect(cta.intent).not.toBe("order");
    expect(cta.intent).toBe("enquire");
  });
});

// =============================================================================
// 3 of the 15 daily-business-reality scenarios
// =============================================================================

describe("Daily-business scenarios · subset validation", () => {
  test("Scenario 1 · Restaurant with local delivery · CTA = order", () => {
    const input = mkInput({
      owner_state: {
        profile: mkProfile("restaurant"),
        capability_overrides: {},
        content_overrides: {},
        terminology_overrides: {},
        documentary_evidence: {},
        cta_preference: null,
      },
      capability_data: {
        local_delivery: { delivery_zones: [{ name: "Dalam Kota", fee: 10000 }] },
      },
      content_counts: { menu_item: 25 },
    });
    const state = computeEffectiveBusinessState(input);
    expect(state.enabledContentTypes.has("menu_item")).toBe(true);
    expect(state.enabledCapabilities.has("local_delivery")).toBe(true);
    expect(state.enabledCapabilities.has("dine_in")).toBe(true);
    expect(state.cta.intent).toBe("order");
    expect(state.cta.feasible).toBe(true);
  });

  test("Scenario 3 · Hotel + restaurant · one NEX, both content types ENABLED, CTA = book", () => {
    const input = mkInput({
      owner_state: {
        profile: mkProfile("hotel", ["restaurant"]),
        capability_overrides: {},
        content_overrides: {},
        terminology_overrides: {},
        documentary_evidence: {},
        cta_preference: null,
      },
      capability_data: {
        room_booking: { check_in_time: "14:00", check_out_time: "11:00" },
      },
      content_counts: { accommodation_unit: 48, menu_item: 20 },
    });
    const state = computeEffectiveBusinessState(input);

    // Both content types enabled (hotel + restaurant each contribute recommendations).
    expect(state.enabledContentTypes.has("accommodation_unit")).toBe(true);
    expect(state.enabledContentTypes.has("menu_item")).toBe(true);

    // Both booking + dine-in capabilities enabled.
    expect(state.enabledCapabilities.has("room_booking")).toBe(true);
    expect(state.enabledCapabilities.has("dine_in")).toBe(true);

    // Primary CTA driven by primary profile (hotel) → book.
    expect(state.cta.intent).toBe("book");
  });

  test("Scenario 7 · Nail artist + products · services/beauty primary, products/local_artisan secondary", () => {
    const input = mkInput({
      owner_state: {
        profile: mkProfile("beauty", ["local_artisan"]),
        capability_overrides: {},
        content_overrides: {},
        terminology_overrides: {},
        documentary_evidence: {},
        cta_preference: null,
      },
      capability_data: {
        appointments: { duration: 60, booking_window: 30 },
      },
      content_counts: { service: 12, product: 8 },
    });
    const state = computeEffectiveBusinessState(input);

    // Both content types enabled (union of recommendations).
    expect(state.enabledContentTypes.has("service")).toBe(true);
    expect(state.enabledContentTypes.has("product")).toBe(true);

    // Appointments ready (duration + booking_window present).
    expect(state.enabledCapabilities.has("appointments")).toBe(true);
    expect(state.feasibleCapabilities.has("appointments")).toBe(true);

    // Primary CTA driven by primary subtype (beauty) → appointment.
    expect(state.cta.intent).toBe("appointment");
  });
});

// =============================================================================
// Hidden-permission defence · catalogs have no subtype parameter
// =============================================================================

describe("Hidden-permission defence · catalog signatures prove universality", () => {
  test("getAvailableCapabilities has no subtype parameter (compile-time guarantee)", () => {
    // If this test compiles AND calls the function with no args, the catalog
    // is universal by signature. Any PR that adds a subtype parameter here
    // breaks this test and surfaces the doctrine violation.
    const _unused = getAvailableCapabilities();
    expect(Array.isArray(_unused)).toBe(true);
  });

  test("getAvailableContentTypes has no subtype parameter (compile-time guarantee)", () => {
    const _unused = getAvailableContentTypes();
    expect(Array.isArray(_unused)).toBe(true);
  });

  test("getRecommendedCapabilities REQUIRES subtypes (it would be a bug if it worked without)", () => {
    const empty = getRecommendedCapabilities([]);
    expect(empty).toEqual([]); // empty subtypes → empty recommendations
    const forCafe = getRecommendedCapabilities(["cafe"]);
    expect(forCafe.length).toBeGreaterThan(0);
  });

  test("getRecommendedContentTypes REQUIRES subtypes (it would be a bug if it worked without)", () => {
    const empty = getRecommendedContentTypes([]);
    expect(empty).toEqual([]);
    const forHotel = getRecommendedContentTypes(["hotel"]);
    expect(forHotel.length).toBeGreaterThan(0);
  });

  test("getEnabledCapabilities for an empty profile is empty (no overrides, no recs)", () => {
    const input = mkInput();
    const enabled = getEnabledCapabilities(input, []);
    expect(enabled.size).toBe(0);
  });

  test("getEnabledContentTypes for an empty profile is empty", () => {
    const input = mkInput();
    const enabled = getEnabledContentTypes(input, []);
    expect(enabled.size).toBe(0);
  });
});

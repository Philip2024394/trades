// src/lib/nex-native/directory/owner-claim/__tests__/schema.test.ts
//
// NEX Directory · Owner Claim · pure validator tests.
//
// Scope
//   · validateClaimDraft is deterministic + pure (no DB / net / clock)
//   · Each `kind` validator has one accept + one reject assertion
//   · No fabrication: empty critical fields are REJECTED with a path
//
// This test file does NOT:
//   · Import "server-only" (schema.ts is environment-neutral)
//   · Touch the DB, network, filesystem, clock, or randomness
//   · Depend on draft-storage.ts or actions.ts

import { describe, expect, it } from "vitest";
import { validateClaimDraft } from "../schema";
import {
  emptyDraft,
  type OwnerClaimDraft,
  type OpeningHoursInput,
} from "../types";

// ─── Small fixture helpers ─────────────────────────────────────────

function monFridayHours(open: string, close: string): OpeningHoursInput[] {
  return [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day: d as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    closed: d > 5,
    open: d <= 5 ? open : "",
    close: d <= 5 ? close : "",
  }));
}

// ═════════════════════════════════════════════════════════════════════
// §1 · determinism + purity
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · determinism and purity", () => {
  it("returns the same result on repeated calls with same input", () => {
    const draft: OwnerClaimDraft = {
      kind: "food",
      cuisines: ["Indonesian"],
      dietary: [],
      menuSections: [],
      openingHours: monFridayHours("08:00", "22:00"),
    };
    const a = validateClaimDraft(draft);
    const b = validateClaimDraft(draft);
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
  });

  it("does not mutate the input draft", () => {
    const draft: OwnerClaimDraft = emptyDraft("food");
    const snapshot = JSON.stringify(draft);
    validateClaimDraft(draft);
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it("rejects a draft with an unknown kind", () => {
    const bad = { kind: "spaceship" } as unknown as OwnerClaimDraft;
    const result = validateClaimDraft(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toBe("kind");
    }
  });

  it("rejects a non-object input", () => {
    const bad = null as unknown as OwnerClaimDraft;
    const result = validateClaimDraft(bad);
    expect(result.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · food validator
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · food", () => {
  it("rejects an entirely empty food draft", () => {
    const draft: OwnerClaimDraft = emptyDraft("food");
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "food"),
      ).toBe(true);
    }
  });

  it("accepts a food draft with only cuisines + opening hours", () => {
    const draft: OwnerClaimDraft = {
      kind: "food",
      cuisines: ["Indonesian", "Padang"],
      dietary: [],
      menuSections: [],
      openingHours: monFridayHours("09:00", "21:00"),
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(true);
  });

  it("rejects a food draft with a negative menu-item price", () => {
    const draft: OwnerClaimDraft = {
      kind: "food",
      cuisines: ["Indonesian"],
      dietary: [],
      menuSections: [{
        label: "Mains",
        items: [{ name: "Nasi Goreng", price: -1 }],
      }],
      openingHours: monFridayHours("10:00", "22:00"),
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => /price/i.test(e.message)),
      ).toBe(true);
    }
  });

  it("rejects a food draft with an invalid HH:MM opening hour", () => {
    const draft: OwnerClaimDraft = {
      kind: "food",
      cuisines: ["Cafe"],
      dietary: [],
      menuSections: [],
      openingHours: [
        { day: 1, closed: false, open: "25:00", close: "22:00" },
        { day: 2, closed: true, open: "", close: "" },
        { day: 3, closed: true, open: "", close: "" },
        { day: 4, closed: true, open: "", close: "" },
        { day: 5, closed: true, open: "", close: "" },
        { day: 6, closed: true, open: "", close: "" },
        { day: 7, closed: true, open: "", close: "" },
      ],
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
  });

  it("rejects an unrecognised dietary flag", () => {
    const draft: OwnerClaimDraft = {
      kind: "food",
      cuisines: ["Cafe"],
      // intentionally invalid enum value
      dietary: ["invented_flag" as never],
      menuSections: [],
      openingHours: monFridayHours("09:00", "17:00"),
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => /dietary/i.test(e.path)),
      ).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · accommodation validator
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · accommodation", () => {
  it("rejects an accommodation draft with zero room types", () => {
    const draft: OwnerClaimDraft = emptyDraft("accommodation");
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "roomTypes"),
      ).toBe(true);
    }
  });

  it("accepts an accommodation draft with one labelled room type", () => {
    const draft: OwnerClaimDraft = {
      kind: "accommodation",
      roomTypes: [{ label: "Deluxe Twin", count: 4, nightlyRate: 450000, maxOccupancy: 2 }],
      facilities: ["wifi", "parking", "pool"],
      description: "Family-run guesthouse near the beach.",
      airportDistance: "35 km",
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(true);
  });

  it("rejects an unrecognised facility", () => {
    const draft: OwnerClaimDraft = {
      kind: "accommodation",
      roomTypes: [{ label: "Standard", count: 1, nightlyRate: 200000, maxOccupancy: 2 }],
      // intentionally invalid enum value
      facilities: ["helipad" as never],
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => /facilities/i.test(e.path)),
      ).toBe(true);
    }
  });

  it("rejects a description longer than 2000 characters", () => {
    const draft: OwnerClaimDraft = {
      kind: "accommodation",
      roomTypes: [{ label: "Dorm", count: 1, nightlyRate: 100000, maxOccupancy: 6 }],
      facilities: [],
      description: "x".repeat(2001),
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · vehicle_rental validator
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · vehicle_rental", () => {
  it("accepts vehicle rental with 1 motorbike + rate", () => {
    const draft: OwnerClaimDraft = {
      kind: "vehicle_rental",
      vehicles: [{
        vehicleType: "motorbike",
        model: "Honda Scoopy 110",
        dailyRate: 75000,
        depositRequired: 500000,
      }],
      description: "Daily & weekly rentals, helmets included.",
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(true);
  });

  it("rejects a vehicle with no type chosen", () => {
    const draft: OwnerClaimDraft = {
      kind: "vehicle_rental",
      vehicles: [{
        vehicleType: "",
        model: "Something",
        dailyRate: 50000,
        depositRequired: null,
      }],
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => /vehicleType/.test(e.path)),
      ).toBe(true);
    }
  });

  it("rejects a vehicle with a non-positive daily rate", () => {
    const draft: OwnerClaimDraft = {
      kind: "vehicle_rental",
      vehicles: [{
        vehicleType: "car",
        model: "Toyota Avanza",
        dailyRate: 0,
        depositRequired: null,
      }],
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => /dailyRate/.test(e.path)),
      ).toBe(true);
    }
  });

  it("rejects terms where max rental days < min rental days", () => {
    const draft: OwnerClaimDraft = {
      kind: "vehicle_rental",
      vehicles: [{
        vehicleType: "motorbike",
        model: "Scoopy",
        dailyRate: 70000,
        depositRequired: null,
      }],
      terms: { minRentalDays: 7, maxRentalDays: 3, licenseRequired: true, deliveryAvailable: false },
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
  });

  it("rejects a draft with zero vehicles", () => {
    const draft: OwnerClaimDraft = emptyDraft("vehicle_rental");
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "vehicles"),
      ).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · service validator
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · service", () => {
  it("rejects a service draft with a blank description", () => {
    const draft: OwnerClaimDraft = emptyDraft("service");
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "description"),
      ).toBe(true);
    }
  });

  it("accepts a service draft with a 10+ char description", () => {
    const draft: OwnerClaimDraft = {
      kind: "service",
      description: "Independent plumber covering central district.",
      serviceArea: "Yogyakarta",
      priceMethod: "quote",
      operatingHours: monFridayHours("08:00", "18:00"),
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(true);
  });

  it("rejects a service description shorter than 10 chars", () => {
    const draft: OwnerClaimDraft = {
      kind: "service",
      description: "Short",
      operatingHours: monFridayHours("08:00", "18:00"),
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · transport validator
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · transport", () => {
  it("rejects a transport draft with no service types", () => {
    const draft: OwnerClaimDraft = emptyDraft("transport");
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "serviceTypes"),
      ).toBe(true);
    }
  });

  it("accepts a transport draft with at least one service type", () => {
    const draft: OwnerClaimDraft = {
      kind: "transport",
      serviceTypes: ["City ride", "Airport transfer"],
      coverage: "Yogyakarta city + Kulon Progo",
      priceMethod: "metered",
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · marketplace_seller validator
// ═════════════════════════════════════════════════════════════════════

describe("validateClaimDraft · marketplace_seller", () => {
  it("rejects a marketplace_seller draft with no product categories", () => {
    const draft: OwnerClaimDraft = emptyDraft("marketplace_seller");
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "productCategories"),
      ).toBe(true);
    }
  });

  it("accepts a marketplace_seller draft with at least one category", () => {
    const draft: OwnerClaimDraft = {
      kind: "marketplace_seller",
      productCategories: ["Batik", "Handmade bags"],
      shippingScope: "Java-wide",
    };
    const result = validateClaimDraft(draft);
    expect(result.ok).toBe(true);
  });
});

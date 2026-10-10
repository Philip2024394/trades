// src/lib/nex-native/directory/category-details/__tests__/project.test.ts
//
// NEX Directory · Category Detail Projection · pure-function tests.
//
// Covers at least 15 cases across:
//   · Null verticalPayload for each supported kind → kind-matched empty
//   · OSM-shape `cuisine: "indonesian;asian"` normalises to array
//   · OSM-shape `opening_hours: "Mo-Fr 09:00-17:00"` parses to 5 ranges
//   · Unparseable opening_hours → openingHours = []
//   · 24/7 opening_hours expands to 7 ranges
//   · Accommodation with mixed valid/invalid roomTypes
//   · Vehicle rental with vehicles array (valid + invalid dropped)
//   · Unknown entity_type (`place`, `professional`) → generic
//   · Deterministic output (byte-stable over repeated calls)

import { describe, expect, it } from "vitest";
import { projectCategoryDetails } from "../project";
import type { CategoryDetails } from "../types";
import type {
  DirectoryClassification,
  DirectoryListingVM,
  EntityType,
  LifecycleState,
} from "../../types";

// ─── Fixture helper ─────────────────────────────────────────────────

function makeListing(
  entityType: EntityType,
  verticalPayload: unknown,
  overrides: Partial<DirectoryListingVM> = {},
): DirectoryListingVM {
  const classification: DirectoryClassification =
    entityType === "transport_driver" || entityType === "professional"
      ? "person"
      : entityType === "place"
        ? "place"
        : "business";
  const base: DirectoryListingVM = {
    canonicalBusinessId: "11111111-1111-4111-8111-111111111111",
    entityType,
    classification,
    lifecycleState: "VERIFIED" as LifecycleState,
    name: "Fixture Listing",
    aliases: [],
    country: "ID",
    city: null,
    district: null,
    streetLine: null,
    neighbourhood: null,
    address: null,
    coordinates: null,
    phoneE164: null,
    websiteApex: null,
    osmId: null,
    wikidataQid: null,
    categoryIds: [],
    verticalPayload,
    primaryImage: null,
    lastVerifiedAt: null,
    supersedesBusinessId: null,
    supersededByBusinessId: null,
  };
  return { ...base, ...overrides };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Food
// ═════════════════════════════════════════════════════════════════════

describe("projectCategoryDetails · food", () => {
  it("null verticalPayload → food kind with empty arrays everywhere", () => {
    const vm = makeListing("food", null);
    const out = projectCategoryDetails(vm);
    expect(out).toEqual({
      kind: "food",
      menu: [],
      cuisines: [],
      openingHours: [],
      dietary: [],
    });
  });

  it("non-object verticalPayload (string) → food kind with empty arrays", () => {
    const vm = makeListing("food", "not-an-object");
    const out = projectCategoryDetails(vm);
    expect(out).toEqual({
      kind: "food",
      menu: [],
      cuisines: [],
      openingHours: [],
      dietary: [],
    });
  });

  it("OSM-shape `cuisine: \"indonesian;asian\"` → cuisines=['indonesian','asian']", () => {
    const vm = makeListing("food", { cuisine: "indonesian;asian" });
    const out = projectCategoryDetails(vm);
    expect(out.kind).toBe("food");
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.cuisines).toEqual(["indonesian", "asian"]);
  });

  it("owner-authored `cuisines: ['Padang','Javanese']` → preserved as array", () => {
    const vm = makeListing("food", { cuisines: ["Padang", "Javanese"] });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.cuisines).toEqual(["Padang", "Javanese"]);
  });

  it("P1 OSM shape `cuisine: 'restaurant;coffee_shop'` → ['restaurant','coffee_shop']", () => {
    const vm = makeListing("food", { cuisine: "restaurant;coffee_shop" });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.cuisines).toEqual(["restaurant", "coffee_shop"]);
  });

  it("empty-string cuisine → cuisines=[]", () => {
    const vm = makeListing("food", { cuisine: "" });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.cuisines).toEqual([]);
  });

  it("OSM `opening_hours: 'Mo-Fr 09:00-17:00'` → 5 ranges Mon-Fri 09:00-17:00", () => {
    const vm = makeListing("food", { opening_hours: "Mo-Fr 09:00-17:00" });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.openingHours).toHaveLength(5);
    expect(out.openingHours.map((r) => r.day)).toEqual([0, 1, 2, 3, 4]);
    for (const r of out.openingHours) {
      expect(r.open).toBe("09:00");
      expect(r.close).toBe("17:00");
    }
  });

  it("OSM `opening_hours: '24/7'` → 7 ranges 00:00-24:00", () => {
    const vm = makeListing("food", { opening_hours: "24/7" });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.openingHours).toHaveLength(7);
    for (const r of out.openingHours) {
      expect(r.open).toBe("00:00");
      expect(r.close).toBe("24:00");
    }
  });

  it("unparseable `opening_hours: 'sunrise to sunset'` → openingHours=[]", () => {
    const vm = makeListing("food", { opening_hours: "sunrise to sunset" });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.openingHours).toEqual([]);
  });

  it("menu with one valid section + one invalid item preserves valid items only", () => {
    const vm = makeListing("food", {
      menu: [
        {
          label: "Mains",
          items: [
            { name: "Nasi Goreng", priceFrom: { amount: 25000, currency: "IDR" } },
            { priceFrom: { amount: 10000, currency: "IDR" } }, // missing name → dropped
            { name: "", priceFrom: { amount: 10000, currency: "IDR" } }, // empty name → dropped
            { name: "Mie Goreng" }, // no price → still valid
          ],
        },
        {
          label: "", // empty label → section dropped
          items: [{ name: "Soup" }],
        },
      ],
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.menu).toHaveLength(1);
    expect(out.menu[0].label).toBe("Mains");
    expect(out.menu[0].items.map((i) => i.name)).toEqual([
      "Nasi Goreng",
      "Mie Goreng",
    ]);
    expect(out.menu[0].items[0].priceFrom).toEqual({
      amount: 25000,
      currency: "IDR",
    });
    expect(out.menu[0].items[1].priceFrom).toBeUndefined();
  });

  it("dietary flags: unknown values dropped, known values deduped", () => {
    const vm = makeListing("food", {
      dietary: ["halal", "vegan", "unknown", "halal", "pork_free"],
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "food") throw new Error("narrow");
    expect(out.dietary).toEqual(["halal", "vegan", "pork_free"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Accommodation
// ═════════════════════════════════════════════════════════════════════

describe("projectCategoryDetails · accommodation", () => {
  it("null verticalPayload → accommodation kind with empty arrays", () => {
    const vm = makeListing("accommodation", null);
    const out = projectCategoryDetails(vm);
    expect(out).toEqual({
      kind: "accommodation",
      roomTypes: [],
      facilities: [],
    });
  });

  it("roomTypes mixed valid/invalid: only validated shapes emitted", () => {
    const vm = makeListing("accommodation", {
      roomTypes: [
        {
          slug: "deluxe",
          label: "Deluxe Double",
          occupancy: 2,
          bedConfiguration: "double",
          bathroom: "ensuite",
          priceFrom: { amount: 650000, currency: "IDR" },
        },
        {
          // missing label
          slug: "noname",
          occupancy: 1,
        },
        {
          slug: "family",
          label: "Family Suite",
          occupancy: 4,
          bedConfiguration: "family",
          bathroom: "ensuite",
          photos: ["https://cdn/room1.jpg", "https://cdn/room2.jpg"],
        },
        {
          slug: "weird",
          label: "Weird",
          occupancy: "two" as unknown as number, // bad type → occupancy drops to null
          bedConfiguration: "waterbed" as unknown as string, // not in enum → null
          bathroom: "jacuzzi" as unknown as string, // not in enum → null
        },
      ],
      facilities: ["wifi", "pool", "unknown_facility", "wifi", "spa"],
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "accommodation") throw new Error("narrow");
    expect(out.roomTypes).toHaveLength(3);
    expect(out.roomTypes[0].slug).toBe("deluxe");
    expect(out.roomTypes[0].priceFrom).toEqual({
      amount: 650000,
      currency: "IDR",
    });
    expect(out.roomTypes[1].slug).toBe("family");
    expect(out.roomTypes[1].photos).toHaveLength(2);
    expect(out.roomTypes[2].occupancy).toBeNull();
    expect(out.roomTypes[2].bedConfiguration).toBeNull();
    expect(out.roomTypes[2].bathroom).toBeNull();
    // facilities: unknown dropped, duplicates deduped
    expect(out.facilities).toEqual(["wifi", "pool", "spa"]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Vehicle rental
// ═════════════════════════════════════════════════════════════════════

describe("projectCategoryDetails · vehicle_rental", () => {
  it("null payload → empty vehicles + null terms", () => {
    const vm = makeListing("vehicle_rental", null);
    const out = projectCategoryDetails(vm);
    expect(out).toEqual({ kind: "vehicle_rental", vehicles: [], terms: null });
  });

  it("vehicles: valid motorbike + scooter + invalid dropped", () => {
    const vm = makeListing("vehicle_rental", {
      vehicles: [
        {
          vehicleType: "motorbike",
          model: "Honda Scoopy",
          transmission: "automatic",
          capacity: 2,
          dailyRate: { amount: 75000, currency: "IDR" },
          depositRequired: { amount: 500000, currency: "IDR" },
          includedEquipment: ["helmet", "lock"],
          licenceRequired: "SIM C",
        },
        {
          vehicleType: "scooter",
        },
        {
          vehicleType: "spaceship", // not in enum → dropped
        },
        {
          // missing vehicleType entirely → dropped
          model: "Mystery",
        },
      ],
      terms: {
        minHours: 24,
        maxDays: 30,
        delivery: true,
        cancellation: "48h notice for refund",
      },
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "vehicle_rental") throw new Error("narrow");
    expect(out.vehicles).toHaveLength(2);
    expect(out.vehicles[0].vehicleType).toBe("motorbike");
    expect(out.vehicles[0].dailyRate).toEqual({
      amount: 75000,
      currency: "IDR",
    });
    expect(out.vehicles[0].includedEquipment).toEqual(["helmet", "lock"]);
    expect(out.vehicles[1].vehicleType).toBe("scooter");
    expect(out.terms).not.toBeNull();
    expect(out.terms?.minHours).toBe(24);
    expect(out.terms?.delivery).toBe(true);
  });

  it("terms object with only `delivery:null` field is kept honestly", () => {
    const vm = makeListing("vehicle_rental", {
      vehicles: [],
      terms: { delivery: null },
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "vehicle_rental") throw new Error("narrow");
    expect(out.terms).toEqual({ delivery: null });
  });

  it("empty terms object → null (no fabricated structure)", () => {
    const vm = makeListing("vehicle_rental", { terms: {} });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "vehicle_rental") throw new Error("narrow");
    expect(out.terms).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Service / Transport / Marketplace / Generic
// ═════════════════════════════════════════════════════════════════════

describe("projectCategoryDetails · service", () => {
  it("null payload → every field null/empty", () => {
    const vm = makeListing("service", null);
    const out = projectCategoryDetails(vm);
    expect(out).toEqual({
      kind: "service",
      description: null,
      serviceArea: null,
      priceMethod: null,
      operatingHours: [],
    });
  });

  it("populated payload with structured operating_hours_ranges", () => {
    const vm = makeListing("service", {
      description: "Mobile motorbike repair across central Yogyakarta",
      serviceArea: "Central Yogyakarta",
      priceMethod: "per_job",
      operating_hours_ranges: [
        { day: 0, open: "08:00", close: "17:00" },
        { day: 6, open: "25:00", close: "26:00" }, // invalid → dropped
        { day: "monday" as unknown as number, open: "08:00", close: "17:00" }, // bad → dropped
      ],
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "service") throw new Error("narrow");
    expect(out.description).toBe(
      "Mobile motorbike repair across central Yogyakarta",
    );
    expect(out.serviceArea).toBe("Central Yogyakarta");
    expect(out.priceMethod).toBe("per_job");
    expect(out.operatingHours).toEqual([
      { day: 0, open: "08:00", close: "17:00" },
    ]);
  });

  it("unknown priceMethod value → null (no fabrication)", () => {
    const vm = makeListing("service", { priceMethod: "mystery_pricing" });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "service") throw new Error("narrow");
    expect(out.priceMethod).toBeNull();
  });
});

describe("projectCategoryDetails · transport", () => {
  it("transport_driver with null payload", () => {
    const vm = makeListing("transport_driver", null);
    const out = projectCategoryDetails(vm);
    expect(out).toEqual({
      kind: "transport",
      serviceTypes: [],
      coverage: null,
      priceMethod: null,
    });
  });

  it("transport_operator with service types + coverage", () => {
    const vm = makeListing("transport_operator", {
      serviceTypes: ["airport_transfer", "intercity_shuttle"],
      coverage: "Jogja ↔ Semarang",
      priceMethod: "metered",
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "transport") throw new Error("narrow");
    expect(out.serviceTypes).toEqual(["airport_transfer", "intercity_shuttle"]);
    expect(out.coverage).toBe("Jogja ↔ Semarang");
    expect(out.priceMethod).toBe("metered");
  });
});

describe("projectCategoryDetails · marketplace_seller", () => {
  it("product categories + shipping scope", () => {
    const vm = makeListing("marketplace_seller", {
      productCategories: ["handicrafts", "batik"],
      shippingScope: "Indonesia",
    });
    const out = projectCategoryDetails(vm);
    if (out.kind !== "marketplace_seller") throw new Error("narrow");
    expect(out.productCategories).toEqual(["handicrafts", "batik"]);
    expect(out.shippingScope).toBe("Indonesia");
  });
});

describe("projectCategoryDetails · generic (place / professional)", () => {
  it("entity_type=place → kind:generic regardless of payload", () => {
    const vm = makeListing("place", { anything: "ignored" });
    expect(projectCategoryDetails(vm)).toEqual({ kind: "generic" });
  });

  it("entity_type=professional → kind:generic", () => {
    const vm = makeListing("professional", null);
    expect(projectCategoryDetails(vm)).toEqual({ kind: "generic" });
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Determinism
// ═════════════════════════════════════════════════════════════════════

describe("projectCategoryDetails · determinism", () => {
  it("identical input → byte-stable JSON output over repeated calls", () => {
    const vm = makeListing("food", {
      cuisine: "indonesian;asian",
      opening_hours: "Mo-Fr 09:00-17:00",
      dietary: ["halal", "vegetarian"],
      menu: [
        {
          label: "Mains",
          items: [
            { name: "Nasi Goreng", priceFrom: { amount: 25000, currency: "IDR" } },
          ],
        },
      ],
    });
    const a = projectCategoryDetails(vm);
    const b = projectCategoryDetails(vm);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("projector does not mutate its input", () => {
    const payload = {
      cuisine: "indonesian;asian",
      menu: [
        { label: "Mains", items: [{ name: "Nasi Goreng" }] },
      ],
    };
    const vm = makeListing("food", payload);
    const snapshot = JSON.stringify(payload);
    projectCategoryDetails(vm);
    expect(JSON.stringify(payload)).toBe(snapshot);
  });

  it("every supported kind emits a stable `kind` discriminator string", () => {
    const expected: Record<EntityType, CategoryDetails["kind"]> = {
      food: "food",
      accommodation: "accommodation",
      vehicle_rental: "vehicle_rental",
      service: "service",
      marketplace_seller: "marketplace_seller",
      transport_driver: "transport",
      transport_operator: "transport",
      place: "generic",
      professional: "generic",
    };
    for (const et of Object.keys(expected) as EntityType[]) {
      const vm = makeListing(et, null);
      const out = projectCategoryDetails(vm);
      expect(out.kind).toBe(expected[et]);
    }
  });
});

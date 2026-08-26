// src/lib/nex-driver/vehicle-catalogue.test.ts

import { describe, it, expect } from "vitest";
import {
  composeVehicleRepresentation,
  vehicleClassLabel,
  isPremiumClass,
  entryDisplayName,
  listManufacturersFromEntries,
  listModelsForManufacturer,
  listByVehicleKind,
  vehicleKindsForJobType,
  type VehicleCatalogueEntry,
  type DriverVehicleVerification,
} from "./vehicle-catalogue";

const PCX: VehicleCatalogueEntry = {
  catalogueId: "cat-pcx",
  brand: "Honda",
  model: "PCX 160",
  vehicleClass: "motorbike_premium",
  imageRef: "img://honda-pcx-160",
  introducedAt: new Date("2024-01-01T00:00:00Z"),
  deprecatedAt: null,
  notes: null,
};

const INNOVA: VehicleCatalogueEntry = {
  catalogueId: "cat-innova",
  brand: "Toyota",
  model: "Innova",
  vehicleClass: "car_mpv",
  imageRef: "img://toyota-innova",
  introducedAt: new Date("2020-01-01T00:00:00Z"),
  deprecatedAt: null,
  notes: null,
};

const NMAX_DEPRECATED: VehicleCatalogueEntry = {
  catalogueId: "cat-nmax-old",
  brand: "Yamaha",
  model: "NMAX (2018)",
  vehicleClass: "motorbike_standard",
  imageRef: null,
  introducedAt: new Date("2018-01-01T00:00:00Z"),
  deprecatedAt: new Date("2025-01-01T00:00:00Z"),
  notes: "Superseded by newer generation entry.",
};

const CATALOGUE = [PCX, INNOVA, NMAX_DEPRECATED];
const NOW = new Date("2026-08-23T00:00:00Z");

function verifiedFor(driverId: string, catalogueId: string, classConfirmed: boolean = false, extra: Partial<DriverVehicleVerification> = {}): DriverVehicleVerification {
  return {
    verificationId: `ver-${driverId}-${catalogueId}`,
    driverId,
    catalogueId,
    state: "verified",
    submittedAt: new Date("2026-08-10T00:00:00Z"),
    verifiedAt: new Date("2026-08-12T00:00:00Z"),
    verifiedBy: "admin.1",
    classConfirmed,
    rejectedAt: null,
    rejectionReason: null,
    expiresAt: null,
    ...extra,
  };
}

describe("Vehicle catalogue · undeclared / unknown → unverified representation", () => {
  it("no declared catalogue id → unverified with 'has not declared' note", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: null,
      catalogue: CATALOGUE,
      verifications: [],
      now: NOW,
    });
    expect(r.isVerified).toBe(false);
    expect(r.brand).toBeNull();
    expect(r.vehicleClass).toBeNull();
    expect(r.unverifiedNote).toMatch(/has not declared/);
    expect(r.provenance.verificationState).toBe("no_declaration");
  });

  it("declared catalogue id not in catalogue → unverified", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-does-not-exist",
      catalogue: CATALOGUE,
      verifications: [],
      now: NOW,
    });
    expect(r.isVerified).toBe(false);
    expect(r.unverifiedNote).toMatch(/not in the current catalogue/);
  });
});

describe("Vehicle catalogue · verification state gates customer-facing brand/model", () => {
  it("verification state 'documents_submitted' → unverified representation", () => {
    const submitted: DriverVehicleVerification = {
      ...verifiedFor("d1", "cat-innova"),
      state: "documents_submitted",
      verifiedAt: null,
      verifiedBy: null,
    };
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-innova",
      catalogue: CATALOGUE,
      verifications: [submitted],
      now: NOW,
    });
    expect(r.isVerified).toBe(false);
    expect(r.brand).toBeNull();
    expect(r.provenance.verificationState).toBe("documents_submitted");
  });

  it("verified + non-premium → verified representation with brand/model", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-innova",
      catalogue: CATALOGUE,
      verifications: [verifiedFor("d1", "cat-innova")],
      now: NOW,
    });
    expect(r.isVerified).toBe(true);
    expect(r.brand).toBe("Toyota");
    expect(r.model).toBe("Innova");
    expect(r.vehicleClass).toBe("car_mpv");
    expect(r.imageRef).toBe("img://toyota-innova");
    expect(r.provenance.verifiedBy).toBe("admin.1");
  });

  it("expired verification → unverified", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-innova",
      catalogue: CATALOGUE,
      verifications: [
        verifiedFor("d1", "cat-innova", false, { expiresAt: new Date("2026-08-01T00:00:00Z") }),
      ],
      now: NOW,
    });
    expect(r.isVerified).toBe(false);
    expect(r.unverifiedNote).toMatch(/expired/);
  });
});

describe("Vehicle catalogue · premium classes require class_confirmed", () => {
  it("PCX 160 verified but class_confirmed=false → unverified with premium-class note", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-pcx",
      catalogue: CATALOGUE,
      verifications: [verifiedFor("d1", "cat-pcx", false)],
      now: NOW,
    });
    expect(r.isVerified).toBe(false);
    expect(r.unverifiedNote).toMatch(/Premium class.*requires class-confirming evidence/);
  });

  it("PCX 160 verified AND class_confirmed=true → verified premium", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-pcx",
      catalogue: CATALOGUE,
      verifications: [verifiedFor("d1", "cat-pcx", true)],
      now: NOW,
    });
    expect(r.isVerified).toBe(true);
    expect(r.brand).toBe("Honda");
    expect(r.model).toBe("PCX 160");
    expect(r.isPremiumClass).toBe(true);
  });
});

describe("Vehicle catalogue · deprecated entries surface honestly", () => {
  it("deprecated entry verified → representation flags deprecation", () => {
    const r = composeVehicleRepresentation({
      driverId: "d1",
      declaredCatalogueId: "cat-nmax-old",
      catalogue: CATALOGUE,
      verifications: [verifiedFor("d1", "cat-nmax-old", false)],
      now: NOW,
    });
    expect(r.isVerified).toBe(true);
    expect(r.isDeprecatedEntry).toBe(true);
    expect(r.unverifiedNote).toMatch(/deprecated/);
  });
});

describe("Vehicle catalogue · label + premium helpers", () => {
  it("labels are human-readable", () => {
    expect(vehicleClassLabel("motorbike_premium")).toBe("Premium motorbike");
    expect(vehicleClassLabel("car_mpv")).toBe("MPV");
    expect(vehicleClassLabel("car_premium")).toBe("Premium car");
  });

  it("premium-class predicate", () => {
    expect(isPremiumClass("motorbike_premium")).toBe(true);
    expect(isPremiumClass("car_premium_mpv")).toBe(true);
    expect(isPremiumClass("car_small")).toBe(false);
    expect(isPremiumClass("scooter")).toBe(false);
  });
});

// ── HIERARCHY + KIND + CAPACITY (new) ─────────────────────────────────

const CATALOGUE_EXT: VehicleCatalogueEntry[] = [
  {
    catalogueId: "e-pcx", brand: "Honda", model: "PCX 160", vehicleClass: "motorbike_premium",
    imageRef: null, introducedAt: new Date("2024-01-01Z"), deprecatedAt: null, notes: null,
    vehicleKind: "motorcycle", passengerCapacity: 1, luggageCapacityKg: 20, displayName: "Honda PCX 160",
  },
  {
    catalogueId: "e-vario", brand: "Honda", model: "Vario 160", variant: null, vehicleClass: "motorbike_standard",
    imageRef: null, introducedAt: new Date("2024-01-01Z"), deprecatedAt: null, notes: null,
    vehicleKind: "motorcycle", passengerCapacity: 1, luggageCapacityKg: 15,
  },
  {
    catalogueId: "e-vario-abs", brand: "Honda", model: "Vario 160", variant: "ABS", vehicleClass: "motorbike_standard",
    imageRef: null, introducedAt: new Date("2024-01-01Z"), deprecatedAt: null, notes: null,
    vehicleKind: "motorcycle", passengerCapacity: 1, luggageCapacityKg: 15,
  },
  {
    catalogueId: "e-innova", brand: "Toyota", model: "Innova", vehicleClass: "car_mpv",
    imageRef: null, introducedAt: new Date("2024-01-01Z"), deprecatedAt: null, notes: null,
    vehicleKind: "car", passengerCapacity: 7, luggageCapacityKg: 150,
  },
  {
    catalogueId: "e-alphard", brand: "Toyota", model: "Alphard", vehicleClass: "car_premium_mpv",
    imageRef: null, introducedAt: new Date("2024-01-01Z"), deprecatedAt: null, notes: null,
    vehicleKind: "car", passengerCapacity: 7, luggageCapacityKg: 200,
  },
  {
    catalogueId: "e-elf", brand: "Isuzu", model: "Elf", vehicleClass: "minibus",
    imageRef: null, introducedAt: new Date("2024-01-01Z"), deprecatedAt: null, notes: null,
    vehicleKind: "small_truck", passengerCapacity: 3, luggageCapacityKg: 2500,
  },
  {
    catalogueId: "e-deprecated", brand: "Yamaha", model: "OldModel", vehicleClass: "scooter",
    imageRef: null, introducedAt: new Date("2020-01-01Z"), deprecatedAt: new Date("2025-01-01Z"), notes: null,
    vehicleKind: "motorcycle", passengerCapacity: 1, luggageCapacityKg: 10,
  },
];

describe("Vehicle catalogue · display name derivation", () => {
  it("uses displayName when set", () => {
    expect(entryDisplayName(CATALOGUE_EXT[0])).toBe("Honda PCX 160");
  });
  it("derives from brand+model when no displayName + no variant", () => {
    expect(entryDisplayName(CATALOGUE_EXT[1])).toBe("Honda Vario 160");
  });
  it("includes variant when present + no displayName", () => {
    expect(entryDisplayName(CATALOGUE_EXT[2])).toBe("Honda Vario 160 ABS");
  });
});

describe("Vehicle catalogue · manufacturer + model + variant hierarchy", () => {
  it("listManufacturersFromEntries returns unique + sorted, skips deprecated-only manufacturers", () => {
    const mfrs = listManufacturersFromEntries(CATALOGUE_EXT);
    expect(mfrs).toContain("Honda");
    expect(mfrs).toContain("Toyota");
    expect(mfrs).toContain("Isuzu");
    expect(mfrs).toEqual([...mfrs].sort());
  });

  it("listModelsForManufacturer groups variants under one model", () => {
    const models = listModelsForManufacturer(CATALOGUE_EXT, "Honda");
    const vario = models.find((m) => m.model === "Vario 160");
    expect(vario).toBeDefined();
    expect(vario!.variants).toContain("ABS");
    // The variantless entry should not have variants merged with itself
    expect(models.map((m) => m.model)).toEqual(["PCX 160", "Vario 160"]);
  });

  it("listModelsForManufacturer omits deprecated entries", () => {
    const models = listModelsForManufacturer(CATALOGUE_EXT, "Yamaha");
    expect(models).toEqual([]);
  });

  it("listByVehicleKind filters correctly", () => {
    expect(listByVehicleKind(CATALOGUE_EXT, "motorcycle").length).toBe(3); // PCX + Vario + Vario ABS
    expect(listByVehicleKind(CATALOGUE_EXT, "car").length).toBe(2);        // Innova + Alphard
    expect(listByVehicleKind(CATALOGUE_EXT, "small_truck").length).toBe(1);
    expect(listByVehicleKind(CATALOGUE_EXT, "truck").length).toBe(0);
  });
});

describe("Vehicle catalogue · vehicleKindsForJobType (dispatch filter helper)", () => {
  it("passenger_motorbike → motorcycle only", () => {
    expect(vehicleKindsForJobType("passenger_motorbike")).toEqual(["motorcycle"]);
  });
  it("passenger_car → car/van/minibus", () => {
    expect(vehicleKindsForJobType("passenger_car")).toEqual(["car", "van", "minibus"]);
  });
  it("parcel_motorbike → motorcycle only", () => {
    expect(vehicleKindsForJobType("parcel_motorbike")).toEqual(["motorcycle"]);
  });
  it("large_goods_small_truck → small_truck only", () => {
    expect(vehicleKindsForJobType("large_goods_small_truck")).toEqual(["small_truck"]);
  });
  it("unknown job type → empty", () => {
    expect(vehicleKindsForJobType("nonsense")).toEqual([]);
  });
});

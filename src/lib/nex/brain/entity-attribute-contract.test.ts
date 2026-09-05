// src/lib/nex/brain/entity-attribute-contract.test.ts
// Universal Entity Attribute Contract · unit tests
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE

import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_CONTRACTS,
  projectAttributes,
  computeCoverage,
  findAttributeByKeyword,
  getAttributeState,
} from "./entity-attribute-contract";
import type { WorldRecord } from "./world-adapters/types";

/** Default fixture · `listed` (directory tier, unclaimed). Positive
 *  evidence on this fixture resolves to UNVERIFIED per §7. */
function makeHotel(over: Partial<WorldRecord> = {}): WorldRecord {
  const base: WorldRecord = {
    id: "AC-1",
    vertical: "accommodation",
    name: "Test Hotel",
    category: "hotel",
    city: "Yogyakarta",
    area: undefined,
    address: "Jl. Test",
    latitude: -7.79, longitude: 110.36,
    phone: undefined, whatsapp: undefined, website: undefined,
    heroImage: undefined,
    price: null, priceRange: null,
    amenities: [],
    verified: false,
    claimStatus: "listed",
    ownerStatus: "unknown",
    provenance: { sourceTier: "directory_live", sourceRef: "" },
    updatedAt: new Date().toISOString(),
  } as unknown as WorldRecord;
  return { ...base, ...over };
}

/** Owner-verified fixture · positive evidence resolves to KNOWN_YES. */
function makeVerifiedHotel(over: Partial<WorldRecord> = {}): WorldRecord {
  return makeHotel({ verified: true, claimStatus: "claimed", ownerStatus: "verified", ...over } as Partial<WorldRecord>);
}

/** Stale fixture · updatedAt older than 90 days · positive evidence
 *  resolves to STALE. */
function makeStaleHotel(over: Partial<WorldRecord> = {}): WorldRecord {
  const oldIso = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
  return makeHotel({ updatedAt: oldIso, ...over } as Partial<WorldRecord>);
}

describe("ATTRIBUTE_CONTRACTS · shape", () => {
  it("defines contracts for every vertical", () => {
    expect(ATTRIBUTE_CONTRACTS.accommodation.length).toBeGreaterThan(10);
    expect(ATTRIBUTE_CONTRACTS.food.length).toBeGreaterThan(5);
    expect(ATTRIBUTE_CONTRACTS.service.length).toBeGreaterThan(3);
    expect(ATTRIBUTE_CONTRACTS.commerce.length).toBeGreaterThan(0);
    expect(ATTRIBUTE_CONTRACTS.transport.length).toBeGreaterThan(0);
    expect(ATTRIBUTE_CONTRACTS.places.length).toBeGreaterThan(0);
  });
});

describe("projectAttributes · amenity-token evidence · UNVERIFIED default", () => {
  it("pool token on unclaimed hotel → UNVERIFIED", () => {
    const map = projectAttributes(makeHotel({ amenities: ["pool"] }));
    expect(getAttributeState(map, "pool")).toBe("UNVERIFIED");
  });
  it("pool token on owner-verified hotel → KNOWN_YES", () => {
    const map = projectAttributes(makeVerifiedHotel({ amenities: ["pool"] }));
    expect(getAttributeState(map, "pool")).toBe("KNOWN_YES");
  });
  it("swimming pool token (alias) → same resolution", () => {
    const map = projectAttributes(makeHotel({ amenities: ["Swimming Pool"] }));
    expect(getAttributeState(map, "pool")).toBe("UNVERIFIED");
  });
  it("kolam renang → same resolution (ID alias)", () => {
    const map = projectAttributes(makeHotel({ amenities: ["kolam renang"] }));
    expect(getAttributeState(map, "pool")).toBe("UNVERIFIED");
  });
  it("missing amenity → UNKNOWN, never KNOWN_NO", () => {
    const map = projectAttributes(makeHotel({ amenities: ["wifi"] }));
    expect(getAttributeState(map, "pool")).toBe("UNKNOWN");
  });
  it("empty amenities → all facilities UNKNOWN", () => {
    const map = projectAttributes(makeHotel({ amenities: [] }));
    for (const e of map) {
      if (e.attribute.category === "facility" || e.attribute.category === "service") {
        expect(e.state).toBe("UNKNOWN");
      }
    }
  });
  it("stale record + positive evidence → STALE (not UNVERIFIED)", () => {
    const map = projectAttributes(makeStaleHotel({ amenities: ["pool"] }));
    expect(getAttributeState(map, "pool")).toBe("STALE");
  });
  it("stale record but owner-verified → KNOWN_YES (verification doesn't go stale)", () => {
    const oldIso = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const map = projectAttributes(makeVerifiedHotel({ amenities: ["pool"], updatedAt: oldIso } as Partial<WorldRecord>));
    expect(getAttributeState(map, "pool")).toBe("KNOWN_YES");
  });
});

describe("projectAttributes · field evidence · tier-aware", () => {
  it("phone field on unclaimed hotel → UNVERIFIED", () => {
    const map = projectAttributes(makeHotel({ phone: "+62-123" }));
    expect(getAttributeState(map, "phone")).toBe("UNVERIFIED");
  });
  it("phone field on owner-verified hotel → KNOWN_YES", () => {
    const map = projectAttributes(makeVerifiedHotel({ phone: "+62-123" }));
    expect(getAttributeState(map, "phone")).toBe("KNOWN_YES");
  });
  it("phone absent → UNKNOWN", () => {
    const map = projectAttributes(makeHotel({ phone: undefined }));
    expect(getAttributeState(map, "phone")).toBe("UNKNOWN");
  });
  it("website field set → UNVERIFIED (default tier)", () => {
    const map = projectAttributes(makeHotel({ website: "https://x.com" }));
    expect(getAttributeState(map, "website")).toBe("UNVERIFIED");
  });
  it("coordinates present → UNVERIFIED (default tier)", () => {
    const map = projectAttributes(makeHotel());
    expect(getAttributeState(map, "coordinates")).toBe("UNVERIFIED");
  });
  it("coordinates on owner-verified record → KNOWN_YES", () => {
    const map = projectAttributes(makeVerifiedHotel());
    expect(getAttributeState(map, "coordinates")).toBe("KNOWN_YES");
  });
});

describe("findAttributeByKeyword", () => {
  it("finds pool via keyword 'pool'", () => {
    const a = findAttributeByKeyword("accommodation", "pool");
    expect(a?.id).toBe("pool");
  });
  it("finds pool via alias 'swimming pool'", () => {
    const a = findAttributeByKeyword("accommodation", "swimming pool");
    expect(a?.id).toBe("pool");
  });
  it("finds laundry via 'laundry'", () => {
    const a = findAttributeByKeyword("accommodation", "laundry");
    expect(a?.id).toBe("laundry");
  });
  it("finds wifi via 'wifi'", () => {
    const a = findAttributeByKeyword("accommodation", "wifi");
    expect(a?.id).toBe("wifi");
  });
  it("finds ID displayId 'AC'", () => {
    const a = findAttributeByKeyword("accommodation", "AC");
    expect(a?.id).toBe("ac");
  });
  it("returns null for unknown keyword", () => {
    expect(findAttributeByKeyword("accommodation", "helicopter pad")).toBeNull();
  });
});

describe("computeCoverage · §13 metric", () => {
  it("verified hotel: counts KNOWN_YES correctly", () => {
    const rec = makeVerifiedHotel({
      amenities: ["pool", "wifi", "parking"],
      phone: "+62-123",
    });
    const cov = computeCoverage(rec);
    expect(cov.known_yes).toBeGreaterThanOrEqual(4); // pool + wifi + parking + phone (+ coords + address …)
    expect(cov.total_attributes).toBe(ATTRIBUTE_CONTRACTS.accommodation.length);
    expect(cov.coverage_pct).toBeGreaterThan(0);
    expect(cov.coverage_pct).toBeLessThanOrEqual(100);
  });
  it("unclaimed hotel: same evidence surfaces as UNVERIFIED", () => {
    const rec = makeHotel({
      amenities: ["pool", "wifi", "parking"],
      phone: "+62-123",
    });
    const cov = computeCoverage(rec);
    expect(cov.unverified).toBeGreaterThanOrEqual(4);
    expect(cov.known_yes).toBe(0);
    expect(cov.evidence_pct).toBeGreaterThan(0);
  });
  it("evidence_pct = (KNOWN_YES + UNVERIFIED) / total", () => {
    const rec = makeHotel({ amenities: ["pool"] });
    const cov = computeCoverage(rec);
    expect(cov.evidence_pct).toBeGreaterThanOrEqual(cov.coverage_pct);
  });
  it("never invents KNOWN_NO", () => {
    const rec = makeHotel({ amenities: [] });
    const cov = computeCoverage(rec);
    expect(cov.known_no).toBe(0);
  });
});

describe("projectAttributes · Villa vertical attributes present in contract", () => {
  it("bedrooms attribute is in accommodation contract", () => {
    expect(ATTRIBUTE_CONTRACTS.accommodation.some((a) => a.id === "bedrooms")).toBe(true);
  });
  it("bathrooms attribute is in accommodation contract", () => {
    expect(ATTRIBUTE_CONTRACTS.accommodation.some((a) => a.id === "bathrooms")).toBe(true);
  });
  it("capacity attribute is in accommodation contract", () => {
    expect(ATTRIBUTE_CONTRACTS.accommodation.some((a) => a.id === "capacity")).toBe(true);
  });
  it("private_pool attribute is in accommodation contract", () => {
    expect(ATTRIBUTE_CONTRACTS.accommodation.some((a) => a.id === "private_pool")).toBe(true);
  });
  it("villa record with bedrooms amenity → UNVERIFIED (or KNOWN_YES if owner-claimed)", () => {
    const map = projectAttributes(makeHotel({ category: "villa", amenities: ["bedrooms"] }));
    expect(getAttributeState(map, "bedrooms")).toBe("UNVERIFIED");
  });
});

describe("cross-vertical contracts", () => {
  it("food contract includes delivery/takeaway/halal", () => {
    expect(findAttributeByKeyword("food", "delivery")?.id).toBe("delivery");
    expect(findAttributeByKeyword("food", "takeaway")?.id).toBe("takeaway");
    expect(findAttributeByKeyword("food", "halal")?.id).toBe("halal");
  });
  it("service contract includes emergency", () => {
    expect(findAttributeByKeyword("service", "emergency")?.id).toBe("emergency");
  });
  it("commerce contract includes price", () => {
    expect(findAttributeByKeyword("commerce", "price")?.id).toBe("price");
  });
  it("transport contract includes price", () => {
    expect(findAttributeByKeyword("transport", "price")?.id).toBe("price");
  });
});

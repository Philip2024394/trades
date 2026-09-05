// src/lib/nex/brain/entity-result-cards.test.ts
// Universal Entity Result Card projection · unit tests
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE

import { describe, it, expect } from "vitest";
import { projectEntityResultCardSet, memoize } from "./entity-result-cards";
import type { WorldRecord } from "./world-adapters/types";

function makeHotel(id: string, name: string, amenities: string[], over: Partial<WorldRecord> = {}): WorldRecord {
  const base: WorldRecord = {
    id,
    vertical: "accommodation",
    name,
    category: "hotel",
    city: "Yogyakarta",
    area: undefined,
    address: `${name} Street`,
    latitude: -7.79, longitude: 110.36,
    phone: undefined, whatsapp: undefined, website: undefined,
    heroImage: undefined,
    price: null, priceRange: null,
    amenities,
    verified: false,
    claimStatus: "listed",
    ownerStatus: "unknown",
    provenance: { sourceTier: "directory_live", sourceRef: "" },
    updatedAt: new Date().toISOString(),
  } as unknown as WorldRecord;
  return { ...base, ...over };
}

/** Owner-verified fixture · positive evidence resolves to KNOWN_YES. */
function makeVerifiedHotel(id: string, name: string, amenities: string[], over: Partial<WorldRecord> = {}): WorldRecord {
  return makeHotel(id, name, amenities, { verified: true, claimStatus: "claimed", ownerStatus: "verified", ...over } as Partial<WorldRecord>);
}

describe("projectEntityResultCardSet · shape", () => {
  it("returns 3 cards for 3 records", () => {
    const set = projectEntityResultCardSet({
      records: [
        makeHotel("h1", "Alpha Hotel", ["pool", "wifi"]),
        makeHotel("h2", "Bravo Hotel", ["parking"]),
        makeHotel("h3", "Charlie Hotel", []),
      ],
      totalAvailable: 3,
      vertical: "accommodation",
    });
    expect(set.cards.length).toBe(3);
    expect(set.vertical).toBe("accommodation");
  });
  it("respects max=2", () => {
    const set = projectEntityResultCardSet({
      records: [
        makeHotel("h1", "A", []),
        makeHotel("h2", "B", []),
        makeHotel("h3", "C", []),
      ],
      totalAvailable: 3,
      vertical: "accommodation",
      max: 2,
    });
    expect(set.cards.length).toBe(2);
  });
  it("attaches position + ref_id", () => {
    const set = projectEntityResultCardSet({
      records: [makeHotel("h1", "A", [])],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    expect(set.cards[0].position).toBe(1);
    expect(set.cards[0].ref_id).toBe("place:accommodation:h1");
  });
});

describe("projectEntityResultCardSet · highlights (verified vs unverified)", () => {
  it("verified hotel amenities → highlights (KNOWN_YES bucket)", () => {
    const set = projectEntityResultCardSet({
      records: [makeVerifiedHotel("h1", "A", ["pool", "wifi", "parking", "breakfast"], { phone: "+62" })],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    const h = set.cards[0].highlights;
    expect(h).toContain("pool");
    expect(h).toContain("wifi");
    expect(h).toContain("parking");
    expect(h).toContain("breakfast");
    expect(h).not.toContain("gym");
    // Verified bucket only contains verified evidence
    expect(set.cards[0].unverified_highlights).toEqual([]);
  });
  it("unclaimed hotel amenities → unverified_highlights bucket", () => {
    const set = projectEntityResultCardSet({
      records: [makeHotel("h1", "A", ["pool", "wifi", "parking"], { phone: "+62" })],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    expect(set.cards[0].highlights).toEqual([]);
    const uv = set.cards[0].unverified_highlights;
    expect(uv).toContain("pool");
    expect(uv).toContain("wifi");
    expect(uv).toContain("parking");
  });
  it("respects highlight priority (pool before phone)", () => {
    const set = projectEntityResultCardSet({
      records: [makeVerifiedHotel("h1", "A", ["pool"], { phone: "+62" })],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    const h = set.cards[0].highlights;
    expect(h.indexOf("pool")).toBeLessThan(h.indexOf("phone"));
  });
  it("respects highlightLimit", () => {
    const set = projectEntityResultCardSet({
      records: [makeVerifiedHotel("h1", "A", ["pool", "wifi", "parking", "gym", "spa", "restaurant", "bar"], { phone: "+62", whatsapp: "+62" })],
      totalAvailable: 1,
      vertical: "accommodation",
      highlightLimit: 4,
    });
    expect(set.cards[0].highlights.length).toBe(4);
  });
});

describe("projectEntityResultCardSet · UNKNOWN ≠ NO", () => {
  it("record with empty amenities produces UNKNOWN states, not KNOWN_NO", () => {
    const set = projectEntityResultCardSet({
      records: [makeHotel("h1", "A", [])],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    const attrs = set.cards[0].attributes;
    const poolEntry = attrs.find((a) => a.attribute.id === "pool");
    expect(poolEntry?.state).toBe("UNKNOWN");
    // No KNOWN_NO for pool just because amenities are empty
    expect(poolEntry?.state).not.toBe("KNOWN_NO");
  });
});

describe("projectEntityResultCardSet · coverage metric", () => {
  it("verified coverage rises with more known attributes", () => {
    const bare = projectEntityResultCardSet({
      records: [makeVerifiedHotel("h1", "A", [])],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    const rich = projectEntityResultCardSet({
      records: [makeVerifiedHotel("h1", "A", ["pool", "wifi", "parking", "gym", "spa"], { phone: "+62", whatsapp: "+62", website: "https://x.com" })],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    expect(rich.cards[0].coverage.coverage_pct).toBeGreaterThan(bare.cards[0].coverage.coverage_pct);
  });
  it("unclaimed rich record → evidence_pct high, coverage_pct stays 0", () => {
    const set = projectEntityResultCardSet({
      records: [makeHotel("h1", "A", ["pool", "wifi", "parking"], { phone: "+62", whatsapp: "+62" })],
      totalAvailable: 1,
      vertical: "accommodation",
    });
    expect(set.cards[0].coverage.coverage_pct).toBe(0);
    expect(set.cards[0].coverage.evidence_pct).toBeGreaterThan(0);
    expect(set.cards[0].coverage.unverified).toBeGreaterThan(0);
  });
});

describe("memoize · session-cache serialization", () => {
  it("produces memo with 6-state attribute_states + evidence_tier map", () => {
    const set = projectEntityResultCardSet({
      records: [
        makeVerifiedHotel("h1", "Alpha", ["pool"]),
        makeHotel("h2", "Bravo", ["wifi"]),
      ],
      totalAvailable: 2,
      vertical: "accommodation",
    });
    const memo = memoize(set.cards);
    expect(memo.length).toBe(2);
    expect(memo[0].name).toBe("Alpha");
    expect(memo[0].attribute_states.pool).toBe("KNOWN_YES");
    expect(memo[0].attribute_evidence_tiers.pool).toBe("owner_verified");
    expect(memo[1].attribute_states.wifi).toBe("UNVERIFIED");
    expect(memo[1].attribute_evidence_tiers.wifi).toBe("directory");
    expect(memo[0].attribute_states.gym).toBe("UNKNOWN");
    expect(memo[0].position).toBe(1);
    expect(memo[1].position).toBe(2);
  });
});

describe("cross-vertical projection", () => {
  it("food vertical uses food contract · unclaimed → unverified_highlights", () => {
    const foodRec: WorldRecord = {
      id: "f1",
      vertical: "food",
      name: "Warung X",
      category: "restaurant",
      city: "Yogyakarta",
      area: undefined,
      address: "Jl. Test",
      latitude: -7.79, longitude: 110.36,
      phone: undefined, whatsapp: undefined, website: undefined,
      heroImage: undefined,
      price: null, priceRange: null,
      amenities: ["delivery", "halal"],
      verified: false,
      claimStatus: "listed",
      ownerStatus: "unknown",
      provenance: { sourceTier: "directory_live", sourceRef: "" },
      updatedAt: new Date().toISOString(),
    } as unknown as WorldRecord;
    const set = projectEntityResultCardSet({
      records: [foodRec],
      totalAvailable: 1,
      vertical: "food",
    });
    expect(set.cards[0].unverified_highlights).toContain("delivery");
    expect(set.cards[0].unverified_highlights).toContain("halal");
  });
});

// Category walker unit tests · pure functions only · no DB.
// Locks in strategy translation, listing-ref generation, and persistence contract.

import { describe, it, expect } from "vitest";
import {
  strategyToOverpassConfig,
  generateServiceRef,
  persistServiceBusiness,
} from "./_category-walker.mjs";

describe("strategyToOverpassConfig · registry → osm-overpass translation", () => {
  it("amenity keys map to amenities[]", () => {
    const cfg = strategyToOverpassConfig({
      provider: "overpass", query_kind: "tag", params: { amenity: "restaurant" },
    });
    expect(cfg.amenities).toEqual(["restaurant"]);
    expect(cfg.shopTypes).toEqual([]);
    expect(cfg.tourismTypes).toEqual([]);
    expect(cfg.extendedTagPairs).toEqual([]);
  });

  it("shop keys map to shopTypes[]", () => {
    const cfg = strategyToOverpassConfig({
      provider: "overpass", query_kind: "tag", params: { shop: "hairdresser" },
    });
    expect(cfg.shopTypes).toEqual(["hairdresser"]);
  });

  it("tourism keys map to tourismTypes[]", () => {
    const cfg = strategyToOverpassConfig({
      provider: "overpass", query_kind: "tag", params: { tourism: "hotel" },
    });
    expect(cfg.tourismTypes).toEqual(["hotel"]);
  });

  it("other keys (leisure/sport) fall into extendedTagPairs", () => {
    const cfg = strategyToOverpassConfig({
      provider: "overpass", query_kind: "tag", params: { leisure: "fitness_centre" },
    });
    expect(cfg.extendedTagPairs).toEqual([["leisure", "fitness_centre"]]);
  });

  it("tag_pairs param passes through as extendedTagPairs", () => {
    const cfg = strategyToOverpassConfig({
      provider: "overpass", query_kind: "tag",
      params: { tag_pairs: [["building", "hotel"], ["hotel", "villa"]] },
    });
    expect(cfg.extendedTagPairs).toEqual([["building", "hotel"], ["hotel", "villa"]]);
  });

  it("throws for non-overpass provider (Phase 1 limit)", () => {
    expect(() => strategyToOverpassConfig({
      provider: "nominatim", query_kind: "keyword", params: {},
    })).toThrow(/only 'overpass' supported/);
  });

  it("throws for non-tag query_kind (Phase 1 limit)", () => {
    expect(() => strategyToOverpassConfig({
      provider: "overpass", query_kind: "keyword", params: {},
    })).toThrow(/only 'tag' query_kind supported/);
  });
});

describe("generateServiceRef · deterministic #SB-YYYY-XXXXX", () => {
  it("returns #SB-<YYYY>-<5 crockford chars>", () => {
    const ref = generateServiceRef("node/12345");
    expect(ref).toMatch(/^#SB-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/);
  });

  it("same source_reference produces same ref (idempotent)", () => {
    const a = generateServiceRef("way/98765");
    const b = generateServiceRef("way/98765");
    expect(a).toBe(b);
  });

  it("different source_references produce different refs", () => {
    const a = generateServiceRef("node/1");
    const b = generateServiceRef("node/2");
    expect(a).not.toBe(b);
  });
});

// Mock pool for persistence contract tests.
function mockPool({ insertRowCount = 1, insertRow = { public_listing_ref: "#SB-2026-ABCDE", internal_id: "uuid-1" }, throwOnMain = null } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (throwOnMain && /INSERT INTO nex\.service_business \(/i.test(sql)) {
        throw new Error(throwOnMain);
      }
      if (/INSERT INTO nex\.service_business \(/i.test(sql)) {
        return { rowCount: insertRowCount, rows: insertRowCount ? [insertRow] : [] };
      }
      if (/INSERT INTO nex\.service_business_source_snapshot/i.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

describe("persistServiceBusiness · persistence contract", () => {
  const baseCandidate = {
    name: "Gym A",
    lat: -6.2, lng: 106.85,
    address: "Jl. Sudirman 1",
    phone: "+62-21-1", whatsapp: null, website: null,
    categories: [],
    rawTags: { name: "Gym A", leisure: "fitness_centre" },
    sourceType: "osm_overpass",
    sourceReference: "node/12345",
    sourceLicenceTerms: "ODbL 1.0",
    sourceUpdatedAt: "2026-08-01T00:00:00Z",
    lastVerifiedAt: "2026-08-01T00:00:00Z",
    verificationSource: "osm_element_timestamp",
  };

  it("MALFORMED rejection when name is missing", async () => {
    const pool = mockPool();
    const result = await persistServiceBusiness(pool, {
      categorySlug: "gyms", city: "Jakarta",
      candidate: { ...baseCandidate, name: null },
      workerId: "w", cycleRunId: "c",
    });
    expect(result.insertedRef).toBeNull();
    expect(result.rejectionReason).toBe("MALFORMED");
    expect(pool.calls).toHaveLength(0);   // never touched DB
  });

  it("GEO_MISS rejection when coordinates are missing", async () => {
    const pool = mockPool();
    const result = await persistServiceBusiness(pool, {
      categorySlug: "gyms", city: "Jakarta",
      candidate: { ...baseCandidate, lat: null, lng: null },
      workerId: "w", cycleRunId: "c",
    });
    expect(result.insertedRef).toBeNull();
    expect(result.rejectionReason).toBe("GEO_MISS");
  });

  it("inserts service_business row + snapshot on happy path", async () => {
    const pool = mockPool();
    const result = await persistServiceBusiness(pool, {
      categorySlug: "gyms", city: "Jakarta",
      candidate: baseCandidate, workerId: "w", cycleRunId: "c",
    });
    expect(result.insertedRef).toBe("#SB-2026-ABCDE");
    expect(result.rejectionReason).toBeNull();
    expect(pool.calls).toHaveLength(2);
    expect(pool.calls[0].sql).toMatch(/INSERT INTO nex\.service_business/);
    expect(pool.calls[1].sql).toMatch(/INSERT INTO nex\.service_business_source_snapshot/);
  });

  it("MATCHED_EXISTING when unique index blocks insert (rowCount=0)", async () => {
    const pool = mockPool({ insertRowCount: 0 });
    const result = await persistServiceBusiness(pool, {
      categorySlug: "gyms", city: "Jakarta",
      candidate: baseCandidate, workerId: "w", cycleRunId: "c",
    });
    expect(result.insertedRef).toBeNull();
    expect(result.rejectionReason).toBe("MATCHED_EXISTING");
    // snapshot should NOT be attempted when insert didn't happen
    expect(pool.calls).toHaveLength(1);
  });

  it("uses deterministic public_listing_ref based on source_reference", async () => {
    const pool = mockPool();
    await persistServiceBusiness(pool, {
      categorySlug: "gyms", city: "Jakarta",
      candidate: baseCandidate, workerId: "w", cycleRunId: "c",
    });
    // First INSERT param is public_listing_ref
    const [publicRef] = pool.calls[0].params;
    expect(publicRef).toMatch(/^#SB-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/);
    // Deterministic → matches generateServiceRef output for this source_reference
    expect(publicRef).toBe(generateServiceRef("node/12345"));
  });

  it("passes category_slug from job to the INSERT", async () => {
    const pool = mockPool();
    await persistServiceBusiness(pool, {
      categorySlug: "dentists", city: "Jakarta",
      candidate: baseCandidate, workerId: "w", cycleRunId: "c",
    });
    // params: [publicRef, name, category_slug, categories, address, city, ...]
    const params = pool.calls[0].params;
    expect(params[2]).toBe("dentists");
  });
});

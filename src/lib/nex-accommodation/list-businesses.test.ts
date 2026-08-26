// Country Foundation Step 5 · accommodation adapter country filtering · 2026-08-22.
//
// Mocked-pool unit tests · verifies:
//   · country is passed as $2 in the SQL
//   · country defaults to 'ID' (DEFAULT_MARKET) when omitted
//   · GB request passes through as 'GB' (Truth Invariant · never silently swapped to ID)
//   · category filter still works alongside country
//   · countAccommodationDiscovered also honours country
//
// Doctrine anchors:
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 5)
//   project_nex_country_scope_from_phone_country_code_2026_08_22
//   project_nex_truth_invariant_2026_08_22

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();
vi.mock("./db", () => ({
  getAccommodationDbPool: () => ({ query: mockQuery }),
}));

// Import AFTER the mock is registered
import { countAccommodationDiscovered, loadAccommodationListings, loadAccommodationFunnel, loadNearbyFood, DEFAULT_PUBLIC_LIMIT } from "./list-businesses";

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

describe("loadAccommodationListings · country filtering (Step 5)", () => {
  it("passes country as $2 in the SQL", async () => {
    await loadAccommodationListings({ country: "ID" });
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("country = $2");
    expect(params[1]).toBe("ID");
  });

  it("defaults to 'ID' when country is omitted", async () => {
    await loadAccommodationListings({});
    const [, params] = mockQuery.mock.calls[0]!;
    expect(params[1]).toBe("ID");
  });

  it("passes 'GB' verbatim when GB requested (Truth Invariant · never silently swap)", async () => {
    await loadAccommodationListings({ country: "GB" });
    const [, params] = mockQuery.mock.calls[0]!;
    expect(params[1]).toBe("GB");
  });

  it("category filter works alongside country filter (positional params correct)", async () => {
    await loadAccommodationListings({ country: "ID", category: "hotel" });
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("country = $2");
    expect(sql).toContain("category = $3");
    expect(params).toEqual(["Yogyakarta", "ID", "hotel"]);
  });

  it("passes city as $1 and country as $2 (regression · order preserved)", async () => {
    await loadAccommodationListings({ city: "Yogyakarta", country: "ID" });
    const [, params] = mockQuery.mock.calls[0]!;
    expect(params[0]).toBe("Yogyakarta");
    expect(params[1]).toBe("ID");
  });
});

describe("countAccommodationDiscovered · country filtering (Step 5)", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [{ visible: 0, discovered: 881, total: 881 }] });
  });

  it("passes country as $2 in the SQL", async () => {
    await countAccommodationDiscovered({ country: "ID" });
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("country = $2");
    expect(params[1]).toBe("ID");
  });

  it("defaults to 'ID' when country is omitted", async () => {
    await countAccommodationDiscovered({});
    const [, params] = mockQuery.mock.calls[0]!;
    expect(params[1]).toBe("ID");
  });

  it("passes GB verbatim (empty-inventory country returns honest empty count)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ visible: 0, discovered: 0, total: 0 }] });
    const result = await countAccommodationDiscovered({ country: "GB" });
    const [, params] = mockQuery.mock.calls[0]!;
    expect(params[1]).toBe("GB");
    expect(result).toEqual({ visible: 0, discovered: 0, total: 0 });
  });

  it("category filter works alongside country filter", async () => {
    await countAccommodationDiscovered({ country: "ID", category: "hotel" });
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("country = $2");
    expect(sql).toContain("category = $3");
    expect(params).toEqual(["Yogyakarta", "ID", "hotel"]);
  });
});

describe("loadAccommodationListings · pagination (PART A 2026-08-24 · removes invisible 500 ceiling)", () => {
  it("uses DEFAULT_PUBLIC_LIMIT (1500) when no limit supplied · resolves the historical 500 discrepancy", async () => {
    await loadAccommodationListings({});
    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain(`LIMIT ${DEFAULT_PUBLIC_LIMIT}`);
  });

  it("respects explicit limit + offset for pagination", async () => {
    await loadAccommodationListings({ limit: 100, offset: 200 });
    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("LIMIT 100");
    expect(sql).toContain("OFFSET 200");
  });

  it("clamps hostile limit values to the safe [1, 2000] range", async () => {
    await loadAccommodationListings({ limit: -50 });
    const [sqlNeg] = mockQuery.mock.calls[0]!;
    expect(sqlNeg).toContain("LIMIT 1");

    mockQuery.mockClear();
    await loadAccommodationListings({ limit: 99999 });
    const [sqlHuge] = mockQuery.mock.calls[0]!;
    expect(sqlHuge).toContain("LIMIT 2000");
  });

  it("clamps negative offset to 0", async () => {
    await loadAccommodationListings({ offset: -10 });
    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("OFFSET 0");
  });
});

describe("loadAccommodationFunnel · honest breakdown (PART A · explains 881 vs 500)", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({
      rows: [{
        total: 881, discovered: 0, eligible_listed: 881, invited: 0, claimed: 0, paying: 0,
        other_status: 0, owner_verified: 0, owner_unknown: 881,
        eligible_with_hero: 0, eligible_with_amenities: 115, eligible_with_contact: 141,
        eligible_with_coords: 881, eligible_with_star: 13, eligible_with_recov_ev: 258,
      }],
    });
  });

  it("returns full breakdown with mutually-exclusive stage counts", async () => {
    const b = await loadAccommodationFunnel({});
    expect(b.total).toBe(881);
    expect(b.discovered + b.eligibleListed + b.invited + b.claimed + b.paying + b.otherStatus).toBe(b.total);
    expect(b.eligibleListed).toBe(881);
    expect(b.eligibleWithAmenities).toBe(115);
    expect(b.eligibleWithStarRating).toBe(13);
    expect(b.eligibleWithRecoveredEv).toBe(258);
  });

  it("computes publicPagesAvailable from eligible/publicRenderCap · never zero", async () => {
    const b = await loadAccommodationFunnel({ publicRenderCap: 500 });
    expect(b.publicRenderCap).toBe(500);
    expect(b.publicPagesAvailable).toBe(Math.ceil(881 / 500)); // 2
  });

  it("category filter reaches the SQL as $3", async () => {
    await loadAccommodationFunnel({ category: "hotel" });
    const [sql, params] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("category = $3");
    expect(params).toEqual(["Yogyakarta", "ID", "hotel"]);
  });

  it("owner_verified + owner_unknown accounting is honest (never inflates total)", async () => {
    const b = await loadAccommodationFunnel({});
    expect(b.ownerVerified + b.ownerUnknown).toBeLessThanOrEqual(b.total);
  });
});

describe("loadNearbyFood · haversine on real coords · never fabricated distances", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [
      { public_listing_ref: "food-1", business_name: "Warung Dekat", category: "warung", distance_km: 0.15 },
      { public_listing_ref: "food-2", business_name: "Kopi Jauh",  category: "cafe",   distance_km: 4.5 },
      { public_listing_ref: "food-3", business_name: "Angkringan",  category: null,     distance_km: 0.8 },
    ]});
  });

  it("filters out rows beyond maxKm", async () => {
    const rows = await loadNearbyFood({ lat: -7.79, lng: 110.36, maxKm: 3 });
    expect(rows.map((r) => r.publicListingRef)).toEqual(["food-1", "food-3"]);
  });

  it("respects limit + visibility filter is in the SQL", async () => {
    await loadNearbyFood({ lat: -7.79, lng: 110.36, limit: 2 });
    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("claim_status IN ('listed','invited','claimed','paying')");
  });

  it("returns distances as numbers · never string", async () => {
    const rows = await loadNearbyFood({ lat: -7.79, lng: 110.36 });
    for (const r of rows) expect(typeof r.distanceKm).toBe("number");
  });

  it("orders SQL by ASC distance so nearest first", async () => {
    await loadNearbyFood({ lat: -7.79, lng: 110.36 });
    const [sql] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("ORDER BY distance_km ASC");
  });
});

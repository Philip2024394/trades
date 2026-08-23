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
import { countAccommodationDiscovered, loadAccommodationListings } from "./list-businesses";

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

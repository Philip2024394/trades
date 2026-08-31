// src/lib/nex/brain/world-adapters/accommodation-postgres.test.ts
//
// Stage 3.34 · Phase 27 · Accommodation adapter tests (Philip 2026-08-31).
//
// Two test surfaces:
//
//   1. Unit tests · mock the accommodation DB pool so we can prove SQL
//      shape, visibility gate, market gate, provenance stamp, nullable
//      preservation, and the LIVE UPDATE doctrine (a second query
//      returns the updated row · no caching in the adapter).
//
//   2. Integration tests · only run when NEX_POSTGRES_URL is set (via
//      npm run test with env). Skipped by default so vitest passes in
//      CI without a database.
//
// Constitutional invariants proven here:
//   · Never fabricates a field (nullable stays nullable)
//   · Respects VISIBILITY_FILTER exactly (matches the /accommodation page)
//   · Market gate blocks non-ID queries
//   · Provenance stamped with readAt on every record
//   · Two searches return two fresh reads · no adapter-side cache

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the accommodation DB pool BEFORE importing the adapter.
const queryMock = vi.fn();
vi.mock("@/lib/nex-accommodation/db", () => ({
  getAccommodationDbPool: () => ({ query: queryMock }),
}));

import { AccommodationPostgresAdapter } from "./accommodation-postgres";

beforeEach(() => {
  queryMock.mockReset();
});

// Row shape matching what pg returns for nex.accommodation_business.
function fakeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    public_listing_ref: "acc:yogya:griya-sentana",
    business_name: "Griya Sentana",
    category: "hotel",
    categories: ["hotel"],
    city: "Yogyakarta",
    district: "Malioboro",
    address: "Jl. Prawirotaman 42",
    coordinates_lat: -7.79,
    coordinates_lng: 110.36,
    phone: "+62-274-123-456",
    whatsapp_number: "+6281234567890",
    website: "https://griyasentana.example",
    public_social_links: { instagram: "@griyasentana" },
    star_rating: 4,
    room_count: 32,
    amenities: ["wifi", "breakfast"],
    hero_image_url: "https://cdn.nex/griya.jpg",
    rating: 4.4,
    review_count: 128,
    claim_status: "listed",
    owner_status: "unknown",
    updated_at: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

describe("AccommodationPostgresAdapter · vertical + market gates", () => {
  it("declares vertical 'accommodation'", () => {
    expect(AccommodationPostgresAdapter.vertical).toBe("accommodation");
  });

  it("non-ID market returns empty · never queries the pool", async () => {
    const out = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "UK" });
    expect(out.records).toHaveLength(0);
    expect(out.totalAvailable).toBe(0);
    expect(out.degradedReason).toBe("market_not_supported");
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("AccommodationPostgresAdapter · search shape + visibility", () => {
  it("emits WorldRecord shape · provenance stamped with readAt", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })  // count query
      .mockResolvedValueOnce({ rows: [fakeRow()] }); // rows query

    const out = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(out.records).toHaveLength(1);
    const rec = out.records[0];
    expect(rec.id).toBe("acc:yogya:griya-sentana");
    expect(rec.name).toBe("Griya Sentana");
    expect(rec.vertical).toBe("accommodation");
    expect(rec.market).toBe("ID");
    expect(rec.phone).toBe("+62-274-123-456");
    expect(rec.whatsapp).toBe("+6281234567890");
    expect(rec.rating).toBe(4.4);
    expect(rec.reviewCount).toBe(128);
    expect(rec.roomCount).toBe(32);
    expect(rec.starRating).toBe(4);
    expect(rec.amenities).toEqual(["wifi", "breakfast"]);
    expect(rec.provenance.sourceKey).toBe("nex.accommodation_business");
    expect(rec.provenance.sourceTier).toBe("directory_live");
    expect(rec.provenance.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("applies the VISIBILITY_FILTER on every query", async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    // Both round-trip SQL strings must include the visibility filter clause.
    const sqls = queryMock.mock.calls.map((c) => String(c[0]));
    for (const sql of sqls) {
      expect(sql).toContain("claim_status IN ('listed','invited','claimed','paying')");
    }
  });

  it("optional filters (city · category · amenities · query) build parameterised WHERE", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await AccommodationPostgresAdapter.search({
      vertical: "accommodation",
      market: "ID",
      city: "Yogyakarta",
      category: "hotel",
      amenities: ["wifi"],
      query: "griya",
    });
    const [, params] = queryMock.mock.calls[0]!;
    // First param locked to 'ID' (country) then the extra filters.
    expect(params).toEqual(["ID", "Yogyakarta", "hotel", "%griya%", ["wifi"]]);
    const sql = String(queryMock.mock.calls[0]![0]);
    expect(sql).toContain("city ILIKE $2");
    expect(sql).toContain("category = $3");
    expect(sql).toContain("business_name ILIKE $4");
    expect(sql).toContain("amenities @> $5::text[]");
  });
});

describe("AccommodationPostgresAdapter · honesty invariants", () => {
  it("null DB fields stay undefined in the WorldRecord · never fabricated", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({
        rows: [fakeRow({
          phone: null, whatsapp_number: null, website: null,
          rating: null, review_count: null, star_rating: null,
          room_count: null, amenities: null, hero_image_url: null,
          address: null, district: null, coordinates_lat: null, coordinates_lng: null,
        })],
      });
    const out = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    const rec = out.records[0];
    expect(rec.phone).toBeUndefined();
    expect(rec.whatsapp).toBeUndefined();
    expect(rec.website).toBeUndefined();
    expect(rec.rating).toBeUndefined();
    expect(rec.reviewCount).toBeUndefined();
    expect(rec.starRating).toBeUndefined();
    expect(rec.roomCount).toBeUndefined();
    expect(rec.amenities).toBeUndefined();
    expect(rec.heroImage).toBeUndefined();
    expect(rec.latitude).toBeUndefined();
    expect(rec.longitude).toBeUndefined();
    // Price never surfaces from this schema (no price column).
    expect(rec.price).toBeUndefined();
  });

  it("owner_status='claimed' or 'verified' → verified=true", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ owner_status: "verified" })] });
    const out = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(out.records[0].verified).toBe(true);
  });

  it("owner_status='unknown' → verified=false", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ owner_status: "unknown" })] });
    const out = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(out.records[0].verified).toBe(false);
  });
});

describe("AccommodationPostgresAdapter · LIVE UPDATE doctrine", () => {
  // The whole point of this phase: when the DB row changes, the next
  // search sees the new value with zero caching. Prove it by returning
  // different rows across two calls and confirming both surface.

  it("second query returns the updated row · adapter caches nothing", async () => {
    // Call 1: rating 4.1
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ rating: 4.1 })] });
    const first = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(first.records[0].rating).toBe(4.1);

    // Call 2: same id, rating changed to 4.7 in the DB.
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ rating: 4.7 })] });
    const second = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(second.records[0].rating).toBe(4.7);

    // Every search issues a fresh DB read (2 calls per search: count + rows).
    expect(queryMock).toHaveBeenCalledTimes(4);
  });

  it("newly listed row appears in the next search", async () => {
    // Call 1: only Griya Sentana visible.
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow()] });
    const before = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(before.records).toHaveLength(1);

    // Call 2: a second listing now surfaces from the DB.
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 2 }] })
      .mockResolvedValueOnce({ rows: [
        fakeRow(),
        fakeRow({ public_listing_ref: "acc:yogya:hotel-trim-tiga", business_name: "Hotel Trim Tiga" }),
      ] });
    const after = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(after.records).toHaveLength(2);
    expect(after.records[1].name).toBe("Hotel Trim Tiga");
  });

  it("row hidden (claim_status change) disappears from next search", async () => {
    // Call 1: Griya Sentana listed.
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow()] });
    const before = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(before.records).toHaveLength(1);

    // Call 2: DB moved the row to 'discovered' → filter excludes it →
    // adapter returns 0 rows.
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const after = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(after.records).toHaveLength(0);
  });

  it("whatsapp added → next search's record carries the whatsapp field", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ whatsapp_number: null })] });
    const before = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(before.records[0].whatsapp).toBeUndefined();

    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ whatsapp_number: "+6281234567890" })] });
    const after = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(after.records[0].whatsapp).toBe("+6281234567890");
  });

  it("hero image changed → next search's record uses the new image", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ hero_image_url: "https://cdn.nex/old.jpg" })] });
    const before = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(before.records[0].heroImage).toBe("https://cdn.nex/old.jpg");

    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ hero_image_url: "https://cdn.nex/new.jpg" })] });
    const after = await AccommodationPostgresAdapter.search({ vertical: "accommodation", market: "ID" });
    expect(after.records[0].heroImage).toBe("https://cdn.nex/new.jpg");
  });
});

describe("AccommodationPostgresAdapter · getById", () => {
  it("returns null for non-ID market · never queries the pool", async () => {
    const out = await AccommodationPostgresAdapter.getById!({ id: "x", market: "UK" });
    expect(out).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns null when the DB returns no rows", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const out = await AccommodationPostgresAdapter.getById!({ id: "missing", market: "ID" });
    expect(out).toBeNull();
  });

  it("returns the WorldRecord when a row exists", async () => {
    queryMock.mockResolvedValueOnce({ rows: [fakeRow()] });
    const out = await AccommodationPostgresAdapter.getById!({ id: "acc:yogya:griya-sentana", market: "ID" });
    expect(out?.name).toBe("Griya Sentana");
    expect(out?.provenance.sourceKey).toBe("nex.accommodation_business");
  });
});

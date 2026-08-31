// src/lib/nex/brain/world-adapters/multi-vertical.test.ts
//
// Stage 3.34d · Phase 27h · Multi-vertical adapter tests
// (Philip 2026-08-31).
//
// Locks in that food · commerce · service · transport adapters honour
// the same doctrine as accommodation:
//   · vertical + market gate honesty
//   · visibility gate applied verbatim
//   · never fabricates null-DB fields
//   · provenance stamped with sourceKey + readAt on every record
//   · price/availability from real columns · never invented
//
// Pool is mocked so tests run without a live DB. Live DB smoke test
// is separate (report includes it).

import { describe, expect, it, vi, beforeEach } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/nex-food/db", () => ({
  getFoodDbPool: () => ({ query: queryMock }),
}));

import { FoodPostgresAdapter } from "./food-postgres";
import { ServicePostgresAdapter } from "./service-postgres";
import { CommercePostgresAdapter } from "./commerce-postgres";
import { TransportPostgresAdapter } from "./transport-postgres";

beforeEach(() => { queryMock.mockReset(); });

// ─── FOOD ────────────────────────────────────────────────────────────
describe("FoodPostgresAdapter", () => {
  it("declares vertical 'food'", () => {
    expect(FoodPostgresAdapter.vertical).toBe("food");
  });

  it("non-ID market → empty · never queries", async () => {
    const out = await FoodPostgresAdapter.search({ vertical: "food", market: "UK" });
    expect(out.records).toHaveLength(0);
    expect(out.degradedReason).toBe("market_not_supported");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("SQL always contains claim_status visibility filter", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    const sqls = queryMock.mock.calls.map((c) => String(c[0]));
    for (const sql of sqls) {
      expect(sql).toContain("claim_status IN ('listed','invited','claimed','paying')");
    }
  });

  it("hero_image_approved=false → heroImage undefined (owner-provenanced doctrine)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        public_listing_ref: "food:1", business_name: "Warung X", category: "restaurant", categories: ["restaurant"],
        city: "Yogyakarta", district: null, address: null,
        coordinates_lat: -7.8, coordinates_lng: 110.4,
        phone: null, whatsapp_number: null, website: null, public_social_links: null,
        hero_image_url: "https://cdn.nex/warung.jpg", hero_image_approved: false,
        rating: null, review_count: null,
        claim_status: "listed", owner_status: "unknown", updated_at: "2026-08-31T00:00:00Z",
      }] });
    const out = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(out.records[0].heroImage).toBeUndefined();
  });

  it("hero_image_approved=true → heroImage surfaces + ownerProvided=true in provenance", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        public_listing_ref: "food:1", business_name: "Warung X", category: "restaurant", categories: ["restaurant"],
        city: "Yogyakarta", district: null, address: null,
        coordinates_lat: -7.8, coordinates_lng: 110.4,
        phone: "+62-274-000", whatsapp_number: "+6281234567890", website: null, public_social_links: null,
        hero_image_url: "https://cdn.nex/warung.jpg", hero_image_approved: true,
        rating: 4.5, review_count: 42,
        claim_status: "claimed", owner_status: "claimed", updated_at: "2026-08-31T00:00:00Z",
      }] });
    const out = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(out.records[0].heroImage).toBe("https://cdn.nex/warung.jpg");
    expect(out.records[0].provenance.ownerProvided).toBe(true);
    expect(out.records[0].verified).toBe(true);
    expect(out.records[0].claimStatus).toBe("claimed");
  });
});

// ─── SERVICE ─────────────────────────────────────────────────────────
describe("ServicePostgresAdapter", () => {
  it("declares vertical 'service'", () => {
    expect(ServicePostgresAdapter.vertical).toBe("service");
  });

  it("non-ID market → empty · never queries", async () => {
    const out = await ServicePostgresAdapter.search({ vertical: "service", market: "UK" });
    expect(out.records).toHaveLength(0);
    expect(out.degradedReason).toBe("market_not_supported");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("SQL uses visibility='public' + status='listed' gate (matches /services page loader verbatim)", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await ServicePostgresAdapter.search({ vertical: "service", market: "ID" });
    const sqls = queryMock.mock.calls.map((c) => String(c[0]));
    for (const sql of sqls) {
      expect(sql).toContain("visibility = 'public'");
      expect(sql).toContain("status = 'listed'");
    }
  });

  it("claimed=true → claimStatus='claimed' · claimed=false + live → 'listed' (visibility!=ownership)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 2 }] })
      .mockResolvedValueOnce({ rows: [
        { public_listing_ref: "svc:1", business_name: "Plumbers Yogyakarta", category_slug: "plumbing", categories: ["plumbing"],
          city: "Yogyakarta", district: null, address: null, coordinates_lat: null, coordinates_lng: null,
          phone: null, whatsapp_number: null, website: null, public_social_links: null,
          hero_image_url: null, owner_status: null,
          claimed: true, verified: false, commercial_status: "prospect", updated_at: "2026-08-31T00:00:00Z" },
        { public_listing_ref: "svc:2", business_name: "Electricians", category_slug: "electrical", categories: ["electrical"],
          city: "Yogyakarta", district: null, address: null, coordinates_lat: null, coordinates_lng: null,
          phone: null, whatsapp_number: null, website: null, public_social_links: null,
          hero_image_url: null, owner_status: null,
          claimed: false, verified: false, commercial_status: "prospect", updated_at: "2026-08-31T00:00:00Z", status: "live" },
      ] });
    const out = await ServicePostgresAdapter.search({ vertical: "service", market: "ID" });
    expect(out.records[0].claimStatus).toBe("claimed");
    expect(out.records[1].claimStatus).toBe("listed"); // visible but unclaimed
  });
});

// ─── COMMERCE ────────────────────────────────────────────────────────
describe("CommercePostgresAdapter", () => {
  it("declares vertical 'commerce'", () => {
    expect(CommercePostgresAdapter.vertical).toBe("commerce");
  });

  it("SQL joins mp_product and mp_seller + gates on active + status", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" });
    const sqls = queryMock.mock.calls.map((c) => String(c[0]));
    for (const sql of sqls) {
      expect(sql).toContain("nex.mp_product p JOIN nex.mp_seller s");
      expect(sql).toContain("p.active = true");
      expect(sql).toContain("s.status = 'active'");
      // LIKE $1 (with 'ID%') accepts compound jurisdiction codes
      // like 'ID/DIY/Yogyakarta' the DB actually stores.
      expect(sql).toContain("s.jurisdiction LIKE $1");
    }
  });

  it("base_price_idr populated → WorldRecord.price surfaces the real number", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        product_id: "00000000-0000-0000-0000-000000000001",
        slug: "sony-wh1000xm5", product_name: "Sony WH-1000XM5", product_description: null,
        condition: "new", base_price_idr: 5990000, base_stock: 12,
        category_id: null, product_updated_at: "2026-08-31T00:00:00Z",
        seller_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", seller_slug: "audio-jkt", seller_name: "Audio Jakarta",
        seller_city: "Jakarta", jurisdiction: "ID", seller_status: "active",
        cover_image_ref: "img:audio-jkt/cover.jpg", logo_image_ref: null,
      }] });
    const out = await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" });
    expect(out.records[0].price).toBe(5990000);
    expect(out.records[0].availability).toBe("available"); // stock >= 5
  });

  it("base_price_idr null → WorldRecord.price undefined · never fabricates", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        product_id: "00000000-0000-0000-0000-000000000002", slug: "x", product_name: "X",
        condition: "new", base_price_idr: null, base_stock: null,
        product_updated_at: "2026-08-31T00:00:00Z",
        seller_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", seller_slug: "s", seller_name: "S",
        seller_city: "Jakarta", jurisdiction: "ID", seller_status: "active",
        cover_image_ref: null, logo_image_ref: null,
      }] });
    const out = await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" });
    expect(out.records[0].price).toBeUndefined();
    expect(out.records[0].availability).toBeUndefined();
  });

  it("base_stock <= 0 → availability='unavailable' · < 5 → 'limited' · >= 5 → 'available'", async () => {
    for (const [stock, expected] of [[0, "unavailable"], [3, "limited"], [10, "available"]] as const) {
      queryMock.mockReset();
      queryMock
        .mockResolvedValueOnce({ rows: [{ n: 1 }] })
        .mockResolvedValueOnce({ rows: [{
          product_id: "00000000-0000-0000-0000-000000000003", slug: "x", product_name: "X",
          condition: "new", base_price_idr: 1000, base_stock: stock,
          product_updated_at: "2026-08-31T00:00:00Z",
          seller_id: "cccccccc-cccc-cccc-cccc-cccccccccccc", seller_slug: "s", seller_name: "S",
          seller_city: "Jakarta", jurisdiction: "ID", seller_status: "active",
          cover_image_ref: null, logo_image_ref: null,
        }] });
      const out = await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" });
      expect(out.records[0].availability).toBe(expected);
    }
  });
});

// ─── TRANSPORT ───────────────────────────────────────────────────────
describe("TransportPostgresAdapter", () => {
  it("declares vertical 'transport'", () => {
    expect(TransportPostgresAdapter.vertical).toBe("transport");
  });

  it("SQL uses status IN (approved,active,live) AND is_available=true gate", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    queryMock.mockResolvedValueOnce({ rows: [] });
    await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" });
    const sqls = queryMock.mock.calls.map((c) => String(c[0]));
    for (const sql of sqls) {
      expect(sql).toContain("status IN ('approved','active','live')");
      expect(sql).toContain("is_available = true");
    }
  });

  it("provider record surfaces whatsapp, rating, price, amenities (bike, raincoat, plate, language)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        provider_id: "11111111-1111-1111-1111-111111111111",
        full_name: "Budi Santoso", whatsapp_e164: "+6281234567890",
        photo_url: "https://cdn.nex/budi.jpg",
        bike_slug: "honda-vario-160", bike_year: 2024, bike_color_hex: "#FF0000", plate: "AB1234YZ",
        city: "Yogyakarta", status: "approved",
        rating_avg: 4.8, rating_count: 24,
        price_per_service_idr: 75000, is_available: true,
        provides_raincoat: true, secondary_language: "English",
        updated_at: "2026-08-31T00:00:00Z",
      }] });
    const out = await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" });
    const r = out.records[0];
    expect(r.whatsapp).toBe("+6281234567890");
    expect(r.rating).toBe(4.8);
    expect(r.reviewCount).toBe(24);
    expect(r.price).toBe(75000);
    expect(r.availability).toBe("available");
    expect(r.amenities).toEqual(["honda-vario-160", "raincoat_available", "plate:AB1234YZ", "speaks:English"]);
    expect(r.claimStatus).toBe("claimed"); // provider profiles are always owner-claimed
    expect(r.provenance.ownerProvided).toBe(true);
  });
});

// ─── Cross-vertical honesty invariants ───────────────────────────────
describe("Cross-vertical honesty invariants", () => {
  it("EVERY adapter carries provenance.sourceKey referencing its DB table", async () => {
    const adapters = [
      { adapter: FoodPostgresAdapter,      key: "nex.food_business" },
      { adapter: ServicePostgresAdapter,   key: "nex.service_business" },
      { adapter: TransportPostgresAdapter, key: "nex.provider_profile" },
    ];
    for (const { adapter, key } of adapters) {
      queryMock.mockReset();
      queryMock
        .mockResolvedValueOnce({ rows: [{ n: 1 }] })
        .mockResolvedValueOnce({ rows: [makeMinimalRowFor(adapter.vertical)] });
      const out = await adapter.search({ vertical: adapter.vertical, market: "ID" });
      expect(out.records[0].provenance.sourceKey).toBe(key);
      expect(out.records[0].provenance.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

function makeMinimalRowFor(vertical: string): Record<string, unknown> {
  const base = {
    public_listing_ref: `${vertical}:1`, business_name: "X",
    city: "Yogyakarta", district: null, address: null,
    coordinates_lat: null, coordinates_lng: null,
    phone: null, whatsapp_number: null, website: null, public_social_links: null,
    hero_image_url: null,
    updated_at: "2026-08-31T00:00:00Z",
  };
  if (vertical === "food") return { ...base, category: "restaurant", categories: ["restaurant"], hero_image_approved: false, rating: null, review_count: null, claim_status: "listed", owner_status: "unknown" };
  if (vertical === "service") return { ...base, category_slug: "plumbing", categories: ["plumbing"], owner_status: null, claimed: false, verified: false, commercial_status: "prospect", status: "live" };
  if (vertical === "transport") return {
    provider_id: "11111111-1111-1111-1111-111111111111",
    full_name: "X", whatsapp_e164: "+6280000000000",
    photo_url: null,
    bike_slug: "x", bike_year: 2020, bike_color_hex: "#000", plate: "AB",
    city: "Yogyakarta", status: "approved",
    rating_avg: null, rating_count: 0, price_per_service_idr: null, is_available: true,
    provides_raincoat: false, secondary_language: null, updated_at: "2026-08-31T00:00:00Z",
  };
  return base;
}

// src/lib/nex/brain/world-adapters/live-update-doctrine.test.ts
//
// Stage 3.34e · LIVE UPDATE DOCTRINE tests per vertical (Philip 2026-08-31).
//
// Proves the same "DB change → next retrieval sees it, no sync, no
// cache" invariant for food · service · commerce · transport that
// accommodation-postgres.test.ts already proves for accommodation.
//
// Each vertical mocks the shared pool and returns different rows across
// two successive calls to demonstrate the adapter caches nothing.

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

// ─── FOOD live-update ────────────────────────────────────────────────
describe("FoodPostgresAdapter · LIVE UPDATE DOCTRINE", () => {
  const row = (o: Record<string, unknown>) => ({
    public_listing_ref: "food:1", business_name: "Warung X", category: "restaurant", categories: ["restaurant"],
    city: "Yogyakarta", district: null, address: null,
    coordinates_lat: -7.8, coordinates_lng: 110.4,
    phone: null, whatsapp_number: null, website: null, public_social_links: null,
    hero_image_url: null, hero_image_approved: false,
    rating: 4.0, review_count: 10, claim_status: "listed", owner_status: "unknown",
    updated_at: "2026-08-31T00:00:00Z", ...o,
  });

  it("rating change surfaces on next query · no cache", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ rating: 4.1 })] });
    const t1 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t1.records[0].rating).toBe(4.1);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ rating: 4.7 })] });
    const t2 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t2.records[0].rating).toBe(4.7);
    expect(queryMock).toHaveBeenCalledTimes(4);
  });

  it("new listing appears in next query", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ business_name: "Only" })] });
    const t1 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t1.records).toHaveLength(1);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 2 }] }).mockResolvedValueOnce({
      rows: [row({ business_name: "Only" }), row({ public_listing_ref: "food:2", business_name: "New Warung" })],
    });
    const t2 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t2.records).toHaveLength(2);
    expect(t2.records[1].name).toBe("New Warung");
  });

  it("hidden (claim_status→discovered) disappears", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({})] });
    const t1 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t1.records).toHaveLength(1);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] });
    const t2 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t2.records).toHaveLength(0);
  });

  it("hero_image_approved flip false→true → next query surfaces image", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ hero_image_url: "https://cdn/warung.jpg", hero_image_approved: false })] });
    const t1 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t1.records[0].heroImage).toBeUndefined();
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ hero_image_url: "https://cdn/warung.jpg", hero_image_approved: true })] });
    const t2 = await FoodPostgresAdapter.search({ vertical: "food", market: "ID" });
    expect(t2.records[0].heroImage).toBe("https://cdn/warung.jpg");
  });
});

// ─── SERVICE live-update ─────────────────────────────────────────────
describe("ServicePostgresAdapter · LIVE UPDATE DOCTRINE", () => {
  const row = (o: Record<string, unknown>) => ({
    public_listing_ref: "svc:1", business_name: "Plumber X", category_slug: "plumbing", categories: ["plumbing"],
    city: "Yogyakarta", district: null, address: null, coordinates_lat: null, coordinates_lng: null,
    phone: null, whatsapp_number: null, website: null, public_social_links: null,
    hero_image_url: null, owner_status: null,
    claimed: false, verified: false, status: "listed", commercial_status: "prospect",
    updated_at: "2026-08-31T00:00:00Z", ...o,
  });

  it("claim change unclaimed→claimed surfaces on next query · ownership updates", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({})] });
    const t1 = await ServicePostgresAdapter.search({ vertical: "service", market: "ID" });
    expect(t1.records[0].claimStatus).toBe("listed"); // unclaimed
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ claimed: true })] });
    const t2 = await ServicePostgresAdapter.search({ vertical: "service", market: "ID" });
    expect(t2.records[0].claimStatus).toBe("claimed");
  });

  it("hidden (visibility change) disappears", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({})] });
    expect((await ServicePostgresAdapter.search({ vertical: "service", market: "ID" })).records).toHaveLength(1);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] });
    expect((await ServicePostgresAdapter.search({ vertical: "service", market: "ID" })).records).toHaveLength(0);
  });

  it("verified flip false→true surfaces on next query", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ verified: false })] });
    expect((await ServicePostgresAdapter.search({ vertical: "service", market: "ID" })).records[0].verified).toBe(false);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ verified: true })] });
    expect((await ServicePostgresAdapter.search({ vertical: "service", market: "ID" })).records[0].verified).toBe(true);
  });
});

// ─── COMMERCE live-update ────────────────────────────────────────────
describe("CommercePostgresAdapter · LIVE UPDATE DOCTRINE", () => {
  const row = (o: Record<string, unknown>) => ({
    product_id: "00000000-0000-0000-0000-000000000001", slug: "x", product_name: "Sony Headphones",
    product_description: null, condition: "new",
    base_price_idr: 3000000, base_stock: 10, category_id: null,
    product_updated_at: "2026-08-31T00:00:00Z",
    seller_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", seller_slug: "s", seller_name: "S",
    seller_city: "Jakarta", jurisdiction: "ID", seller_status: "active",
    cover_image_ref: null, logo_image_ref: null, product_image_url: null, ...o,
  });

  it("price drop 3M→2.5M surfaces on next query", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ base_price_idr: 3000000 })] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records[0].price).toBe(3000000);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ base_price_idr: 2500000 })] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records[0].price).toBe(2500000);
  });

  it("stock depletion available→unavailable surfaces + availability signal flips", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ base_stock: 10 })] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records[0].availability).toBe("available");
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ base_stock: 0 })] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records[0].availability).toBe("unavailable");
  });

  it("product image added → next query card gets new image", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ product_image_url: null, cover_image_ref: "seller-cover.jpg" })] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records[0].heroImage).toBe("seller-cover.jpg");
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ product_image_url: "https://cdn/prod-hero.jpg", cover_image_ref: "seller-cover.jpg" })] });
    // Product image takes priority over seller cover.
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records[0].heroImage).toBe("https://cdn/prod-hero.jpg");
  });

  it("deactivated seller (status active→suspended) disappears", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({})] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records).toHaveLength(1);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] });
    expect((await CommercePostgresAdapter.search({ vertical: "commerce", market: "ID" })).records).toHaveLength(0);
  });
});

// ─── TRANSPORT live-update ───────────────────────────────────────────
describe("TransportPostgresAdapter · LIVE UPDATE DOCTRINE", () => {
  const row = (o: Record<string, unknown>) => ({
    provider_id: "11111111-1111-1111-1111-111111111111",
    full_name: "Budi", whatsapp_e164: "+6280000000000", photo_url: null,
    bike_slug: "honda-vario", bike_year: 2024, bike_color_hex: "#000", plate: "AB",
    city: "Yogyakarta", status: "approved",
    rating_avg: 4.5, rating_count: 20, price_per_service_idr: 50000, is_available: true,
    provides_raincoat: false, secondary_language: null,
    updated_at: "2026-08-31T00:00:00Z", ...o,
  });

  it("driver goes offline (is_available true→false) disappears", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({})] });
    expect((await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" })).records).toHaveLength(1);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 0 }] }).mockResolvedValueOnce({ rows: [] });
    expect((await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" })).records).toHaveLength(0);
  });

  it("price change surfaces + rating change surfaces", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ price_per_service_idr: 50000, rating_avg: 4.5 })] });
    let r = (await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" })).records[0];
    expect(r.price).toBe(50000); expect(r.rating).toBe(4.5);
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ price_per_service_idr: 75000, rating_avg: 4.9 })] });
    r = (await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" })).records[0];
    expect(r.price).toBe(75000); expect(r.rating).toBe(4.9);
  });

  it("raincoat flag flip → amenities updates", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ provides_raincoat: false })] });
    expect((await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" })).records[0].amenities)
      .not.toContain("raincoat_available");
    queryMock.mockResolvedValueOnce({ rows: [{ n: 1 }] }).mockResolvedValueOnce({ rows: [row({ provides_raincoat: true })] });
    expect((await TransportPostgresAdapter.search({ vertical: "transport", market: "ID" })).records[0].amenities)
      .toContain("raincoat_available");
  });
});

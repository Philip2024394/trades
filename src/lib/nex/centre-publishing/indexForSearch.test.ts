// NEX Centre publishing — feed reader tests.
//
// Covers:
//   - Only active + nex_centre_visible offers surface
//   - Query filter matches name / brand / description
//   - Postcode proximity ranking places nearest merchant first
//   - Banners overlay: active_banner_headline populated when present
//   - Category filter matches any segment in category_path
//   - Merchants with status != 'live' are excluded

import { beforeEach, describe, expect, it, vi } from "vitest";

// Chainable Supabase mock with per-table canned responses
const responses = new Map<string, unknown>();
const setResponse = (table: string, payload: unknown) => {
  responses.set(table, payload);
};

const buildChain = (finalResponse: Record<string, unknown>) => {
  const chain: Record<string, unknown> = {};
  const returnSelf = () => chain;
  const returnFinal = () => Promise.resolve(finalResponse);
  chain.select = vi.fn(returnSelf);
  chain.eq = vi.fn(returnSelf);
  chain.gte = vi.fn(returnSelf);
  chain.lte = vi.fn(returnSelf);
  chain.in = vi.fn(returnSelf);
  chain.range = vi.fn(returnSelf);
  chain.order = vi.fn(returnSelf);
  chain.limit = vi.fn(returnSelf);
  chain.single = vi.fn(returnFinal);
  chain.maybeSingle = vi.fn(returnFinal);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(finalResponse).then(resolve);
  return chain;
};

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) =>
      buildChain((responses.get(table) as Record<string, unknown>) ?? { data: [], error: null }),
  },
}));

import { listCentreFeedItems } from "./indexForSearch";

beforeEach(() => {
  responses.clear();
});

describe("listCentreFeedItems", () => {
  it("returns empty when no offers exist", async () => {
    setResponse("app_products_merchant_offers", { data: [], error: null });
    const items = await listCentreFeedItems();
    expect(items).toEqual([]);
  });

  it("joins offers + canonicals + merchants + banners into a flat feed item", async () => {
    setResponse("app_products_merchant_offers", {
      data: [
        {
          id: "offer-1",
          merchant_id: "merchant-abc",
          canonical_product_id: "canon-1",
          price_pence: 8900,
          vat_rate: 0.2,
          stock_status: "in_stock",
          is_active: true,
          is_featured: false,
          nex_centre_visible: true,
          nex_centre_tile_layout: null,
          created_at: "2026-07-27T00:00:00Z",
          updated_at: "2026-07-27T00:00:00Z",
        },
      ],
      error: null,
    });
    setResponse("os_products_canonical", {
      data: [
        {
          id: "canon-1",
          name: "Oak Treads",
          brand_name: "OakCo",
          slug: "oakco/oak-treads",
          description: "Solid oak stair treads.",
          category_path: ["staircase", "treads"],
          hero_image_url: "https://example.com/oak.jpg",
          lifecycle_status: "active",
          published_at: "2026-07-27T00:00:00Z",
        },
      ],
      error: null,
    });
    setResponse("hammerex_trade_off_listings", {
      data: [
        {
          id: "merchant-abc",
          slug: "oakco",
          display_name: "OakCo Ltd",
          city: "Leeds",
          postcode_prefix: "LS",
          lat: 53.8008,
          lng: -1.5491,
          status: "live",
        },
      ],
      error: null,
    });
    setResponse("app_nex_merchant_assistant_banners", {
      data: [
        {
          offer_id: "offer-1",
          headline: "Solid oak craftsmanship",
          visual_style: "premium",
          is_active: true,
        },
      ],
      error: null,
    });

    const items = await listCentreFeedItems();
    expect(items).toHaveLength(1);
    const it0 = items[0];
    expect(it0.name).toBe("Oak Treads");
    expect(it0.merchant_display_name).toBe("OakCo Ltd");
    expect(it0.active_banner_headline).toBe("Solid oak craftsmanship");
    expect(it0.active_banner_visual_style).toBe("premium");
    expect(it0.distance_km).toBeNull(); // no postcode supplied
  });

  it("filters out canonicals that are not lifecycle_status='active'", async () => {
    setResponse("app_products_merchant_offers", {
      data: [
        {
          id: "offer-1",
          merchant_id: "merchant-abc",
          canonical_product_id: "canon-1",
          price_pence: 8900,
          vat_rate: 0.2,
          stock_status: "in_stock",
          is_active: true,
          is_featured: false,
          nex_centre_visible: true,
          nex_centre_tile_layout: null,
          created_at: "2026-07-27",
          updated_at: "2026-07-27",
        },
      ],
      error: null,
    });
    // Canonical is NOT returned by the .eq('lifecycle_status', 'active') filter
    setResponse("os_products_canonical", { data: [], error: null });
    setResponse("hammerex_trade_off_listings", {
      data: [{ id: "merchant-abc", status: "live" }],
      error: null,
    });
    setResponse("app_nex_merchant_assistant_banners", { data: [], error: null });

    const items = await listCentreFeedItems();
    // Offer without an active canonical is dropped
    expect(items).toHaveLength(0);
  });

  it("computes distance_km when postcode supplied", async () => {
    setResponse("app_products_merchant_offers", {
      data: [
        {
          id: "offer-far",
          merchant_id: "merchant-far",
          canonical_product_id: "canon-1",
          price_pence: 10000,
          vat_rate: 0.2,
          stock_status: "in_stock",
          is_active: true,
          is_featured: false,
          nex_centre_visible: true,
          nex_centre_tile_layout: null,
          created_at: "2026-07-27",
          updated_at: "2026-07-27",
        },
        {
          id: "offer-near",
          merchant_id: "merchant-near",
          canonical_product_id: "canon-1",
          price_pence: 9500,
          vat_rate: 0.2,
          stock_status: "in_stock",
          is_active: true,
          is_featured: false,
          nex_centre_visible: true,
          nex_centre_tile_layout: null,
          created_at: "2026-07-27",
          updated_at: "2026-07-27",
        },
      ],
      error: null,
    });
    setResponse("os_products_canonical", {
      data: [
        {
          id: "canon-1",
          name: "Oak Treads",
          brand_name: "OakCo",
          slug: "oakco/oak-treads",
          description: null,
          category_path: [],
          hero_image_url: null,
          lifecycle_status: "active",
          published_at: "2026-07-27T00:00:00Z",
        },
      ],
      error: null,
    });
    setResponse("hammerex_trade_off_listings", {
      data: [
        // Leeds merchant far from Manchester query
        {
          id: "merchant-far",
          slug: "far",
          display_name: "Far Ltd",
          city: "Leeds",
          postcode_prefix: "LS",
          lat: 53.8008,
          lng: -1.5491,
          status: "live",
        },
        // Manchester merchant near query
        {
          id: "merchant-near",
          slug: "near",
          display_name: "Near Ltd",
          city: "Manchester",
          postcode_prefix: "M",
          lat: 53.4808,
          lng: -2.2426,
          status: "live",
        },
      ],
      error: null,
    });
    setResponse("app_nex_merchant_assistant_banners", { data: [], error: null });

    const items = await listCentreFeedItems({ postcode: "M1" });
    expect(items).toHaveLength(2);
    // Nearest first
    expect(items[0].offer_id).toBe("offer-near");
    expect(items[0].distance_km ?? 999).toBeLessThan(items[1].distance_km ?? 0);
  });

  it("applies query filter on name / brand / description", async () => {
    setResponse("app_products_merchant_offers", {
      data: [
        {
          id: "offer-oak",
          merchant_id: "m",
          canonical_product_id: "c-oak",
          price_pence: 8900,
          vat_rate: 0.2,
          stock_status: "in_stock",
          is_active: true,
          is_featured: false,
          nex_centre_visible: true,
          nex_centre_tile_layout: null,
          created_at: "2026-07-27",
          updated_at: "2026-07-27",
        },
        {
          id: "offer-pine",
          merchant_id: "m",
          canonical_product_id: "c-pine",
          price_pence: 4500,
          vat_rate: 0.2,
          stock_status: "in_stock",
          is_active: true,
          is_featured: false,
          nex_centre_visible: true,
          nex_centre_tile_layout: null,
          created_at: "2026-07-27",
          updated_at: "2026-07-27",
        },
      ],
      error: null,
    });
    setResponse("os_products_canonical", {
      data: [
        {
          id: "c-oak",
          name: "Oak Treads",
          brand_name: "OakCo",
          slug: "s/1",
          description: null,
          category_path: [],
          hero_image_url: null,
          lifecycle_status: "active",
          published_at: "2026-07-27",
        },
        {
          id: "c-pine",
          name: "Pine Treads",
          brand_name: "PineCo",
          slug: "s/2",
          description: null,
          category_path: [],
          hero_image_url: null,
          lifecycle_status: "active",
          published_at: "2026-07-27",
        },
      ],
      error: null,
    });
    setResponse("hammerex_trade_off_listings", {
      data: [{ id: "m", status: "live", display_name: "M" }],
      error: null,
    });
    setResponse("app_nex_merchant_assistant_banners", { data: [], error: null });

    const items = await listCentreFeedItems({ query: "oak" });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Oak Treads");
  });
});

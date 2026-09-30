// src/app/nex-native/cover/layout-ids.ts
//
// Server-safe list of the 10 sealed cover-layout ids. Kept in a
// plain (no "use client") module so server components can validate
// URL params against it. The layout COMPONENTS live in
// ./layouts.tsx which is "use client" — enumerable exports from a
// client module aren't visible to server components as plain data
// (they become opaque client references), so the id list has to
// live separately.
//
// Founder-sealed 2026-09-30 · ONE NEX IDENTITY doctrine · Bridge 98.

export const COVER_LAYOUT_IDS = [
  "cafe",
  "restaurant",
  "product",
  "tradesperson",
  "salon",
  "creator",
  "fashion",
  "street_food",
  "premium_business",
  "personal_brand",
  "product_landscape",
  "cafe_landscape",
  "personal_brand_landscape",
  "personal_brand_round",
] as const;

export type CoverLayoutId = (typeof COVER_LAYOUT_IDS)[number];

export const COVER_LAYOUT_LABELS: Record<CoverLayoutId, string> = {
  cafe: "Café",
  restaurant: "Modern Restaurant",
  product: "Product Seller",
  tradesperson: "Tradesperson",
  salon: "Beauty / Salon",
  creator: "Creator / Influencer",
  fashion: "Fashion Store",
  street_food: "Street Food / Delivery",
  premium_business: "Premium Business",
  personal_brand: "Personal Brand",
  product_landscape: "Product Seller · Landscape",
  cafe_landscape: "Café · Landscape",
  personal_brand_landscape: "Personal Brand · Landscape",
  personal_brand_round: "Personal Brand · Round Products",
};

export function isValidCoverLayoutId(id: string | undefined): id is CoverLayoutId {
  return !!id && (COVER_LAYOUT_IDS as readonly string[]).includes(id);
}

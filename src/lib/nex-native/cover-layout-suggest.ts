// src/lib/nex-native/cover-layout-suggest.ts
//
// Client-safe map from nex_business.business_category (19-value enum
// sealed in Migration 065) to a sensible default nex_business.
// cover_layout_id (10-value enum sealed in Migration 100).
//
// Applied at business creation so every new business starts with a
// non-NULL cover_layout_id · seller sees the real sealed cover
// immediately, no legacy fall-through. The seller can override the
// suggestion later via the /manage/shop cover-template picker.
//
// The mapping is opinionated · a fashion-adjacent ecommerce shop
// could arguably use Layout 07 (Fashion), but without a signal from
// the category alone we default to Layout 03 (Product). Sellers can
// swap after seeing the auto-pick.

import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";

// Founder-sealed 2026-09-30 · non-green templates removed. This
// mapping only returns ids that currently exist in COVER_LAYOUT_IDS.
// Categories that used to map to Restaurant / Tradesperson / Salon /
// Creator / Premium Business now fall back to the closest green
// template (cafe for food-shaped, product for shipping-shaped,
// personal_brand for identity-shaped verticals). Sellers can still
// override on /manage/shop.
export function suggestCoverLayoutId(
  businessCategory: string | null | undefined,
): CoverLayoutId {
  switch ((businessCategory ?? "").toLowerCase()) {
    case "cafe":
    case "bakery":
    case "restaurant":
      return "cafe";

    case "ecommerce":
    case "product-brand":
    case "tradesperson":
    case "construction":
    case "staircase-company":
      return "product";

    case "salon":
    case "beauty":
    case "creator":
    case "portfolio":
    case "fitness":
    case "local-service":
    case "consultant":
    case "agency":
    case "professional-service":
    case "community":
    case "event":
      return "personal_brand";

    default:
      // Safe default · a Product-style cover reads cleanly for almost
      // any vertical that didn't match above.
      return "product";
  }
}

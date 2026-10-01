// src/lib/nex-native/seller-lanes.ts
//
// Seller onboarding lanes · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Three top-level buckets we present at onboarding before showing the
// finer vertical + profession dropdowns:
//
//   · Products · physical goods sold directly
//   · Services · service providers (trades, pros, local services)
//   · Maker    · artisans, creators, craft
//
// The 25 nex_vertical rows map 1-to-many into these lanes. The lane
// chosen at onboarding filters the vertical dropdown; the chosen
// vertical filters the profession dropdown.
//
// Doctrine: adding a new vertical requires updating LANE_VERTICAL_MAP
// below so it has a home. A vertical NOT in the map falls into
// `services` by default (safe fallback).

export type SellerLane = "products" | "services" | "maker";

/** Canonical lane order used by the onboarding lane picker.
 *  Keep aligned with the LANES metadata below. */
export const LANE_ORDER: readonly SellerLane[] = [
  "products",
  "services",
  "maker",
] as const;

export interface LaneMeta {
  key: SellerLane;
  label: string;
  caption: string;
  /** Vertical slugs assigned to this lane · must match
   *  nex_vertical.slug values seeded by Migration 113. */
  verticalSlugs: string[];
}

export const LANES: Record<SellerLane, LaneMeta> = {
  products: {
    key: "products",
    label: "Products",
    caption: "Selling products",
    verticalSlugs: [
      "retail",
      "digital_products",
      "marketplace",
      "automotive",
      "rentals",
    ],
  },
  services: {
    key: "services",
    label: "Services",
    caption: "Offering services",
    verticalSlugs: [
      "trades",
      "food",
      "professional",
      "local_services",
      "beauty",
      "health",
      "education",
      "freelancer",
      "b2b",
      "real_estate",
      "travel",
      "construction",
      "events",
      "communities",
    ],
  },
  maker: {
    key: "maker",
    label: "Maker",
    caption: "Producing items",
    verticalSlugs: ["maker", "creative", "creator", "music", "brands"],
  },
};

/** Resolve a vertical slug to its lane. Falls back to `services` if the
 *  slug is unknown (safe default — services is the broadest lane). */
export function laneForVerticalSlug(slug: string): SellerLane {
  for (const lane of LANE_ORDER) {
    if (LANES[lane].verticalSlugs.includes(slug)) return lane;
  }
  return "services";
}

/** Default vertical slug for a lane — used at onboarding when the
 *  seller has only picked a lane (not a specific category). Gives the
 *  new business a sensible starting vertical so terminology + cover
 *  templates have a baseline. The seller can refine the exact
 *  category + subcategory later from /manage/profession once they've
 *  added products (future bridge: LLM classification on first product
 *  listings auto-suggests the finer category). */
export function defaultVerticalSlugForLane(lane: SellerLane): string {
  switch (lane) {
    case "products":
      return "retail";
    case "services":
      return "local_services";
    case "maker":
      return "maker";
  }
}

/** Map the chat chooser's `?type=` hint to a seller lane so the
 *  wizard can pre-select the right lane on arrival. */
export function laneFromChooserType(
  type: string | null | undefined,
): SellerLane | null {
  if (type === "product") return "products";
  if (type === "food") return "services";
  if (type === "service") return "services";
  if (type === "maker") return "maker";
  return null;
}

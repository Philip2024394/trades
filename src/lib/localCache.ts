// Local-cache fallback for Russell + Stuart. When Supabase REST is
// unreachable (project egress-capped, network down, incident), the
// profile pages read from this snapshot instead of 404'ing.
//
// Rebuild the snapshot with: node scripts/build-local-cache.mjs
//
// The cache is opt-in per-query via getCachedListing / getCachedReviews.
// Callers do their normal Supabase query first, then fall back to this
// helper when the row is missing.

import profiles from "./cache/profiles.json";
import type {
  HammerexTradeOffListing,
  HammerexTradeOffProject,
  HammerexXratedProduct
} from "./supabase";

type Snapshot = {
  listing: HammerexTradeOffListing;
  projects: HammerexTradeOffProject[];
  reviews: XratedReviewPublic[];
  products: HammerexXratedProduct[];
};

type XratedReviewPublic = {
  id: string;
  customer_name: string;
  customer_postcode: string | null;
  customer_avatar_url: string | null;
  project_type: string | null;
  service_name: string | null;
  overall_rating: number;
  workmanship_rating: number | null;
  communication_rating: number | null;
  value_rating: number | null;
  timeliness_rating: number | null;
  body: string;
  status: "live" | "disputed";
  public_response: string | null;
  submitted_at: string;
};

const CACHE = profiles as Record<string, Snapshot>;

export function getCachedProfile(slug: string): Snapshot | null {
  return CACHE[slug] ?? null;
}

export function getCachedListing(slug: string): HammerexTradeOffListing | null {
  return CACHE[slug]?.listing ?? null;
}

export function getCachedProducts(
  slug: string,
  filter?: { categories?: string[]; limit?: number }
): HammerexXratedProduct[] {
  const bundle = CACHE[slug];
  if (!bundle) return [];
  let out = bundle.products;
  if (filter?.categories && filter.categories.length > 0) {
    const set = new Set(filter.categories);
    out = out.filter((p) => p.merchant_category && set.has(p.merchant_category));
  }
  if (filter?.limit && out.length > filter.limit) out = out.slice(0, filter.limit);
  return out;
}

export function getCachedReviews(slug: string): XratedReviewPublic[] {
  return CACHE[slug]?.reviews ?? [];
}

export function getCachedProjects(slug: string): HammerexTradeOffProject[] {
  return CACHE[slug]?.projects ?? [];
}

export function isSlugCached(slug: string): boolean {
  return slug in CACHE;
}

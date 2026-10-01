// src/lib/nex-native/affiliate-marketplace-service.ts
//
// NEX Affiliate Marketplace service · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Reads + writes the junction between affiliates and the sellers they
// promote (Migration 124 · nex_affiliate_promotion). Also surfaces the
// opted-in seller catalogue the Marketplace page lists.
//
// Attribution + commission ledger live in later bridges; this module
// is strictly about the discovery + opt-in flow.

import { nexSupabaseAdmin } from "./supabase-admin";

export interface NexPromotion {
  id: string;
  affiliate_account_id: string;
  business_id: string;
  started_at: string;
  dropped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NexResellerBusiness {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  reseller_enabled_at: string | null;
}

/** List the affiliate's currently-active promotions (dropped_at IS NULL).
 *  Returns the raw junction rows; callers hydrate the business details
 *  separately via getBusinessesByIds to avoid N+1 queries. */
export async function listActivePromotions(
  affiliateAccountId: string,
): Promise<NexPromotion[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_affiliate_promotion")
    .select("*")
    .eq("affiliate_account_id", affiliateAccountId)
    .is("dropped_at", null)
    .order("started_at", { ascending: false });
  if (error) {
    throw new Error(
      `affiliate-marketplace-service.listActivePromotions: ${error.message}`,
    );
  }
  return (data ?? []) as NexPromotion[];
}

/** List every reseller-enabled business ordered by most-recently-enabled.
 *  The Marketplace page shows these as the Available-to-promote cards
 *  (minus the ones the viewer already promotes). */
export async function listResellerEnabledBusinesses(
  limit = 60,
): Promise<NexResellerBusiness[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select(
      "id, slug, display_name, description, logo_url, city, reseller_enabled_at",
    )
    .eq("reseller_enabled", true)
    .order("reseller_enabled_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    throw new Error(
      `affiliate-marketplace-service.listResellerEnabledBusinesses: ${error.message}`,
    );
  }
  return (data ?? []) as NexResellerBusiness[];
}

/** Fetch a specific business set in a single query (hydration helper
 *  used after listActivePromotions returns a set of business IDs). */
export async function getResellerBusinessesByIds(
  ids: string[],
): Promise<NexResellerBusiness[]> {
  if (ids.length === 0) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select(
      "id, slug, display_name, description, logo_url, city, reseller_enabled_at",
    )
    .in("id", ids);
  if (error) {
    throw new Error(
      `affiliate-marketplace-service.getResellerBusinessesByIds: ${error.message}`,
    );
  }
  return (data ?? []) as NexResellerBusiness[];
}

/** Promote a seller · idempotent · inserts a fresh active row if the
 *  affiliate isn't already promoting this seller. If a historical row
 *  exists with dropped_at set, we leave it alone and insert a new
 *  active row (preserves attribution audit trail). */
export async function startPromotion(
  affiliateAccountId: string,
  businessId: string,
): Promise<NexPromotion> {
  // Guard: already actively promoting? Return the existing row.
  const { data: existing, error: lookupError } = await nexSupabaseAdmin
    .from("nex_affiliate_promotion")
    .select("*")
    .eq("affiliate_account_id", affiliateAccountId)
    .eq("business_id", businessId)
    .is("dropped_at", null)
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    throw new Error(
      `affiliate-marketplace-service.startPromotion lookup: ${lookupError.message}`,
    );
  }
  if (existing) return existing as NexPromotion;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_affiliate_promotion")
    .insert({
      affiliate_account_id: affiliateAccountId,
      business_id: businessId,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `affiliate-marketplace-service.startPromotion: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexPromotion;
}

/** Cancel an active promotion · sets dropped_at = now() on the one
 *  active row for this (affiliate, seller) pair. Soft-delete preserves
 *  the row for commission-ledger history. No-op if nothing active. */
export async function cancelPromotion(
  affiliateAccountId: string,
  businessId: string,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_affiliate_promotion")
    .update({ dropped_at: new Date().toISOString() })
    .eq("affiliate_account_id", affiliateAccountId)
    .eq("business_id", businessId)
    .is("dropped_at", null);
  if (error) {
    throw new Error(
      `affiliate-marketplace-service.cancelPromotion: ${error.message}`,
    );
  }
}

/** List every live product from every seller this affiliate is
 *  currently promoting. Returns the UNION of nex_product rows across
 *  active promotions, ordered by seller display name then product
 *  position within the seller.
 *
 *  Used by:
 *   · the affiliate dashboard to show "N products from M sellers"
 *   · the affiliate's public shop page (future bridge) to render the
 *     product grid buyers browse
 *   · the chat shop slider when a buyer opens an affiliate's chat
 *
 *  Sealed 2026-10-01 · Affiliate Marketplace. */
export interface NexPromotedProduct {
  id: string;
  business_id: string;
  business_slug: string;
  business_display_name: string;
  name: string;
  description: string | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  price_pence: number;
  currency: string;
  stock_status: string | null;
  tags: string[] | null;
  section_id: string | null;
  created_at: string;
}

export async function listPromotedProductsForAffiliate(
  affiliateAccountId: string,
  limit = 200,
): Promise<NexPromotedProduct[]> {
  // Step 1 · get the active promotions.
  const promos = await listActivePromotions(affiliateAccountId);
  if (promos.length === 0) return [];
  const businessIds = promos.map((p) => p.business_id);

  // Step 2 · fetch the live products from every promoted business in
  // one query. We also need the seller's display_name + slug for the
  // card metadata, so include a join on nex_business.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select(
      `
      id,
      business_id,
      name,
      description,
      image_url,
      gallery_urls,
      price_pence,
      currency,
      stock_status,
      tags,
      section_id,
      created_at,
      nex_business:business_id ( slug, display_name )
    `,
    )
    .in("business_id", businessIds)
    .eq("status", "live")
    .order("business_id", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(
      `affiliate-marketplace-service.listPromotedProductsForAffiliate: ${error.message}`,
    );
  }

  interface JoinedRow {
    id: string;
    business_id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    gallery_urls: string[] | null;
    price_pence: number;
    currency: string;
    stock_status: string | null;
    tags: string[] | null;
    section_id: string | null;
    created_at: string;
    nex_business: { slug: string; display_name: string } | null;
  }

  const rows = (data ?? []) as unknown as JoinedRow[];
  const out: NexPromotedProduct[] = rows.map((r) => ({
    id: r.id,
    business_id: r.business_id,
    business_slug: r.nex_business?.slug ?? "",
    business_display_name: r.nex_business?.display_name ?? "",
    name: r.name,
    description: r.description,
    image_url: r.image_url,
    gallery_urls: r.gallery_urls,
    price_pence: r.price_pence,
    currency: r.currency,
    stock_status: r.stock_status,
    tags: r.tags,
    section_id: r.section_id,
    created_at: r.created_at,
  }));

  // Sort by seller name then by product recency within that seller
  // so the affiliate's shop reads as grouped-by-seller rather than
  // a chaotic mix.
  out.sort((a, b) => {
    const nameCmp = a.business_display_name.localeCompare(
      b.business_display_name,
    );
    if (nameCmp !== 0) return nameCmp;
    return a.created_at < b.created_at ? 1 : -1;
  });
  return out;
}

/** Return a seller's first N live product images for the Marketplace
 *  card thumbnail row. Falls back to an empty list if the business
 *  has no live products yet. */
export async function listProductThumbnailsForBusiness(
  businessId: string,
  limit = 4,
): Promise<string[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("image_url")
    .eq("business_id", businessId)
    .eq("status", "live")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? [])
    .map((r) => (r.image_url as string | null) ?? null)
    .filter((u): u is string => !!u);
}

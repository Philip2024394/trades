// siteAccess — clean-download entitlement check for The Site.
//
// Answers: "can this requester download image X without a watermark?"
// Truthy iff any of:
//   1. Merchant has an active £14.99/mo unlimited subscription
//   2. Merchant sits on a bundling tier (Professional / Works)
//   3. Requester has a paid purchase for this specific image
//
// Used by the download endpoint + card UI ("owned" chip / hide buy button).
//
// SERVER-ONLY. Reads via supabaseAdmin because the ledger is not RLS-
// readable by the anon key.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tierFromDbValue } from "@/lib/tierCatalog";

export type SiteAccessRequester = {
  /** Signed-in merchant slug (network_merchant_slug) — preferred identity. */
  merchantSlug: string | null;
  /** Email fallback for anonymous buyers (guest checkout). */
  email:        string | null;
};

export type SiteAccessResult = {
  hasClean:  boolean;
  /** Which rule granted access (or "none" when hasClean is false).
   *  Used by the UI to render appropriate chips ("Subscribed",
   *  "Bundled with Pro", "Purchased") without extra lookups. */
  reason:    "subscription" | "tier-bundled" | "purchase" | "none";
};

/** Returns true when the merchant currently has an active site sub. */
export async function hasActiveSiteSubscription(
  merchantSlug: string | null | undefined
): Promise<boolean> {
  if (!merchantSlug) return false;
  const res = await supabaseAdmin
    .from("hammerex_site_subscriptions")
    .select("id, status, current_period_end")
    .eq("merchant_slug", merchantSlug)
    .in("status", ["active", "trialing"])
    .gt("current_period_end", new Date().toISOString())
    .maybeSingle();
  return Boolean(res.data);
}

/** Returns true when the merchant's listing tier bundles Site access
 *  (Professional and The Works — see tierCatalog.siteInterestBundled). */
export async function hasBundlingTier(
  merchantSlug: string | null | undefined
): Promise<boolean> {
  if (!merchantSlug) return false;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("tier")
    .eq("slug", merchantSlug)
    .maybeSingle();
  if (!res.data) return false;
  const tier = tierFromDbValue(res.data.tier as string | null);
  return tier.siteInterestBundled === true;
}

/** Returns true when a paid purchase row exists for (image_id, buyer). */
export async function hasPurchasedImage(
  imageId: string,
  requester: SiteAccessRequester
): Promise<boolean> {
  if (!imageId) return false;
  const orClauses: string[] = [];
  if (requester.merchantSlug) {
    orClauses.push(`buyer_merchant_slug.eq.${requester.merchantSlug}`);
  }
  if (requester.email) {
    orClauses.push(`buyer_email.eq.${requester.email.toLowerCase()}`);
  }
  if (orClauses.length === 0) return false;

  const res = await supabaseAdmin
    .from("hammerex_site_purchases")
    .select("id")
    .eq("image_id", imageId)
    .eq("status", "paid")
    .or(orClauses.join(","))
    .limit(1)
    .maybeSingle();
  return Boolean(res.data);
}

/** Single-call access check — returns hasClean + reason. Cheapest path
 *  wins (subscription > tier-bundled > purchase) so the UI can show the
 *  most valuable badge when multiple rules match. */
export async function siteAccessFor(
  imageId: string,
  requester: SiteAccessRequester
): Promise<SiteAccessResult> {
  if (await hasActiveSiteSubscription(requester.merchantSlug)) {
    return { hasClean: true, reason: "subscription" };
  }
  if (await hasBundlingTier(requester.merchantSlug)) {
    return { hasClean: true, reason: "tier-bundled" };
  }
  if (await hasPurchasedImage(imageId, requester)) {
    return { hasClean: true, reason: "purchase" };
  }
  return { hasClean: false, reason: "none" };
}

export type SiteViewerEntitlement = {
  /** True when the viewer has SITE-wide clean access via subscription
   *  or bundling tier — every image is entitled without a per-image
   *  lookup. UI can render a single "Subscribed" chip and skip the
   *  ownedImageIds set entirely. */
  hasBlanket:     boolean;
  blanketReason:  "subscription" | "tier-bundled" | null;
  /** Individual image IDs the viewer has purchased. Empty when
   *  hasBlanket=true (blanket covers everything — no need to enumerate)
   *  OR when the viewer has no purchases in the queried set. */
  ownedImageIds:  string[];
};

/** Batch entitlement resolver for the search wall. Runs the two
 *  blanket checks ONCE (subscription + tier), and only falls back to a
 *  single scoped purchases query for the imageIds in this viewport
 *  when neither blanket rule applies. Cheap enough to run on every
 *  page render — one round trip on the blanket path, two on the
 *  purchase path, none of them fanning-out per card. */
export async function siteEntitlementForViewer(
  imageIds:  string[],
  requester: SiteAccessRequester
): Promise<SiteViewerEntitlement> {
  if (await hasActiveSiteSubscription(requester.merchantSlug)) {
    return { hasBlanket: true, blanketReason: "subscription",  ownedImageIds: [] };
  }
  if (await hasBundlingTier(requester.merchantSlug)) {
    return { hasBlanket: true, blanketReason: "tier-bundled",  ownedImageIds: [] };
  }
  if (imageIds.length === 0) {
    return { hasBlanket: false, blanketReason: null, ownedImageIds: [] };
  }
  const orClauses: string[] = [];
  if (requester.merchantSlug) {
    orClauses.push(`buyer_merchant_slug.eq.${requester.merchantSlug}`);
  }
  if (requester.email) {
    orClauses.push(`buyer_email.eq.${requester.email.toLowerCase()}`);
  }
  if (orClauses.length === 0) {
    return { hasBlanket: false, blanketReason: null, ownedImageIds: [] };
  }
  const res = await supabaseAdmin
    .from("hammerex_site_purchases")
    .select("image_id")
    .in("image_id", imageIds)
    .eq("status", "paid")
    .or(orClauses.join(","));
  const owned = Array.from(
    new Set((res.data ?? []).map((r) => String(r.image_id)))
  );
  return { hasBlanket: false, blanketReason: null, ownedImageIds: owned };
}

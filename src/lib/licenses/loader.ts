// Licence loader — Supabase queries backing the tier resolver + the
// merchant "my licences" dashboard + the marketplace availability
// checks.
//
// Every function short-circuits (returns empty / null) when Supabase
// creds are missing so the app still runs in local dev.

import { createClient } from "@supabase/supabase-js";
import type {
  ImageLicense,
  LicenseStatus,
  LicenseTier,
  BuyerType
} from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function rowToLicense(row: Record<string, unknown>): ImageLicense {
  return {
    id: row.id as string,
    imageId: row.image_id as string,
    buyerType: row.buyer_type as BuyerType,
    buyerMerchantId: (row.buyer_merchant_id as string | null) ?? null,
    buyerEmail: (row.buyer_email as string | null) ?? null,
    licenseTier: row.license_tier as LicenseTier,
    postcodePrefix: (row.postcode_prefix as string | null) ?? null,
    amountPence: row.amount_pence as number,
    currency: row.currency as string,
    stripeSessionId: (row.stripe_session_id as string | null) ?? null,
    stripePaymentIntentId:
      (row.stripe_payment_intent_id as string | null) ?? null,
    status: row.status as LicenseStatus,
    startsAt: row.starts_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

/** All active licences a merchant holds. Used to render the "My
 *  licences" dashboard + to pre-compute tier resolution for the
 *  merchant's whole page. */
export async function loadActiveLicensesForMerchant(
  merchantId: string
): Promise<ImageLicense[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("image_licenses")
    .select("*")
    .eq("buyer_merchant_id", merchantId)
    .eq("status", "active");
  return (data ?? []).map(rowToLicense);
}

/** The most permissive active licence for (imageId, merchantId).
 *  If a full_buyout exists, returned. Else if regional_exclusive,
 *  returned. Else if extended, returned. Else if standard, returned.
 *  Else null. */
export async function loadBestLicenseForMerchant(
  imageId: string,
  merchantId: string
): Promise<ImageLicense | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("image_licenses")
    .select("*")
    .eq("image_id", imageId)
    .eq("buyer_merchant_id", merchantId)
    .eq("status", "active");
  if (!data || data.length === 0) return null;
  const licenses = data.map(rowToLicense);
  return bestLicense(licenses);
}

/** Same but for external buyer identified by email. */
export async function loadBestLicenseForEmail(
  imageId: string,
  email: string
): Promise<ImageLicense | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("image_licenses")
    .select("*")
    .eq("image_id", imageId)
    .eq("buyer_email", email)
    .eq("status", "active");
  if (!data || data.length === 0) return null;
  return bestLicense(data.map(rowToLicense));
}

/** Any active full_buyout on this image — if so, the image is
 *  effectively removed from the general catalogue. Used to filter
 *  the hero library at query time. */
export async function loadFullBuyoutFor(
  imageId: string
): Promise<ImageLicense | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("image_licenses")
    .select("*")
    .eq("image_id", imageId)
    .in("license_tier", ["full_buyout", "competitor"])
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return rowToLicense(data);
}

/** Regional exclusive holder for (imageId, postcodePrefix). Used when
 *  another merchant tries to use the same image in the same area. */
export async function loadRegionalExclusive(
  imageId: string,
  postcodePrefix: string
): Promise<ImageLicense | null> {
  const c = client();
  if (!c) return null;
  const { data } = await c
    .from("image_licenses")
    .select("*")
    .eq("image_id", imageId)
    .eq("postcode_prefix", postcodePrefix)
    .eq("license_tier", "regional_exclusive")
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return rowToLicense(data);
}

/** All active regional_exclusive rows in a postcode district — used
 *  to build the "blocked images for this area" filter fast at library
 *  query time. Returns a Set of imageIds owned by OTHER merchants
 *  (excludes the caller's own rows). */
export async function loadBlockedImageIdsForArea(
  postcodePrefix: string,
  ownerMerchantId: string
): Promise<Set<string>> {
  const c = client();
  if (!c) return new Set();
  const { data } = await c
    .from("image_licenses")
    .select("image_id, buyer_merchant_id")
    .eq("postcode_prefix", postcodePrefix)
    .eq("license_tier", "regional_exclusive")
    .eq("status", "active");
  if (!data) return new Set();
  const blocked = new Set<string>();
  for (const row of data) {
    if (row.buyer_merchant_id !== ownerMerchantId) {
      blocked.add(row.image_id as string);
    }
  }
  return blocked;
}

/** Create a pending licence row. Called by the checkout endpoint
 *  BEFORE handing off to Stripe so we have a row to correlate with
 *  the eventual webhook. */
export async function createPendingLicense(input: {
  imageId: string;
  buyerType: BuyerType;
  buyerMerchantId?: string;
  buyerEmail?: string;
  licenseTier: LicenseTier;
  postcodePrefix?: string;
  amountPence: number;
  currency?: string;
  stripeSessionId?: string;
  expiresAt?: string;
}): Promise<string | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c
    .from("image_licenses")
    .insert({
      image_id: input.imageId,
      buyer_type: input.buyerType,
      buyer_merchant_id: input.buyerMerchantId ?? null,
      buyer_email: input.buyerEmail ?? null,
      license_tier: input.licenseTier,
      postcode_prefix: input.postcodePrefix ?? null,
      amount_pence: input.amountPence,
      currency: input.currency ?? "GBP",
      stripe_session_id: input.stripeSessionId ?? null,
      status: "pending",
      expires_at: input.expiresAt ?? null
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

/** Mark a pending licence as active. Called by the webhook after
 *  Stripe confirms payment. */
export async function activateLicense(
  licenseId: string,
  paymentIntentId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("image_licenses")
    .update({
      status: "active",
      stripe_payment_intent_id: paymentIntentId
    })
    .eq("id", licenseId);
  return !error;
}

export async function activateLicenseBySessionId(
  stripeSessionId: string,
  paymentIntentId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("image_licenses")
    .update({
      status: "active",
      stripe_payment_intent_id: paymentIntentId
    })
    .eq("stripe_session_id", stripeSessionId);
  return !error;
}

/** Rank licences by permissiveness — buyout > regional > extended >
 *  competitor > standard. Returns the highest. */
function bestLicense(licenses: ImageLicense[]): ImageLicense | null {
  const rank: Record<LicenseTier, number> = {
    full_buyout: 5,
    competitor: 4,
    regional_exclusive: 3,
    extended: 2,
    standard: 1
  };
  let best: ImageLicense | null = null;
  for (const l of licenses) {
    if (!best || rank[l.licenseTier] > rank[best.licenseTier]) {
      best = l;
    }
  }
  return best;
}

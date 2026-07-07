// OS Foundation — Merchant session.
//
// The canonical merchant identity for every server-side route. Wraps
// loadStudioSession() from src/lib/studio/session.ts (production-grade
// cookie-based auth against hammerex_trade_off_listings.edit_token)
// and exposes a small, apps-friendly surface:
//
//   • getMerchantId()             — quick check
//   • loadMerchantSession()       — full session with merchant + brand
//   • requireMerchantSession()    — throws if no session
//   • buildDevOverride()          — DEV-ONLY escape hatch for local tests
//
// This file replaces the historical stub at src/lib/ai-visualiser/merchantAuth.ts.
// The stub is kept as a re-export shim during the migration window and
// deleted at end-of-sprint.
//
// Direction of travel: every app-level route imports from HERE, never
// from an app namespace. The Constitution requires core primitives to
// live under src/lib/os/.
import "server-only";
import { loadStudioSession } from "@/lib/studio/session";

export type MerchantSession = {
  merchantId: string;
  displayName: string;
  primaryTrade: string;
  slug: string;
  brandId: string;
  brandName: string;
};

/** Return the merchant id from the studio session, or null. */
export async function getMerchantId(): Promise<string | null> {
  const s = await loadStudioSession();
  return s?.merchant.id ?? null;
}

export async function loadMerchantSession(): Promise<MerchantSession | null> {
  const s = await loadStudioSession();
  if (!s) return null;
  return {
    merchantId: s.merchant.id,
    displayName: s.merchant.display_name,
    primaryTrade: s.merchant.primary_trade,
    slug: s.merchant.slug,
    brandId: s.brand.id,
    brandName: s.brand.name
  };
}

/** Throws a distinct error type callers can catch to return 401. */
export class MerchantNotAuthenticatedError extends Error {
  constructor() {
    super("Merchant not authenticated.");
    this.name = "MerchantNotAuthenticatedError";
  }
}

export async function requireMerchantSession(): Promise<MerchantSession> {
  const s = await loadMerchantSession();
  if (!s) throw new MerchantNotAuthenticatedError();
  return s;
}

// -------------------------------------------------------------------
// DEPRECATED SHIM
// -------------------------------------------------------------------
//
// getMerchantIdFromRequest() historically accepted a ?m=<uuid> query
// param OR AI_VISUALISER_DEFAULT_MERCHANT_ID env fallback. Both were
// documented as "for now" and both leaked into production paths. This
// wrapper preserves the CALL SIGNATURE for the last few routes that
// still call it, but ignores the argument entirely and always returns
// the session-bound merchant id.
//
// After the sprint refactor list is complete this export is deleted.
export async function getMerchantIdFromRequest(
  _override: string | null | undefined
): Promise<string | null> {
  return getMerchantId();
}

// NEX Merchant Assistant — merchant context loader.
//
// Every chat request loads the caller's merchant identity + business
// summary + credentials in one place. The loader normalises the
// merchant session into the MerchantContext shape that every tool
// executor consumes.
//
// Session sources (in order): the signed xrated_trade_session cookie
// (verified via tradeSession.ts) → the stub cookie when
// NETWORK_SESSION_STUB=1. If neither yields a merchant, the assistant
// endpoint returns 401.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 9.1
// Reference: src/lib/merchantSession.ts · getMerchantIdentity

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import type { MerchantContext } from "./types";

/** Load the caller's merchant context. Returns null when no merchant
 *  is signed in — the endpoint MUST 401 in that case. */
export async function loadMerchantContextFromSession(): Promise<MerchantContext | null> {
  const identity = await getMerchantIdentity();
  if (!identity) return null;

  const { slug, listingId } = identity;
  if (!listingId) {
    // Stub-cookie session — return partial context for local dev
    return {
      merchantId: "stub-" + slug,
      slug,
      businessName: slug,
      verificationLevel: "listed",
      tier: null,
      tradeType: null,
    };
  }

  // Schema audit 2026-07-27: real columns on hammerex_trade_off_listings
  // are display_name (not business_name), primary_trade (not trade_type),
  // trust_tier (not tier). verification_level does not exist as a single
  // column — hammerex_standard_verified boolean + trust_tier text is the
  // closest equivalent. NEX-level verification_level lives in the
  // merchant-directory JSON layer, not here.
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, trust_tier, hammerex_standard_verified"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (!data) {
    // Listing was signed but no longer exists — fail closed
    return null;
  }

  // Map trust_tier + hammerex_standard_verified onto the 4-level
  // verification model used by the Business Listing Trust Architecture:
  //   trust_tier 'platinum' + verified   → 'partner'
  //   hammerex_standard_verified true    → 'verified'
  //   trust_tier non-bronze              → 'claimed'
  //   default                             → 'listed'
  const trustTier = (data.trust_tier as string) ?? "bronze";
  const stdVerified = (data.hammerex_standard_verified as boolean) === true;
  let verificationLevel: MerchantContext["verificationLevel"] = "listed";
  if (stdVerified && trustTier === "platinum") verificationLevel = "partner";
  else if (stdVerified) verificationLevel = "verified";
  else if (trustTier !== "bronze") verificationLevel = "claimed";

  return {
    merchantId: data.id as string,
    slug: (data.slug as string) ?? slug,
    businessName: (data.display_name as string) ?? null,
    verificationLevel,
    tier: trustTier,
    tradeType: (data.primary_trade as string) ?? null,
  };
}

/** Convenience: build the system-prompt lead line so NEX always
 *  knows who it is talking to. Kept here (not in promptBuilder) so
 *  callers can log/audit exactly what identity string went to the LLM. */
export function formatMerchantIdentityForPrompt(ctx: MerchantContext): string {
  const parts = [`You are helping ${ctx.businessName ?? ctx.slug}`];
  if (ctx.tradeType) parts.push(`(trade: ${ctx.tradeType})`);
  if (ctx.verificationLevel && ctx.verificationLevel !== "listed") {
    parts.push(`[NEX ${ctx.verificationLevel} tier]`);
  }
  return parts.join(" ");
}

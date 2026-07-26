// NEX Centre — publish-to-feed helper.
//
// Called from the merchant assistant approve endpoint after the
// underlying product transitions to lifecycle_status='active'. In V1
// this is a light-touch operation because the feed reads from the
// canonical tables at query time — no materialised view to refresh.
// The helper's job is:
//
//   1. Ensure the merchant offer's nex_centre_visible flag reflects
//      the merchant's opt-in setting (default true).
//   2. Return a summary the endpoint can persist as an audit note.
//
// When the feed grows past ~10k products this file is where the
// materialised-view refresh + search-index push will land.
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Amendment F

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PublishToFeedResult = {
  ok: boolean;
  offer_ids_included: string[];
  offer_ids_hidden: string[];
  reason?: string;
};

/** Given a canonical product that just went active, make sure every
 *  merchant offer on that canonical has an explicit centre-visibility
 *  value (default true). Callers pre-check ownership. */
export async function publishToFeed(input: {
  canonicalId: string;
  merchantId: string;
}): Promise<PublishToFeedResult> {
  const { data: offers } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .select("id, is_active, nex_centre_visible")
    .eq("canonical_product_id", input.canonicalId)
    .eq("merchant_id", input.merchantId);

  if (!offers || offers.length === 0) {
    return {
      ok: false,
      offer_ids_included: [],
      offer_ids_hidden: [],
      reason: "No offers to publish for this canonical.",
    };
  }

  const included = offers
    .filter(
      (o) =>
        (o.is_active as boolean) === true &&
        (o.nex_centre_visible as boolean) === true
    )
    .map((o) => o.id as string);

  const hidden = offers
    .filter((o) => (o.nex_centre_visible as boolean) === false)
    .map((o) => o.id as string);

  return {
    ok: true,
    offer_ids_included: included,
    offer_ids_hidden: hidden,
  };
}

/** Merchant toggle: hide an offer from the NEX Centre feed (or unhide
 *  it) without withdrawing the underlying product. Ownership is
 *  re-checked at SQL level via .eq(). */
export async function setOfferCentreVisibility(input: {
  merchantId: string;
  offerId: string;
  visible: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("app_products_merchant_offers")
    .update({ nex_centre_visible: input.visible })
    .eq("id", input.offerId)
    .eq("merchant_id", input.merchantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

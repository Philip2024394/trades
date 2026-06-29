// Dev-only runtime assertions for merchant/service render-context drift.
//
// Production builds skip the check entirely via the NODE_ENV guard so
// there is zero runtime cost on customer-facing requests. The purpose
// is to catch a refactor that wires a merchant component into a service
// profile (or vice versa) BEFORE it ships — the console error fires
// the moment the page renders in dev.
//
// The component layer is still responsible for hard-gating with
// isStorefrontOn / isShopModeOn / isMerchantGradeTrade. These helpers
// are noisy backstops, not load-bearing gates.

import { isMerchantGradeTrade } from "@/lib/tradeOff";

/** Warn (dev only) when a merchant-only component renders for a listing
 *  whose primary_trade is not in the merchant-grade set AND that has not
 *  manually opted into a storefront add-on. Call from the top of the
 *  component function body — production builds early-return before any
 *  work.
 *
 *  We accept the manual-opt-in path (addons_enabled.shop_mode === true
 *  or addons_enabled.wholesale_mode === true) so a sole-trader plumber
 *  who paid for Shop Mode doesn't trigger a false-positive warning. */
export function assertMerchantContext(
  listing: {
    primary_trade: string | null;
    addons_enabled?: Record<string, unknown> | null;
  },
  componentName: string
): void {
  if (process.env.NODE_ENV !== "development") return;
  if (isMerchantGradeTrade(listing.primary_trade)) return;
  const map = listing.addons_enabled ?? {};
  if (map.shop_mode === true || map.wholesale_mode === true) return;
  // eslint-disable-next-line no-console
  console.error(
    `[devAssert] ${componentName} rendered for a non-merchant trade ` +
      `(primary_trade=${listing.primary_trade}). Gate the parent.`
  );
}

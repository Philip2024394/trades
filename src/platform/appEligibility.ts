// Platform — install eligibility.
//
// Maps a manifest's requirements.plan against the merchant's effective
// tier + trade classification. Returns a typed decision so the App
// Store UI can render "Install" or a specific upgrade CTA without
// duplicating the mapping.
//
// This is the ONE place that translates between the manifest's abstract
// plan grades and the trades-specific tier / vertical system. If tier
// rules change, this is the single edit point.

import type { AppManifest } from "./manifest/types";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isMerchantProTrade } from "@/lib/tradeOff";

export type EligibilityDecision =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "requires-paid"
        | "requires-verified"
        | "requires-merchant-pro";
      upgradeLabel: string;
    };

export function canInstallApp(
  manifest: Pick<AppManifest, "slug" | "requirements">,
  listing: Pick<HammerexTradeOffListing, "primary_trade"> &
    Parameters<typeof effectiveTier>[0]
): EligibilityDecision {
  const plan = manifest.requirements.plan;
  const tier = effectiveTier(listing);
  const isMerchantPro = isMerchantProTrade(listing.primary_trade);

  switch (plan) {
    case "free":
      return { eligible: true };

    case "paid":
      if (
        tier === "app_paid" ||
        tier === "app_trial" ||
        tier === "app_verified"
      ) {
        return { eligible: true };
      }
      return {
        eligible: false,
        reason: "requires-paid",
        upgradeLabel: "Upgrade to a paid plan"
      };

    case "verified":
      if (tier === "app_verified") {
        return { eligible: true };
      }
      return {
        eligible: false,
        reason: "requires-verified",
        upgradeLabel: "Upgrade to Verified"
      };

    case "merchant-pro":
      if (
        isMerchantPro &&
        (tier === "app_paid" || tier === "app_verified")
      ) {
        return { eligible: true };
      }
      return {
        eligible: false,
        reason: "requires-merchant-pro",
        upgradeLabel: "Requires Merchant Pro"
      };
  }
}

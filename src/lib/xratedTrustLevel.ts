// Xrated Trades — trust-level derivation.
//
// Public levels live in the 3–5 band so new tradies never feel demoted:
//   3  "Verified"        — default for any live profile (passed signup)
//   4  "Trusted"         — insurance proof + qualifications uploaded
//   5  "X-Rated Elite"   — 10+ verified reviews sustained at ≥ 4.5★
//
// Level 1/2 are reserved for internal moderation states (suspension,
// flagged) and are never rendered publicly.
//
// A pinned override on the listing (`trust_level_override` 3-5) lets
// admins manually adjust a profile — useful before the reviews layer
// is live, and for one-off promotions (e.g., trade-body partnerships).

import type { HammerexTradeOffListing } from "@/lib/supabase";

export type TrustLevel = 3 | 4 | 5;

export const TRUST_LEVEL_META: Record<
  TrustLevel,
  { label: string; sublabel: string; accent: string }
> = {
  3: {
    label: "Verified",
    sublabel: "Passed Xrated identity checks",
    accent: "#FFB300"
  },
  4: {
    label: "Trusted",
    sublabel: "Insurance + qualifications confirmed",
    accent: "#FFB300"
  },
  5: {
    label: "X-Rated Elite",
    sublabel: "Top-rated by verified customers",
    accent: "#FFB300"
  }
};

const ELITE_MIN_REVIEWS = 10;
const ELITE_MIN_RATING = 4.5;

/**
 * Compute the trust level a profile would have based purely on current
 * listing data. Admin overrides are applied by `getTrustLevel`.
 */
export function deriveTrustLevel(listing: HammerexTradeOffListing): TrustLevel {
  // Level 5 — sustained social proof.
  const ratingCount = listing.rating_count ?? 0;
  const ratingAvg = listing.rating_avg ?? 0;
  if (ratingCount >= ELITE_MIN_REVIEWS && ratingAvg >= ELITE_MIN_RATING) {
    return 5;
  }
  // Level 4 — both insurance proof AND at least one qualification entry.
  const hasInsurance =
    listing.is_insured && typeof listing.insurance_cover_gbp === "number";
  const hasQualifications =
    Array.isArray(listing.qualifications) && listing.qualifications.length > 0;
  if (hasInsurance && hasQualifications) {
    return 4;
  }
  return 3;
}

/**
 * The trust level rendered on a public profile — admin override wins,
 * else the derived value.
 */
export function getTrustLevel(
  listing: HammerexTradeOffListing & { trust_level_override?: number | null }
): TrustLevel {
  const override = listing.trust_level_override;
  if (override === 3 || override === 4 || override === 5) {
    return override;
  }
  return deriveTrustLevel(listing);
}

// Xrated Trades — Trust Score calculation.
//
// Returns a 0-100 score based on profile completeness, plus the 8-item
// checklist used by both the public profile badge and the dashboard
// "Build your Trust Score" panel.
//
// Weights (sum to 100):
//   Profile complete         15  (bio + city + WhatsApp + email)
//   Intro video uploaded     10
//   Customer reviews         20  (12+ = full, 5-11 = 12, 1-4 = 6, 0 = 0)
//   Services listed          10
//   Prices shown             10
//   WhatsApp enabled          7
//   Xrated Verified          20
//   Insurance uploaded        8
//
// Review tier is non-linear so the first few reviews are
// proportionally more valuable — gives tradies a clear "ask 5 customers"
// goal early on. Verified is heavily weighted because it's the most
// expensive trust signal to earn (annual paid tier + document check).

import type { HammerexTradeOffListing } from "./supabase";

export type TrustScoreItem = {
  key: string;
  label: string;
  earned: boolean;
  points: number; // maximum weight of this item
  pointsEarned: number; // 0..points (non-binary for reviews)
  tip?: string;
  /** True if this item is gated behind a paid tier. Free profiles
   *  can't earn it; the dashboard surfaces a 🔒 PAID chip + upgrade
   *  CTA in place of the regular checkbox. */
  paidOnly?: boolean;
};

type TrustScoreInput = Pick<
  HammerexTradeOffListing,
  | "bio"
  | "city"
  | "whatsapp"
  | "email"
  | "video_url"
  | "rating_count"
  | "priced_services"
  | "services_offered"
  | "hammerex_standard_verified"
  | "is_insured"
>;

export function getTrustScoreItems(listing: TrustScoreInput): TrustScoreItem[] {
  const profileComplete = Boolean(
    listing.bio?.trim() &&
      listing.city?.trim() &&
      listing.whatsapp?.trim() &&
      listing.email?.trim()
  );

  const reviewCount = listing.rating_count ?? 0;
  let reviewPoints = 0;
  let reviewLabel: string;
  if (reviewCount >= 12) {
    reviewPoints = 20;
    reviewLabel = `${reviewCount} customer reviews`;
  } else if (reviewCount >= 5) {
    reviewPoints = 12;
    reviewLabel = `${reviewCount} customer reviews`;
  } else if (reviewCount >= 1) {
    reviewPoints = 6;
    reviewLabel = `${reviewCount} customer review${reviewCount === 1 ? "" : "s"}`;
  } else {
    reviewLabel = "No reviews yet";
  }

  const priced = listing.priced_services ?? [];
  const otherServices = listing.services_offered ?? [];
  const servicesListed = priced.length > 0 || otherServices.length > 0;
  const pricesShown = priced.some(
    (s) => typeof s.price === "number" && s.price > 0
  );

  return [
    {
      key: "profile",
      label: "Profile complete",
      earned: profileComplete,
      points: 15,
      pointsEarned: profileComplete ? 15 : 0,
      tip: "Add your bio, city, WhatsApp and email."
    },
    {
      key: "video",
      label: "Intro video uploaded",
      earned: Boolean(listing.video_url),
      points: 10,
      pointsEarned: listing.video_url ? 10 : 0,
      tip: "Record a 60-second intro video — convert 3x more visitors.",
      paidOnly: true
    },
    {
      key: "reviews",
      label: reviewLabel,
      earned: reviewCount >= 12,
      points: 20,
      pointsEarned: reviewPoints,
      tip:
        reviewCount === 0
          ? "Ask your last 5 customers to leave a review on your URL."
          : reviewCount < 12
            ? `${12 - reviewCount} more reviews to unlock the full 20 points.`
            : undefined,
      paidOnly: true
    },
    {
      key: "services",
      label: "Services listed",
      earned: servicesListed,
      points: 10,
      pointsEarned: servicesListed ? 10 : 0,
      tip: "Add at least one service so customers know what to enquire about."
    },
    {
      key: "prices",
      label: "Prices shown",
      earned: pricesShown,
      points: 10,
      pointsEarned: pricesShown ? 10 : 0,
      tip: "Show prices on your services — 67% of customers won't enquire without.",
      paidOnly: true
    },
    {
      key: "whatsapp",
      label: "WhatsApp enabled",
      earned: Boolean(listing.whatsapp?.trim()),
      points: 7,
      pointsEarned: listing.whatsapp?.trim() ? 7 : 0,
      tip: "Add your WhatsApp number so customers can tap to message."
    },
    {
      key: "verified",
      label: "Xrated Verified badge",
      earned: Boolean(listing.hammerex_standard_verified),
      points: 20,
      pointsEarned: listing.hammerex_standard_verified ? 20 : 0,
      tip:
        "Upgrade to Verified (£19.99/mo or £199.99/yr). Customers trust verified profiles 3x more.",
      paidOnly: true
    },
    {
      key: "insurance",
      label: "Insurance uploaded",
      earned: Boolean(listing.is_insured),
      points: 8,
      pointsEarned: listing.is_insured ? 8 : 0,
      tip: "Upload your public-liability + employer's certificate.",
      paidOnly: true
    }
  ];
}

/** Maximum score a free-tier profile can ever reach. Used by the
 *  dashboard to display "32/32" instead of "32/100" so the tradesperson
 *  sees a realistic ceiling and the upgrade path is clear. */
export function getFreeTierMaxScore(): number {
  return getTrustScoreItems({
    bio: "x",
    city: "x",
    whatsapp: "x",
    email: "x",
    video_url: null,
    rating_count: 0,
    priced_services: [{ name: "x", image_url: null, price: 0, unit: "" }],
    services_offered: ["x"],
    hammerex_standard_verified: false,
    is_insured: false
  } as TrustScoreInput)
    .filter((i) => !i.paidOnly)
    .reduce((sum, i) => sum + i.points, 0);
}

export function getTrustScore(listing: TrustScoreInput): number {
  const items = getTrustScoreItems(listing);
  const total = items.reduce((sum, item) => sum + item.pointsEarned, 0);
  return Math.min(100, total);
}

// Score-to-band labelling for the public profile badge tooltip — gives
// customers a quick "what does 78 mean" signal without making them click.
export function getTrustScoreBand(score: number): {
  label: string;
  short: string;
} {
  if (score >= 90) return { label: "Exceptional", short: "★★★" };
  if (score >= 75) return { label: "Strong", short: "★★" };
  if (score >= 50) return { label: "Building", short: "★" };
  return { label: "Just starting", short: "" };
}

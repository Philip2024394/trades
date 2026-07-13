// Marketplace App — merchant fixtures.
//
// Every merchant here carries the multi-layer trust score (spec §19.1)
// so product cards can render trust badges deterministically without a
// DB round-trip. This is Week 3 sample data — real merchants come
// through tc_merchants.* in Wave 2.

import type { LayeredTrustScore } from "../types";

export type MarketplaceMerchant = {
  slug: string;
  displayName: string;
  legalName: string;
  logoInitials: string;
  homeCity: string;
  yearsTrading: number;
  responseTimeHrsMedian: number;
  reviewCount: number;
  avgStarRating: number;
  trust: LayeredTrustScore;
  /** Additive Week 6 fields for the merchant page. All optional so
   *  existing consumers stay unaffected. */
  shortTagline?: string;
  description?: string;
  ordersCompleted?: number;
  productsSold?: number;
  memberSinceIso?: string;
  dispatchPromise?: string;
  storeHeroImageUrl?: string;
  /** Merchant profile logo. If set, MerchantHero renders this image
   *  inside the circular logo slot instead of the text initials. */
  logoImageUrl?: string;
  /** How the merchant name / tagline / stats render on top of the hero
   *  banner. Merchant-owned so trades can pick what reads best on their
   *  own uploaded banner.
   *    "auto-light" (default): dark gradient + WHITE text — safest.
   *    "auto-dark":  light gradient + BLACK text — for merchants whose
   *                  banner needs a bright surface behind dark text.
   *    "hidden":     no overlay text at all — banner runs clean and the
   *                  merchant identity + stats render in a card BELOW
   *                  the banner instead. Best for banners with burned-in
   *                  brand marks or busy imagery. */
  heroTextStyle?: "auto-light" | "auto-dark" | "hidden";
  /** Checkout — Trade Center 2026-07-12 canonical model. Every merchant
   *  MUST accept at least one route. `whatsappNumber` in E.164 format
   *  ("+441234567890"); `paymentGateways` is the ordered set of
   *  Safe-Trade routes the merchant has wired. When both are set the
   *  cart shows Safe Trade as primary and WhatsApp as demoted secondary
   *  with a buyer-protection warning. */
  whatsappNumber?: string;
  paymentGateways?: Array<"stripe" | "paypal" | "escrow">;
  /** Flat delivery fee applied to this merchant's basket subtotal.
   *  When `freeDeliveryThresholdGbp` is set and subtotal meets it,
   *  delivery becomes free. */
  deliveryFlatRateGbp?: number;
  freeDeliveryThresholdGbp?: number;
};

/** Result shape from `checkoutOptionsFor(merchant)` — collapses the
 *  merchant's checkout config into a decision the cart page consumes. */
export type CheckoutOptions = {
  safeTradeAvailable: boolean;
  gateways: ReadonlyArray<"stripe" | "paypal" | "escrow">;
  whatsappAvailable: boolean;
  whatsappNumberE164?: string;
};

export function checkoutOptionsFor(m: MarketplaceMerchant): CheckoutOptions {
  const gateways = m.paymentGateways ?? [];
  return {
    safeTradeAvailable: gateways.length > 0,
    gateways,
    whatsappAvailable: Boolean(m.whatsappNumber),
    whatsappNumberE164: m.whatsappNumber
  };
}

export function deliveryFor(
  m: MarketplaceMerchant,
  subtotalGbp: number
): { chargeGbp: number; free: boolean } {
  const flat = m.deliveryFlatRateGbp ?? 0;
  const threshold = m.freeDeliveryThresholdGbp;
  if (threshold !== undefined && subtotalGbp >= threshold) {
    return { chargeGbp: 0, free: true };
  }
  return { chargeGbp: flat, free: flat === 0 };
}

const now = Date.now();
const yearsAgo = (n: number) => now - n * 365 * 24 * 60 * 60 * 1000;

export const MERCHANT_FIXTURES: MarketplaceMerchant[] = [
  {
    slug: "manchester-tools-direct",
    displayName: "Manchester Tools Direct",
    legalName: "Manchester Tools Direct Ltd",
    logoInitials: "MT",
    homeCity: "Manchester",
    yearsTrading: 12,
    responseTimeHrsMedian: 0.7,
    reviewCount: 187,
    avgStarRating: 4.8,
    trust: {
      score: 96,
      layers: {
        identity: { verifiedAt: yearsAgo(2) },
        business: { verifiedAt: yearsAgo(2), source: "companies-house" },
        skills: { verifiedAt: yearsAgo(1), tradeBodies: ["Gas Safe"] },
        address: { verifiedAt: yearsAgo(2) },
        insurance: { verifiedAt: yearsAgo(1), publicLiabilityGbp: 5_000_000 },
        qualifications: { verifiedAt: yearsAgo(1), certifications: ["CSCS Gold"] },
        reviews: { verifiedAt: yearsAgo(1), meetsThreshold: true },
        yearsTrading: { verifiedAt: yearsAgo(2), years: 12 }
      }
    },
    shortTagline: "Professional plastering tools & materials | Quality you can trust",
    description:
      "Family-run merchant supplying UK trades since 2014. We stock trowels, hawks, skimming blades and every finishing tool professional plasterers reach for. Same-day dispatch on orders placed before 2pm; free delivery on £75+ orders across Greater Manchester.",
    ordersCompleted: 2348,
    productsSold: 1856,
    memberSinceIso: "2020-01-15T00:00:00Z",
    dispatchPromise: "Same Day (Order before 2pm)",
    storeHeroImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_36_21%20AM.png",
    logoImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_11_36%20AM.png",
    heroTextStyle: "auto-light",
    whatsappNumber: "+441612000000",
    paymentGateways: ["stripe", "paypal"],
    deliveryFlatRateGbp: 4.99,
    freeDeliveryThresholdGbp: 75
  },
  {
    slug: "leeds-builders-supplies",
    displayName: "Leeds Builders Supplies",
    legalName: "LBS Ltd",
    logoInitials: "LB",
    homeCity: "Leeds",
    yearsTrading: 8,
    responseTimeHrsMedian: 1.2,
    reviewCount: 94,
    avgStarRating: 4.6,
    trust: {
      score: 82,
      layers: {
        identity: { verifiedAt: yearsAgo(1) },
        business: { verifiedAt: yearsAgo(1), source: "companies-house" },
        skills: null,
        address: { verifiedAt: yearsAgo(1) },
        insurance: { verifiedAt: yearsAgo(1), publicLiabilityGbp: 2_000_000 },
        qualifications: null,
        reviews: { verifiedAt: yearsAgo(1), meetsThreshold: true },
        yearsTrading: { verifiedAt: yearsAgo(1), years: 8 }
      }
    },
    whatsappNumber: "+441132000000",
    paymentGateways: ["stripe"],
    deliveryFlatRateGbp: 6.5,
    freeDeliveryThresholdGbp: 100
  },
  {
    slug: "glasgow-scaffolding-co",
    displayName: "Glasgow Scaffolding Co",
    legalName: "Glasgow Scaffolding Ltd",
    logoInitials: "GS",
    homeCity: "Glasgow",
    yearsTrading: 15,
    responseTimeHrsMedian: 0.4,
    reviewCount: 312,
    avgStarRating: 4.9,
    trust: {
      score: 99,
      layers: {
        identity: { verifiedAt: yearsAgo(3) },
        business: { verifiedAt: yearsAgo(3), source: "companies-house" },
        skills: { verifiedAt: yearsAgo(2), tradeBodies: ["NASC"] },
        address: { verifiedAt: yearsAgo(3) },
        insurance: { verifiedAt: yearsAgo(1), publicLiabilityGbp: 10_000_000 },
        qualifications: { verifiedAt: yearsAgo(2), certifications: ["CISRS Advanced"] },
        reviews: { verifiedAt: yearsAgo(1), meetsThreshold: true },
        yearsTrading: { verifiedAt: yearsAgo(3), years: 15 }
      }
    },
    whatsappNumber: "+441412000000",
    paymentGateways: ["stripe", "paypal", "escrow"],
    deliveryFlatRateGbp: 15,
    freeDeliveryThresholdGbp: 250
  },
  {
    slug: "brighton-tile-warehouse",
    displayName: "Brighton Tile Warehouse",
    legalName: "BTW Ltd",
    logoInitials: "BT",
    homeCity: "Brighton",
    yearsTrading: 4,
    responseTimeHrsMedian: 2.5,
    reviewCount: 41,
    avgStarRating: 4.4,
    trust: {
      score: 68,
      layers: {
        identity: { verifiedAt: yearsAgo(1) },
        business: { verifiedAt: yearsAgo(1), source: "companies-house" },
        skills: null,
        address: { verifiedAt: yearsAgo(1) },
        insurance: null,
        qualifications: null,
        reviews: null,
        yearsTrading: { verifiedAt: yearsAgo(1), years: 4 }
      }
    },
    // Brighton Tile Warehouse — WhatsApp-only merchant to exercise the
    // no-gateway path on the cart. Buyer sees only the WhatsApp CTA
    // with the buyer-protection warning.
    whatsappNumber: "+441273000000",
    deliveryFlatRateGbp: 5.99
  }
];

export function findMerchant(slug: string): MarketplaceMerchant | undefined {
  return MERCHANT_FIXTURES.find((m) => m.slug === slug);
}

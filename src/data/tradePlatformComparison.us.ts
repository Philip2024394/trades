// USA trade-services platform comparison — full dataset for
// /trade-off/us/compare-platforms.
//
// Compiled by research agent 2026-07-18 via WebSearch of each
// platform's public pricing + features pages. Every price cites its
// source URL — see evidence file at docs/comparison-evidence/us/
// per platform.
//
// Legal posture: Lanham Act §43(a) (15 U.S.C. §1125(a)) is the
// operative false-advertising statute for USA. Truthful, substantiated
// comparative pricing is protected under FTC's 1979 Comparative
// Advertising Policy Statement + First Amendment commercial-speech
// doctrine (Central Hudson v Public Service Comm'n, 447 U.S. 557).
// Every price MUST be re-verified quarterly — stale pricing creates
// direct §43(a) liability with attorney's fees exposure under
// §35(a) (15 U.S.C. §1117).
//
// Skipped:
//   Fash (fashion, not trades)
//   Craftsy (crafting, not trades)
//   Care.com (child/pet care, non-trade)
//   ServiceMaster / ServiceMagic (franchise operator + defunct rebrand)
//   FieldEdge (pure B2B dispatch, no consumer discovery)
// Merged: Angi Leads + Angi Ads (single Angi row post-2022 rebrand)

import type { PlatformRow } from "./tradePlatformComparison";

export const TRADE_PLATFORMS_US: PlatformRow[] = [
  {
    name:    "Thenetworkers",
    url:     "https://thenetworkers.app",
    pricing: "Free tier + washer packs ($0.06-0.13/WhatsApp lead); no commission",
    features: {
      ownUrl: true, customDomain: true, freeTier: true, noCommission: true,
      noLeadFees: false /* honest: washers are per-lead */,
      whatsappDeepLink: true, inPlatformReviews: true, verifiedBadge: true,
      productCatalogue: true, communityFeed: true, cityTradeSeo: true,
      installerCrossSell: true, aiTools: true, projectPosting: true,
      pushNotifications: true, tradeToTradeReferral: true
    }
  },
  { name: "Angi (Pro/Ads)",       url: "https://angi.com",              pricing: "$15-$120+/lead (shared 3-8 pros) + Angi Ads $300/yr; typical spend $2k-$8k/mo",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: true, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Thumbtack",             url: "https://thumbtack.com",         pricing: "$8-$150+/lead (shared 4-5 pros); no contract, pause anytime",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Yelp for Services",     url: "https://biz.yelp.com",          pricing: "Free page; Ads CPC $2-$10 (typical $300-$5,000/mo)",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true /* Yelp Ads paid but no per-lead fee */, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false /* request-a-quote only */, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Google Business Profile", url: "https://business.google.com", pricing: "Free",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: true, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Nextdoor for Business", url: "https://business.nextdoor.com", pricing: "Free page; Local Deals from $1/day; CPC $2.50-$5.00; Sponsorships $32-$150/mo/zip",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: true, cityTradeSeo: null, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: true } },
  { name: "TaskRabbit",            url: "https://taskrabbit.com",        pricing: "$25 one-time Tasker registration; client pays 15% service fee + $7.99 T&S fee",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true /* Tasker keeps 100% */, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: null, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Handy (Angi)",          url: "https://handy.com",             pricing: "~20-25% commission on booking; independent-contractor terms",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: false, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Houzz Pro",             url: "https://houzz.com/pro",         pricing: "Volume-tier: Starter ~$85/mo, Pro ~$399/mo (annual); +$60/mo per user; Ads from $499/mo",
    features: { ownUrl: true, customDomain: true /* Houzz Pro includes free custom domain */, freeTier: true /* Basic plan */, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false /* project portfolio not products */, communityFeed: true /* Ideabooks / photos */, cityTradeSeo: true, installerCrossSell: true /* Houzz Shop products */, aiTools: true /* 2026 AI takeoff + assistant */, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Porch",                 url: "https://porch.com",             pricing: "$10-$60/lead; Vetted Pro $360/yr + 5% back on on-demand leads",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "BuildZoom",             url: "https://buildzoom.com",         pricing: "2.5% success-fee on project value (paid only after hire); optional $99/mo ad package",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: false /* 2.5% is commission */, noLeadFees: true /* no per-lead upfront */, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Bark.com (US)",         url: "https://bark.com/en/us",        pricing: "$2.20/credit; lead = 4-30 credits ($9-$66+); Elite Pro sub ~$45-$100/mo",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "HomeGuide",             url: "https://homeguide.com/pro",     pricing: "Free profile; per-lead only (pricing not published — quote)",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Networx",               url: "https://networx.com",           pricing: "$10-$100+/lead (shared up to 4 pros); Exclusive $15-$120+; no setup fees",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Modernize",             url: "https://modernize.com",         pricing: "Managed per-lead (quote-only; roofing ~$20-$100+)",
    features: { ownUrl: false /* marketing to homeowners only */, customDomain: false, freeTier: false, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "CraftJack (Angi-owned)", url: "https://craftjack.com",        pricing: "$7-$50/lead most trades; GC $102-$153/lead; max 4 pros/lead; no contract",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } }
];

/** Summary numbers for use in copy — parallels comparisonStats() in
 *  the UK file. */
export function comparisonStatsUS() {
  const us     = TRADE_PLATFORMS_US[0];
  const others = TRADE_PLATFORMS_US.slice(1);
  const usFeatureCount = Object.values(us.features).filter((v) => v === true).length;
  return {
    totalPlatforms: TRADE_PLATFORMS_US.length,
    usFeatureCount,
    totalFeatures:  Object.keys(us.features).length,
    othersScanned:  others.length
  };
}

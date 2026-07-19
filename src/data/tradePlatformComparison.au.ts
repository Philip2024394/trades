// Australia trade-services platform comparison — full dataset for
// /trade-off/au/compare-platforms.
//
// Compiled by research agent 2026-07-18 via WebSearch of each
// platform's public pricing + features pages. Every price cites its
// source URL — see evidence file at docs/comparison-evidence/au/
// per platform.
//
// Legal posture: Competition and Consumer Act 2010 (Cth) Schedule 2
// (Australian Consumer Law) s.18 (misleading/deceptive conduct) +
// s.29 (false representations, including sub-s.29(1)(i) on price)
// permit truthful comparative pricing. Post-Nov-2022 amendments
// raised s.29 corporate penalties to the greater of AUD $50M,
// 3x benefit, or 30% of adjusted turnover per contravention.
// Trade Marks Act 1995 (Cth) s.122(1)(f) is the comparative-
// advertising defence (NOT s.122(1)(d) which is descriptive-use).
// Every price MUST be re-verified quarterly — staleness = s.18/s.29
// exposure.
//
// Dropped from prompt list:
//   StarTradesmen (no verifiable AU platform 2026)
//   Design and Build (no verifiable AU trade platform 2026)
// Marked legacy: Oneflare (winding down 30 June 2026)

import type { PlatformRow } from "./tradePlatformComparison";

export const TRADE_PLATFORMS_AU: PlatformRow[] = [
  {
    name:    "Thenetworkers",
    url:     "https://thenetworkers.app",
    pricing: "Free tier + washer packs (AUD $0.09-$0.19/WhatsApp lead); no commission",
    features: {
      ownUrl: true, customDomain: true, freeTier: true, noCommission: true,
      noLeadFees: false /* honest: washers are per-lead */,
      whatsappDeepLink: true, inPlatformReviews: true, verifiedBadge: true,
      productCatalogue: true, communityFeed: true, cityTradeSeo: true,
      installerCrossSell: true, aiTools: true, projectPosting: true,
      pushNotifications: true, tradeToTradeReferral: true
    }
  },
  { name: "Hipages",                url: "https://hipages.com.au",         pricing: "$129-$810/mo (subscription tier = credit block); leads $30-$80 shared",
    features: { ownUrl: false, customDomain: false, freeTier: false, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: true /* TradieCore quoting */, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "ServiceSeeking",         url: "https://serviceseeking.com.au",  pricing: "$49/mo Starter · $299/qtr Plus · $1,399/yr Pro (inc GST); or $9.95/lead casual",
    features: { ownUrl: false, customDomain: false, freeTier: true /* free profile */, noCommission: true, noLeadFees: true /* on subs plans */, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: null, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Airtasker",              url: "https://airtasker.com.au",       pricing: "12.5%-20% commission on task price (ex-GST); tier by completions",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: false, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Oneflare (closing 30 Jun 2026)", url: "https://oneflare.com.au", pricing: "$59.99-$359.99 credit packs (30-210 credits, 30-day expiry) — LEGACY",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Yellow Pages AU (Thryv)", url: "https://yellow.com.au",         pricing: "From $30/mo (sales-gated); premium packages quote-only; 12-mo min contract",
    features: { ownUrl: true /* paid website add-on */, customDomain: true /* paid tier */, freeTier: true /* basic listing */, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: null, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "True Local (Thryv)",     url: "https://truelocal.com.au",       pricing: "Free (managed via myYellow dashboard); no separate paid tier",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Word of Mouth (WOMO)",   url: "https://wordofmouth.com.au",     pricing: "Free listing; premium ~$3-$4/day (quote-only)",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "Localsearch",            url: "https://localsearch.com.au",     pricing: "Free basic; multi-location + upgrades quote-only",
    features: { ownUrl: true /* paid websites */, customDomain: true /* paid */, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: null, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "Nextdoor AU",            url: "https://business.nextdoor.com/en-au", pricing: "Free biz page; Local Deals from $3; Sponsorships from $32/mo",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: true, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: true } },
  { name: "Google Business Profile", url: "https://business.google.com",   pricing: "Free (Ads separate CPC)",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: true /* Products beta */, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Service.com.au",         url: "https://service.com.au",         pricing: "Flat subscription (unlimited leads, no per-lead) — quote-only",
    features: { ownUrl: false, customDomain: false, freeTier: true /* view jobs free */, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "HomeImprovement2day",    url: "https://homeimprovement2day.com.au", pricing: "Package listings quote-only; no contracts required",
    features: { ownUrl: false, customDomain: false, freeTier: null, noCommission: true, noLeadFees: null, whatsappDeepLink: false, inPlatformReviews: null, verifiedBadge: null, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "dLook (Yellow Group)",   url: "https://dlook.com.au",           pricing: "Free directory listing; no separate paid tier",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: null, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "ProductReview AU",       url: "https://productreview.com.au",   pricing: "Brand Management plans quote-only; 12-mo min (wire-transfer)",
    features: { ownUrl: false, customDomain: false, freeTier: true /* unclaimed page */, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Facebook Marketplace (AU)", url: "https://facebook.com/marketplace", pricing: "Free local; 5% or $0.40 shipped-goods fee only",
    features: { ownUrl: false, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false /* Messenger only */, inPlatformReviews: true /* via Page */, verifiedBadge: true /* Meta Verified */, productCatalogue: true, communityFeed: true, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true /* via groups */, pushNotifications: true, tradeToTradeReferral: false } }
];

/** Summary numbers for use in copy — parallels comparisonStats(). */
export function comparisonStatsAU() {
  const us     = TRADE_PLATFORMS_AU[0];
  const others = TRADE_PLATFORMS_AU.slice(1);
  const usFeatureCount = Object.values(us.features).filter((v) => v === true).length;
  return {
    totalPlatforms: TRADE_PLATFORMS_AU.length,
    usFeatureCount,
    totalFeatures:  Object.keys(us.features).length,
    othersScanned:  others.length
  };
}

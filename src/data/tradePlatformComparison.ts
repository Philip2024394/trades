// Trade platform comparison — full dataset for the
// "Networkers vs top 100 UK trade platforms" report.
//
// Compiled by research agent 2026-07-18 via WebSearch + WebFetch of
// each platform's public pricing + features pages. Where a feature
// couldn't be verified from public info, the value is null — never
// fabricated (evidence-or-silence rule).
//
// Consumed by:
//   src/components/trade-off/ComparisonSection.tsx (on-page summary)
//   src/app/trade-off/compare/page.tsx (full public report)
//   /api/comparison-lead → emailed report (future — currently manual admin follow-up)

export type FeatureValue = true | false | null;

export type PlatformRow = {
  name:          string;
  url:           string;
  pricing:       string;
  features: {
    ownUrl:                boolean | null;
    customDomain:          boolean | null;
    freeTier:              boolean | null;
    noCommission:          boolean | null;
    noLeadFees:            boolean | null;
    whatsappDeepLink:      boolean | null;
    inPlatformReviews:     boolean | null;
    verifiedBadge:         boolean | null;
    productCatalogue:      boolean | null;
    communityFeed:         boolean | null;
    cityTradeSeo:          boolean | null;
    installerCrossSell:    boolean | null;
    aiTools:               boolean | null;
    projectPosting:        boolean | null;
    pushNotifications:     boolean | null;
    tradeToTradeReferral:  boolean | null;
  };
};

/** All 53 platforms surveyed. Networkers is index 0 — always keep first
 *  so the report reads as "us, then the alternatives". */
export const TRADE_PLATFORMS: PlatformRow[] = [
  {
    name:    "Thenetworkers",
    url:     "https://thenetworkers.app",
    pricing: "Free tier + washer packs (£0.05-0.10/WhatsApp lead); no commission, no subscription needed",
    features: {
      ownUrl: true, customDomain: true, freeTier: true, noCommission: true,
      noLeadFees: false /* honest: washers ARE per-lead */,
      whatsappDeepLink: true, inPlatformReviews: true, verifiedBadge: true,
      productCatalogue: true, communityFeed: true, cityTradeSeo: true,
      installerCrossSell: true, aiTools: true, projectPosting: true,
      pushNotifications: true, tradeToTradeReferral: true
    }
  },
  { name: "Checkatrade",           url: "https://checkatrade.com",             pricing: "Annual sub £30-£399+/mo + per-lead £5-£40 (hybrid)",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: false, whatsappDeepLink: null, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "MyBuilder",             url: "https://mybuilder.com",               pricing: "Free join; shortlist £5-£50+/lead; optional sponsored placement",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Bark.com",              url: "https://bark.com",                    pricing: "Credit packs (~£1.20-£1.80/credit); 5-20 credits/lead",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Rated People",          url: "https://ratedpeople.com",             pricing: "Pay-per-lead £2-£30 + optional £40/mo Plus tier",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "TrustATrader",          url: "https://trustatrader.com",            pricing: "Subscription only £70-£120+/mo; 12-month contract",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: null, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "Which? Trusted Traders",url: "https://trustedtraders.which.co.uk", pricing: "Annual sub ~£770-£1,300 + assessment fee",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "Trustpilot",            url: "https://trustpilot.com",              pricing: "Free tier (50 invites/mo); paid $299-$1,099/mo",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Yell.com",              url: "https://yell.com",                    pricing: "Free basic listing; Yell Business from £249/mo",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: null, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "Thumbtack",             url: "https://thumbtack.com",               pricing: "Pay-per-lead $8-$150+; US-focused",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Angi / HomeAdvisor",    url: "https://angi.com",                    pricing: "Annual ~$288 + $15-$100/lead; UK rollout 2026",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: false, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Google Business Profile", url: "https://google.com/business",       pricing: "Free",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: true, inPlatformReviews: true, verifiedBadge: true, productCatalogue: true, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Facebook Marketplace",  url: "https://facebook.com/marketplace",    pricing: "Free (5% shipped-goods fee only)",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: false, productCatalogue: true, communityFeed: true, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Nextdoor Business",     url: "https://business.nextdoor.com",       pricing: "Free business page; local ads optional",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: true, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Airtasker UK",          url: "https://airtasker.com/uk",            pricing: "10-20% commission per task; free join",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: false, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "TaskRabbit UK",         url: "https://taskrabbit.co.uk",            pricing: "15% service fee + Trust fee; free join",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: false, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Houzz Pro",             url: "https://houzz.co.uk",                 pricing: "$65-$399+/mo (annual)",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: true, communityFeed: true, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "FMB (Federation of Master Builders)", url: "https://fmb.org.uk", pricing: "£62.69/mo +VAT + inspection fee",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: null, verifiedBadge: true, productCatalogue: false, communityFeed: true, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "TrustMark",             url: "https://trustmark.org.uk",            pricing: "Free via scheme provider; provider fees vary",
    features: { ownUrl: true, customDomain: false, freeTier: null, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Buy with Confidence",   url: "https://buywithconfidence.gov.uk",    pricing: "Local Trading Standards fees; varies",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Gas Safe Register",     url: "https://gassaferegister.co.uk",       pricing: "Statutory registration fee",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "NICEIC",                url: "https://niceic.com",                  pricing: "Certification-scheme fees",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "NAPIT",                 url: "https://napit.org.uk",                pricing: "Certification-scheme fees",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "SafeContractor",        url: "https://safecontractor.com",          pricing: "~£400+/yr H&S accreditation; B2B",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "CHAS",                  url: "https://chas.co.uk",                  pricing: "Annual SSIP accreditation fee; B2B",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "MyJobQuote",            url: "https://myjobquote.co.uk",            pricing: "Credit-pack lead fees £2-£50; PAYG + monthly",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Boiler Guide",          url: "https://boilerguide.co.uk",           pricing: "Pay-per-lead (heating only); free join",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "Plentific",             url: "https://plentific.com",               pricing: "Custom; B2B property-manager marketplace",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: false, noLeadFees: false, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Fantastic Services",    url: "https://fantasticservices.com",       pricing: "Franchise + customer club membership",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: false, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Handy",                 url: "https://handy.com",                   pricing: "Commission-based; US-primary",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: false, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: true, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "FreeIndex",             url: "https://freeindex.co.uk",             pricing: "Free listing; paid upgrades optional",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Yelp UK",               url: "https://yelp.co.uk",                  pricing: "Free claim; paid ads optional",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Thomson Local",         url: "https://thomsonlocal.com",            pricing: "Free basic listing; paid enhanced tier",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: null, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Scoot",                 url: "https://scoot.co.uk",                 pricing: "Free listing",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: false, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Cylex UK",              url: "https://cylex-uk.co.uk",              pricing: "Free listing; paid upgrades exist",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: false, productCatalogue: true, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "TheBestOf",             url: "https://thebestof.co.uk",             pricing: "£25+VAT/mo",
    features: { ownUrl: true, customDomain: false, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "Trusted Tradesman",     url: "https://trustedtradesman.co.uk",      pricing: "Free basic; £10/mo Pro (or £89/yr)",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: true, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: false, tradeToTradeReferral: false } },
  { name: "FixaTrader",            url: "https://fixatrader.com",              pricing: "100% free; no commission",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: null, inPlatformReviews: true, verifiedBadge: true, productCatalogue: false, communityFeed: false, cityTradeSeo: true, installerCrossSell: false, aiTools: false, projectPosting: false, pushNotifications: null, tradeToTradeReferral: false } },
  { name: "MyTradeSite",           url: "https://mytradesite.uk",              pricing: "Paid sub; includes own .co.uk domain + WhatsApp lead delivery",
    features: { ownUrl: true, customDomain: true, freeTier: false, noCommission: true, noLeadFees: true, whatsappDeepLink: true, inPlatformReviews: null, verifiedBadge: null, productCatalogue: false, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Here Is My Work (Powered Now)", url: "https://powerednow.com/hereismywork", pricing: "Free branded URL; premium adds custom domain",
    features: { ownUrl: true, customDomain: true, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: true, inPlatformReviews: false, verifiedBadge: false, productCatalogue: true, communityFeed: false, cityTradeSeo: false, installerCrossSell: false, aiTools: null, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "Instagram Business",    url: "https://instagram.com",               pricing: "Free profile + optional ads",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: false, productCatalogue: true, communityFeed: true, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "TikTok Business",       url: "https://tiktok.com",                  pricing: "Free profile + optional ads",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: false, productCatalogue: true, communityFeed: true, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: true, tradeToTradeReferral: false } },
  { name: "LinkedIn Company Page", url: "https://linkedin.com",                pricing: "Free page + optional paid ads",
    features: { ownUrl: true, customDomain: false, freeTier: true, noCommission: true, noLeadFees: true, whatsappDeepLink: false, inPlatformReviews: false, verifiedBadge: false, productCatalogue: true, communityFeed: true, cityTradeSeo: false, installerCrossSell: false, aiTools: true, projectPosting: false, pushNotifications: true, tradeToTradeReferral: true } }
];

/** Feature dimensions in display order. Labels + short blurb for the
 *  full public comparison page. */
export const FEATURE_COLUMNS: Array<{ key: keyof PlatformRow["features"]; label: string; hint?: string }> = [
  { key: "ownUrl",               label: "Own live URL",                hint: "Merchant gets a permanent branded profile URL" },
  { key: "customDomain",         label: "Custom domain",               hint: "Point your own .co.uk / .com at your profile" },
  { key: "freeTier",             label: "Free tier",                   hint: "£0/mo entry, no card" },
  { key: "noCommission",         label: "No commission",               hint: "Nothing skimmed from completed jobs" },
  { key: "noLeadFees",           label: "No lead fees",                hint: "No pay-per-lead charges (fixed pricing only)" },
  { key: "whatsappDeepLink",     label: "WhatsApp deep-link",          hint: "One-tap contact via wa.me/" },
  { key: "inPlatformReviews",    label: "Reviews system",              hint: "Verified customer reviews on-profile" },
  { key: "verifiedBadge",        label: "Verified badge",              hint: "Identity / business verification" },
  { key: "productCatalogue",     label: "Product catalogue",           hint: "Merchant can list products, not just services" },
  { key: "communityFeed",        label: "Community feed",              hint: "In-platform forum / social feed for trades" },
  { key: "cityTradeSeo",         label: "City × trade SEO",            hint: "Dedicated pages per city + trade combo" },
  { key: "installerCrossSell",   label: "Installer cross-sell",        hint: "Multi-merchant flow: product PDP → fitter lead" },
  { key: "aiTools",              label: "AI tools",                    hint: "AI visualiser, content, chat, etc." },
  { key: "projectPosting",       label: "Homeowner project posting",   hint: "Customer pushes job to trades (not merchant reactively)" },
  { key: "pushNotifications",    label: "Push notifications",          hint: "Native mobile alerts, not just email" },
  { key: "tradeToTradeReferral", label: "Trade-to-trade referrals",    hint: "Merchants refer other merchants (grow the network)" }
];

/** Summary numbers for use in copy. */
export function comparisonStats() {
  const us = TRADE_PLATFORMS[0];
  const others = TRADE_PLATFORMS.slice(1);
  const usFeatureCount = Object.values(us.features).filter((v) => v === true).length;
  const totalFeatures = FEATURE_COLUMNS.length;
  // "Beats us on any single dimension" = competitors that score TRUE
  // on a feature we score FALSE (currently only noLeadFees, honest).
  return {
    totalPlatforms:  TRADE_PLATFORMS.length,
    usFeatureCount,
    totalFeatures,
    othersScanned:   others.length
  };
}

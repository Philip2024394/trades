// Blueprint: Builders Merchant.
//
// One of the three Lane-1 reference blueprints. Positioning: retail +
// trade-account dual-mode merchant with click-and-collect. Aims at the
// Merchant Pro tier (£14.99/mo, building-merchant + builders-supplies).
//
// Dual-mode pricing (Feature #86), Trade Account PDF export (#87), and
// bulk-order CSV (#88) are the differentiators over Wickes/Selco/etc.
// which push visitors into an account funnel before showing prices.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "builders-merchant-full",
  name: "Builders Merchant · Full Depot",
  tagline: "Retail + trade prices, click-and-collect, 30-day accounts.",
  description:
    "A full merchant blueprint. Homepage foregrounds the category grid + trade-account CTA. Product surfaces support dual-mode retail/trade pricing (visible price for signed-in accounts). Includes trade-account application flow with PDF export and, optionally, DocuSign hand-off. Compliance: Companies House block, VAT display, Consumer Contracts pre-contract, GDPR.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: [
    "building-merchant",
    "builders-supplies",
    "timber-merchant",
    "tool-merchant",
    "aggregate-supplier",
    "plumbing-merchant",
    "electrical-wholesaler"
  ],

  outcomes: [
    "product-sales",
    "trade-account",
    "local-coverage",
    "quote-requests"
  ],
  variant: "industrial",

  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Everything on site, ready to go.",
          subhead: "Retail counter open 7am — trade accounts, credit terms, free local delivery over £75.",
          primaryCtaLabel: "Browse stock",
          secondaryCtaLabel: "Open a trade account"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Shop by category",
          minTiles: 12
        }
      },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Trade account?",
          message: "Sign in to see your prices, credit line, and next statement.",
          ctaLabel: "Sign in / apply"
        }
      },
      {
        key: "product_grid.classic_3col_1",
        slotHint: "body",
        config: {
          heading: "Trending on the counter",
          minProducts: 6,
          dualPricingEnabled: true
        }
      },
      {
        key: "brands.strip_1",
        slotHint: "body",
        config: {
          heading: "Brands we stock",
          minBrands: 8
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Trade account benefits",
          items: [
            { title: "30-day credit", body: "Trading-history checks apply. Bank details on application." },
            { title: "Trade prices", body: "10–30% under retail on most lines." },
            { title: "Bulk-order upload", body: "Drop a CSV, we quote back the same day." },
            { title: "One account, all branches", body: "Order from any depot, delivered locally." }
          ]
        }
      },
      {
        key: "map.embed_1",
        slotHint: "body",
        config: { heading: "Find your nearest depot" }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Trade account FAQ",
          preseed: [
            { q: "How long does trade-account approval take?", a: "24–48 hours for standard applications with 12-months trading history." },
            { q: "Do I need to be VAT-registered?", a: "No, but VAT-registered customers see net prices by default." },
            { q: "What credit limits do you offer?", a: "Set on approval. Typical starter limits £2,000–£10,000." }
          ]
        }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ],
    services: [
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Depot services",
          items: [
            { title: "Free local delivery over £75" },
            { title: "Same-day counter collection" },
            { title: "Trade-account credit lines" },
            { title: "Bulk-order quotations" },
            { title: "Site-drop delivery scheduling" },
            { title: "Key cutting + tool sharpening" }
          ]
        }
      }
    ]
  },

  score: {
    conversion: 88,
    seo: 90,
    trust: 92,
    mobile: 92,
    accessibility: 94,
    speed: 89,
    brandConsistency: 92
  },

  requiredCredentials: ["companies-house", "vat"],
  suggestedApps: [
    "shop_mode",
    "wholesale_mode",
    "downloads",
    "trade_center_picks",
    "trusted_trades",
    "custom_domain",
    "online_payments",
    "trade_connections"
  ],
  compliance: [
    "consumer-contracts-14day",
    "asa-superlative-guard",
    "gdpr-form-auditor"
  ],

  browserCard: {
    oneLiner: "Full merchant blueprint with dual retail/trade pricing + credit accounts.",
    benefits: [
      "Dual-mode pricing — signed-in trade accounts see their prices",
      "Trade-account application with PDF export",
      "Bulk-order CSV workflow for van drivers",
      "Companies House + VAT footer auto-populated"
    ],
    priceLabel: "Included in Merchant Pro",
    estimatedBuildMinutes: 15
  },

  expectedModules: [
    "website",
    "verified-badges",
    "shop-mode",
    "wholesale-mode",
    "material-calculators",
    "downloads",
    "trade-connections",
    "stock",
    "customer-portal",
    "delivery-tracking",
    "payments"
  ],
  industryIntelligence: [
    "Trade accounts + credit lines are the primary revenue driver",
    "Free delivery inside a radius is the local buyer's tipping point",
    "Cut-to-size + machining service is a common competitive lever",
    "Companies House + VAT are foot-of-page mandatory for B2B trust",
    "Bulk-order CSV upload is a repeat-buyer retention tool"
  ]
};

blueprintRegistry.register(manifest);
export default manifest;

// Blueprint: Timber Merchant · Depot + Trade Accounts.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "timber-merchant-depot",
  name: "Timber Merchant · Depot",
  tagline: "Softwood, hardwood, sheet goods — cut, planed, delivered.",
  description:
    "Trade-first timber merchant blueprint. Dual retail/trade pricing on featured products, cut-to-size service callout, machining + planing capability. Trade account application funnel + credit-terms explainer.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["timber-merchant", "building-merchant"],
  outcomes: ["product-sales", "trade-account", "local-coverage"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Timber. Cut, planed, delivered.",
          subhead: "Trade counter open 7am. Trade accounts, 30-day credit, van delivery over £100.",
          primaryCtaLabel: "Browse timber",
          secondaryCtaLabel: "Open a trade account"
        }
      },
      { key: "categories.grid_1", slotHint: "body", config: { heading: "Timber by type", minTiles: 12 } },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Cut to size?",
          message: "Tell us the sizes, we cut + plane on the yard. Ready for collection or delivery.",
          ctaLabel: "See cut-to-size"
        }
      },
      { key: "product_grid.classic_3col_1", slotHint: "body", config: { heading: "Popular this week", minProducts: 6, dualPricingEnabled: true } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we do",
          items: [
            { title: "Softwood + hardwood", body: "PSE, sawn, planed, moulded. Sheet goods MDF + ply + OSB." },
            { title: "Cut to size", body: "Length + width to your spec. No minimum cut fee for trade accounts." },
            { title: "Machining + planing", body: "Skirting, architrave, decking machined on the yard." },
            { title: "Van delivery", body: "Free within 5 miles over £100. Longer routes quoted." }
          ]
        }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Trade account FAQ",
          preseed: [
            { q: "How do I open an account?", a: "12 months trading history + 2 trade references. 24–48 hour turnaround." },
            { q: "What credit limits?", a: "£1,000 – £15,000 starter limits. Reviewed after 3 months' trading with us." },
            { q: "Can I click-and-collect?", a: "Yes — order online, collect same-day from the yard during trade hours." },
            { q: "Do you deliver on Saturday?", a: "Yes to trade accounts — book by Friday 3pm." }
          ]
        }
      },
      { key: "map.embed_1", slotHint: "body", config: { heading: "Find the yard" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 89, trust: 90, mobile: 91, accessibility: 93, speed: 88, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "vat"],
  suggestedApps: ["shop_mode", "wholesale_mode", "downloads", "trade_center_picks", "trusted_trades", "trade_connections", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Trade-first timber merchant site with cut-to-size + credit accounts.",
    benefits: [
      "Dual retail/trade pricing on featured lines",
      "Cut-to-size + machining service callout",
      "Trade account application flow with credit-terms explainer",
      "Companies House + VAT footer auto-populated"
    ],
    priceLabel: "Included in Merchant Pro",
    estimatedBuildMinutes: 13
  }
};
blueprintRegistry.register(manifest);
export default manifest;

// Blueprint: Kitchen Showroom · Design + Supply.
//
// Distinct from kitchen-fitter-showroom: this is the SHOWROOM angle —
// a brand-driven retailer that designs, sells, and coordinates fitters.
// Financing + trade fitter network + brand strip are the levers.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "kitchen-showroom-design",
  name: "Kitchen Showroom · Design + Supply",
  tagline: "Design your kitchen. We supply. We fit.",
  description:
    "Kitchen showroom retailer blueprint. Brand-heavy hero, showroom visit CTA, financing narrative (FCA-authorised broker), fitter-network coordination. Distinct from a pure fitter — the showroom sells + designs, fit optional through vetted partners.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["kitchen-manufacturer", "kitchen-fitter"],
  outcomes: ["quote-requests", "product-sales", "service-sales"],
  variant: "premium",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Kitchens designed in the showroom. Fitted on your street.",
          subhead:
            "Free 3D design service. 12 kitchen ranges on display. Interest-free finance available. Vetted fitter network.",
          primaryCtaLabel: "Book a showroom visit",
          secondaryCtaLabel: "Browse ranges"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent kitchens", minTiles: 9 } },
      { key: "brands.strip_1", slotHint: "body", config: { heading: "Kitchen brands we carry", minBrands: 8 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "The showroom journey",
          items: [
            { title: "Book a visit", body: "45–60 minutes with a designer. Bring photos + rough dimensions." },
            { title: "3D design + quote", body: "Layout, appliances, worktops. Priced line-by-line, no pressure." },
            { title: "Order + delivery", body: "6–10 weeks lead-time typical. Delivered when your fitter is ready." },
            { title: "Fit + sign-off", body: "Our vetted fitters, or your own. Snag walk-through on completion." }
          ]
        }
      },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Interest-free finance",
          message: "0% APR on qualifying orders. FCA-authorised broker. Subject to status.",
          ctaLabel: "See finance options"
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Book a home visit" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Kitchen showroom FAQ",
          preseed: [
            { q: "Do I have to use your fitter?", a: "No — supply-only or supply-and-fit. Our fitter network is vetted + insured but yours is welcome too." },
            { q: "How does finance work?", a: "0% and low-APR through our authorised broker. Application at design stage — subject to status." },
            { q: "Can I take samples home?", a: "Yes — worktop chips + door swatches available on request." },
            { q: "Free design?", a: "Yes — no obligation. Our design fee is credited against your order if you proceed." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a showroom visit", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 88, trust: 92, mobile: 92, accessibility: 94, speed: 88, brandConsistency: 94 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "trustmark"],
  suggestedApps: ["quote_pipeline", "downloads", "meet_the_team", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Kitchen showroom retailer site with 3D design + finance + fitter-network model.",
    benefits: [
      "Brand-heavy showroom-visit CTA",
      "0% finance banner with FCA-authorised copy",
      "Supply-only vs supply-and-fit path — no lock-in for homeowners",
      "Recent-kitchens gallery + brand strip for authority"
    ],
    priceLabel: "Free for kitchen showrooms",
    estimatedBuildMinutes: 13
  }
};
blueprintRegistry.register(manifest);
export default manifest;

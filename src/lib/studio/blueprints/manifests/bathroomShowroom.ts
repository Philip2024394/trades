// Blueprint: Bathroom Showroom · Design + Supply.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "bathroom-showroom-design",
  name: "Bathroom Showroom · Design + Supply",
  tagline: "Design your bathroom. We supply. We fit.",
  description:
    "Bathroom showroom retailer blueprint. Distinct from bathroom-fitter — brand-heavy, 3D design service, showroom-visit CTA, disability + accessible-bathroom specialism, finance options.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["bathroom-fitter"],
  outcomes: ["quote-requests", "product-sales", "service-sales"],
  variant: "premium",
  layout: {
    home: [
      {
        key: "hero.product_showroom_1",
        slotHint: "hero",
        config: {
          headline: "Bathrooms designed. Fitted. Ready to enjoy.",
          subhead:
            "12 bathroom ranges on display. Wetrooms, en-suites, accessible walk-in showers. Free 3D design service.",
          primaryCtaLabel: "Book a showroom visit",
          secondaryCtaLabel: "Browse ranges"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent bathrooms", minTiles: 9 } },
      { key: "brands.strip_1", slotHint: "body", config: { heading: "Bathroom brands we carry", minBrands: 8 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How it works",
          items: [
            { title: "Showroom visit", body: "See ranges + tiles + brassware. Take swatches home." },
            { title: "3D design + quote", body: "Layout options + itemised quote. Free — no pressure." },
            { title: "Order + delivery", body: "Delivered to site when the fitter needs it. Nothing rots in your garage." },
            { title: "Fit + sign-off", body: "Vetted fitter network or your own. Walk-through + snag list at handover." }
          ]
        }
      },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Accessible bathrooms",
          message: "Level-access showers, grab rails, walk-in baths. VAT-relief for disability-adapted work — we handle the paperwork.",
          ctaLabel: "See accessible ranges"
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Book a home visit" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Bathroom showroom FAQ",
          preseed: [
            { q: "Do I have to use your fitter?", a: "No — supply-only or supply-and-fit. Our fitter network is vetted + insured; your fitter is welcome too." },
            { q: "Do you do wetrooms?", a: "Yes — full tanking + level-access. Manufacturer-warranted tanking system." },
            { q: "Accessible / disability bathrooms?", a: "Yes — VAT relief on eligible qualifying disability adaptations. We handle the HMRC declaration form for you." },
            { q: "Finance?", a: "0% and low-APR available on qualifying orders through our authorised broker." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a showroom visit", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 88, trust: 92, mobile: 92, accessibility: 96, speed: 88, brandConsistency: 94 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "meet_the_team", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "wras-water-cold"],
  browserCard: {
    oneLiner: "Bathroom showroom retailer site with accessible-bathroom + VAT-relief funnel.",
    benefits: [
      "Brand-heavy showroom-visit CTA",
      "Accessible bathroom + VAT-relief specialism callout",
      "Wetroom tanking + accessible-bath cross-sell",
      "Supply-only vs supply-and-fit no lock-in"
    ],
    priceLabel: "Free for bathroom showrooms",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;

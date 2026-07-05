// Blueprint: Tiler · Kitchens, Bathrooms, Wetrooms.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "tiler-portfolio",
  name: "Tiler · Portfolio",
  tagline: "Kitchens, bathrooms, wetrooms — set true, laid tight.",
  description:
    "Portfolio-first tiler site. Wetroom + large-format specialism callouts. Full 12-service catalogue from Appendix D.9. Tanking warranty language stays inside CAP 3.53 (references manufacturer warranty explicitly).",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["tiler"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "minimal",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Tiling that sits right. Grout that stays clean.",
          subhead: "Bathrooms, kitchens, wetrooms. Large-format, natural stone, book-matched slabs.",
          primaryCtaLabel: "Get a quote",
          secondaryCtaLabel: "See recent tiling"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent tiling", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Tiling services",
          items: [
            { title: "Bathroom wall tiling" },
            { title: "Bathroom floor tiling" },
            { title: "Kitchen splashback" },
            { title: "Kitchen floor tiling" },
            { title: "Wetroom tanking + tile" },
            { title: "Shower enclosure tiling" },
            { title: "Underfloor heating overlay" },
            { title: "Large-format / book-match" },
            { title: "Natural stone install" },
            { title: "Mosaic + pattern feature" },
            { title: "Grout / silicone renewal" },
            { title: "Tile removal + prep" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the job?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Tiling FAQ",
          preseed: [
            { q: "How long does a bathroom take?", a: "Typical bathroom wall + floor 3–5 days including tanking + set time." },
            { q: "What's your waterproof warranty?", a: "Tanking system warranty is the manufacturer's (Schlüter, Mapei). Our workmanship carries a separate 24-month guarantee." },
            { q: "Can you match discontinued tiles?", a: "We do our best — merchant network + salvage yards for period patterns." },
            { q: "Do you supply the tiles?", a: "Trade-priced through our merchant, or you supply — we quote labour separately." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a photo + a note", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 83, seo: 84, trust: 87, mobile: 90, accessibility: 93, speed: 91, brandConsistency: 91 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Portfolio-led tiler site with CAP-safe waterproof warranty language.",
    benefits: [
      "Mosaic hero + recent-tiling gallery",
      "Wetroom + large-format specialism callouts",
      "12-service grid + tanking-warranty FAQ",
      "Photo-attach enquiry form"
    ],
    priceLabel: "Free for tilers",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;

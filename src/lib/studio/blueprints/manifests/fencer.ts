// Blueprint: Fencing Contractor.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "fencing-contractor",
  name: "Fencing Contractor",
  tagline: "Feather-edge, close-board, panels, gates — installed properly.",
  description:
    "Fencing contractor blueprint. Portfolio-led, storm-response callout (broken fence after wind), post-and-panel + custom builds, gate specialism. Seasonal repair funnel.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["fencing-contractor"],
  outcomes: ["quote-requests", "project-showcase", "local-coverage"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "New fencing. Old fencing fixed. Gates that swing right.",
          subhead: "Feather-edge, close-board, panel, picket, agricultural. Storm damage repaired fast.",
          primaryCtaLabel: "Get a quote",
          secondaryCtaLabel: "See recent fencing"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent fencing", minTiles: 8 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Fencing services",
          items: [
            { title: "Feather-edge (close-board) fencing" },
            { title: "Overlap + lap panel fencing" },
            { title: "Picket + garden fencing" },
            { title: "Trellis + decorative panels" },
            { title: "Concrete post + gravel-board install" },
            { title: "Storm-damage repair" },
            { title: "Fence painting / staining" },
            { title: "Timber garden gates" },
            { title: "Automated gates + electrics" },
            { title: "Agricultural fencing" },
            { title: "Palisade + security fencing" },
            { title: "Fence removal + waste disposal" }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the fence?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Fencing FAQ",
          preseed: [
            { q: "How long does 20 m take?", a: "Typical 20 m post-and-panel 1 day with 2 fitters. Concrete-post + gravel-board add half a day." },
            { q: "Do you take the old fence away?", a: "Yes — waste-carrier registered, all fees included." },
            { q: "How high can I build without planning?", a: "1 m adjacent to a highway, 2 m elsewhere. Higher needs planning." },
            { q: "What's your warranty?", a: "12-month workmanship + storm-force clause. Materials carry manufacturer's warranty." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a photo + rough length", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 84, seo: 84, trust: 85, mobile: 91, accessibility: 92, speed: 91, brandConsistency: 89 },
  requiredCredentials: ["companies-house", "public-liability", "waste-carrier"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Fencing contractor site with storm-response mini-funnel.",
    benefits: [
      "12-service fencing grid",
      "Storm damage callout for seasonal repair enquiries",
      "Planning-permission height guidance in FAQ",
      "Waste Carrier badge auto-lights when you add your number"
    ],
    priceLabel: "Free for fencers",
    estimatedBuildMinutes: 9
  }
};
blueprintRegistry.register(manifest);
export default manifest;

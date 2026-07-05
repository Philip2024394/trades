// Blueprint: Tree Surgeon.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "tree-surgeon-arb",
  name: "Tree Surgeon · Arboriculture",
  tagline: "Felling, pruning, hedges, stump grinding. NPTC certified.",
  description:
    "NPTC / LANTRA-certified tree surgeon site. Emergency callout for storm-damaged trees + planned pruning + hedge work. TPO / Conservation Area FAQ addresses the planning gotcha that trips homeowners up.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["tree-surgeon"],
  outcomes: ["quote-requests", "emergency-callout", "local-coverage"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Trees, hedges, stumps — done properly, cleared cleanly.",
          subhead: "NPTC certified. Fully insured. Storm-damaged tree emergencies handled fast.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "Storm damage? Call now"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent jobs", minTiles: 8 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Arb services",
          items: [
            { title: "Tree felling (small + large)" },
            { title: "Crown reduction + reshaping" },
            { title: "Deadwood removal" },
            { title: "Storm damage clearance" },
            { title: "Hedge cutting + reshaping" },
            { title: "Stump grinding" },
            { title: "Site clearance" },
            { title: "Log + wood chip disposal (or take-away)" },
            { title: "TPO application support" },
            { title: "Woodland management" }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where are the trees?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Tree work FAQ",
          preseed: [
            { q: "Is my tree protected?", a: "Trees in a Conservation Area or under a Tree Preservation Order (TPO) need council permission before work. We check + apply on your behalf." },
            { q: "Do you climb?", a: "Yes — NPTC CS38/CS39. MEWP + climbing where site conditions allow." },
            { q: "What about the mess?", a: "We chip on site (or bag) + take everything away. Some jobs we leave chip for garden use if you want it." },
            { q: "Are you insured?", a: "Public Liability £5m. Certificate on request." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a photo of the tree", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 85, seo: 84, trust: 88, mobile: 92, accessibility: 93, speed: 91, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "public-liability", "waste-carrier"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Tree surgeon site with TPO + Conservation Area FAQ + storm emergency callout.",
    benefits: [
      "10-service arb catalogue",
      "TPO / Conservation Area planning FAQ preloaded",
      "Storm damage emergency callout mini-funnel",
      "Waste Carrier badge auto-lights on chip removal"
    ],
    priceLabel: "Free for tree surgeons",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;

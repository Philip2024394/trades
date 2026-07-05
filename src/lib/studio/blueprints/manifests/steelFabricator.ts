// Blueprint: Steel Fabricator · Structural + Architectural.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "steel-fabricator",
  name: "Steel Fabricator · Structural + Architectural",
  tagline: "Beams, staircases, balustrades, portal frames. CE / UKCA marked.",
  description:
    "Steel fabricator blueprint. Portfolio-heavy (steel jobs sell on photos). Positioned for both trade (builders + structural engineers) + direct-to-consumer (bespoke architectural). UKCA + CE marking narrative for post-Brexit compliance.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["steel-fabricator", "welder", "manufacturer"],
  outcomes: ["quote-requests", "project-showcase", "trade-account"],
  variant: "industrial",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Steel. Cut, welded, delivered.",
          subhead:
            "Structural beams, portal frames, staircases, balustrades. Bespoke architectural. UKCA + CE marked. In-house delivery.",
          primaryCtaLabel: "Send drawings",
          secondaryCtaLabel: "See recent fabrications"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent fabrications", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Fabrication capability",
          items: [
            { title: "Structural steel (beams, columns)" },
            { title: "RSJ + goalpost cutting to size" },
            { title: "Portal frames" },
            { title: "Mezzanine floors" },
            { title: "External + internal staircases" },
            { title: "Balustrades + handrails" },
            { title: "Balconies + Juliette balconies" },
            { title: "Gates + railings (architectural)" },
            { title: "Bespoke welding + repair" },
            { title: "Galvanising + powder-coat finish" },
            { title: "Site erection + install" },
            { title: "Delivery within radius" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How a project runs",
          items: [
            { title: "Drawings + spec", body: "PDF + DWG accepted. We'll clarify + confirm before cut." },
            { title: "Cut + weld", body: "In-house CNC + coded welders (BS EN ISO 9606-1)." },
            { title: "Finish + mark", body: "Prime + top-coat OR galvanise. UKCA / CE stamped." },
            { title: "Deliver + install", body: "HIAB delivery + on-site erection where required." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What builders + architects said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Steel FAQ",
          preseed: [
            { q: "Do you supply RSJs cut to size?", a: "Yes — send us the size + span + drilling requirements. Delivered inside 5–10 working days for standard sections." },
            { q: "UKCA / CE marking?", a: "All structural steel supplied with UKCA + CE declaration of performance (EN 1090). Non-structural on request." },
            { q: "Do you install on site?", a: "Yes — HIAB delivery + coded welders + engineers for site erection. Priced separately from fabrication." },
            { q: "Trade accounts?", a: "12 months trading history + 2 references. Standard 30-day terms with credit limit." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send drawings + spec", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 84, seo: 88, trust: 93, mobile: 90, accessibility: 93, speed: 88, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments", "job_diary"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Steel fabricator site with UKCA/CE compliance + trade B2B account funnel.",
    benefits: [
      "Portfolio-heavy hero + recent-fabrications gallery",
      "UKCA + CE (EN 1090) declaration narrative",
      "Coded-welder credibility (BS EN ISO 9606-1)",
      "Trade + direct-to-consumer dual pricing"
    ],
    priceLabel: "Free for steel fabricators",
    estimatedBuildMinutes: 13
  }
};
blueprintRegistry.register(manifest);
export default manifest;

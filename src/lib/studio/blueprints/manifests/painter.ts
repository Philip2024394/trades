// Blueprint: Painter & Decorator · Interior + Exterior.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "painter-decorator",
  name: "Painter & Decorator",
  tagline: "Rooms, exteriors, sprays — done neatly and on time.",
  description:
    "Portfolio-first painter site. Full 12-service catalogue from Appendix D.8, spray-finish specialism callout for kitchen respray, landlord-void mini-funnel for recurring letting-agent work.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["painter", "decorator"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "minimal",
  layout: {
    home: [
      {
        key: "hero.portfolio_mosaic_1",
        slotHint: "hero",
        config: {
          headline: "Painters + decorators. Neat work, tight dates, no drama.",
          subhead: "Rooms, exteriors, spray finishes. Landlord voids turned around fast.",
          primaryCtaLabel: "Book a quote",
          secondaryCtaLabel: "See recent work"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent rooms", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Decorating services",
          items: [
            { title: "Interior room repaint" },
            { title: "Full-house repaint" },
            { title: "Exterior masonry paint" },
            { title: "Woodwork + sash paint" },
            { title: "Wallpaper hanging" },
            { title: "Spray finishing (kitchens + doors)" },
            { title: "Staircase + spindle refinish" },
            { title: "Radiator paint / respray" },
            { title: "Damp / mould stain block" },
            { title: "Commercial + landlord void" },
            { title: "Heritage colour matching" },
            { title: "Preparation only" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the job?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Common questions",
          preseed: [
            { q: "Do you supply the paint?", a: "Both. Trade-priced paint from our merchant, or you supply — we quote labour + prep separately." },
            { q: "How long does a room take?", a: "Standard bedroom 1–2 days including prep. Full house 5–10 days." },
            { q: "Do you handle landlord voids?", a: "Yes — often on 48-hour turnarounds. Photo report at handover." },
            { q: "Can you spray kitchen doors?", a: "Yes — HVLP airless in our booth. Turnaround typically 3–5 days off-site." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send a photo + a note", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 82, seo: 84, trust: 86, mobile: 90, accessibility: 93, speed: 92, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Portfolio-led painter + decorator site with landlord-void funnel.",
    benefits: [
      "Mosaic hero + recent-rooms gallery",
      "12-service grid from the UK decorating library",
      "Spray-finish specialism callout for kitchen respray",
      "Landlord void mini-funnel for letting-agent repeat work"
    ],
    priceLabel: "Free for decorators",
    estimatedBuildMinutes: 10
  }
};
blueprintRegistry.register(manifest);
export default manifest;

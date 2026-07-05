// Blueprint: Party Wall Surveyor.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "party-wall-surveyor",
  name: "Party Wall Surveyor",
  tagline: "Notices, awards, appointments. Party Wall etc. Act 1996.",
  description:
    "Party wall surveyor blueprint. Positioned for both building owners (planning an extension / basement) and adjoining owners (received a notice). Plain-English explainer of the Act, fixed-fee awards, section-6 excavation specialism.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["structural-engineer"],
  outcomes: ["quote-requests", "service-sales", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Party Wall Act. Handled properly.",
          subhead:
            "Serving notices. Schedules of condition. Awards. Section-6 excavation. Fixed-fee packages for straightforward work.",
          primaryCtaLabel: "Building owner? Get help",
          secondaryCtaLabel: "Adjoining owner? Free advice"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Where you are in the process",
          items: [
            { title: "Planning work", body: "You're the building owner. We serve notices, prepare schedule of condition, agree the award." },
            { title: "Received a notice", body: "You're the adjoining owner. First appointment often free — we advise on your rights + risks." },
            { title: "Excavation nearby", body: "Section 6 — foundations within 3 m. Notice period longer, calculations required." },
            { title: "Dispute or award", body: "Third surveyor arbitration + section 10 procedure. We manage." }
          ]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Services",
          items: [
            { title: "Party wall notice preparation + service" },
            { title: "Schedule of condition (photo + written)" },
            { title: "Party wall award (single surveyor)" },
            { title: "Party wall award (agreed surveyor)" },
            { title: "Third surveyor appointment" },
            { title: "Section 6 excavation notice" },
            { title: "Adjoining owner representation" },
            { title: "Dispute resolution + arbitration" },
            { title: "Post-works inspection" },
            { title: "Damage assessment + costing" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Party wall FAQ",
          preseed: [
            { q: "Do I need a party wall surveyor?", a: "If your work affects a shared wall, floor, or foundations within 3 m — yes, the Act requires notice + often an award. We advise for free." },
            { q: "How long does it take?", a: "Notice period 2 months for Section 3, 1 month for Section 6. Award typically 4–6 weeks from consent." },
            { q: "Who pays?", a: "Almost always the building owner — including the adjoining owner's reasonable surveyor fees. Our quotes are transparent." },
            { q: "What if my neighbour won't respond?", a: "After 14 days from notice you can appoint on their behalf — Section 10(4). We handle the appointment." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send your project details", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 85, seo: 89, trust: 94, mobile: 89, accessibility: 94, speed: 91, brandConsistency: 93 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Party wall surveyor site with both-parties navigation + section-by-section clarity.",
    benefits: [
      "Split hero for building-owner vs adjoining-owner journeys",
      "Section 3 vs Section 6 process narrative",
      "Fixed-fee package messaging removes call-off anxiety",
      "Section 10(4) escalation copy for non-responding neighbours"
    ],
    priceLabel: "Free for party wall surveyors",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;

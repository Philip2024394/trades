// Blueprint: Chartered Surveyor · RICS.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "chartered-surveyor-rics",
  name: "Chartered Surveyor · RICS",
  tagline: "Homebuyer surveys, Level 3 building surveys, valuations.",
  description:
    "RICS-registered chartered surveyor blueprint. Homebuyer + Level 3 building surveys, valuations, defect reports, party-wall consulting. Positioned for pre-purchase homeowners + solicitors.",
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
          headline: "RICS surveys. Plain-English reports. Fast turnaround.",
          subhead:
            "Homebuyer Level 2, Building Survey Level 3, market valuations. Regulated by RICS. Reports typically within 5 working days.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See sample reports"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Which survey do you need",
          items: [
            { title: "Homebuyer Level 2", body: "Standard construction properties in good condition. Traffic-light report." },
            { title: "Building Survey Level 3", body: "Older / larger / listed / unusual construction. Deep-dive." },
            { title: "Market valuation", body: "Standalone valuation for probate, matrimonial, tax." },
            { title: "Defect / specific report", body: "Damp, movement, timber — targeted report on one issue." }
          ]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Services",
          items: [
            { title: "Homebuyer Survey (Level 2)" },
            { title: "Building Survey (Level 3)" },
            { title: "Market valuation" },
            { title: "Reinstatement cost assessment (insurance)" },
            { title: "Defect investigation report" },
            { title: "Damp + timber report" },
            { title: "Structural movement report" },
            { title: "Party-wall consulting" },
            { title: "Schedule of condition (leaseholder)" },
            { title: "Pre-auction survey" },
            { title: "Snagging survey (new-build)" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients + solicitors said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Survey FAQ",
          preseed: [
            { q: "Do I need Level 2 or Level 3?", a: "Level 2 for standard modern properties in good condition. Level 3 for period, listed, extended, or where you already suspect issues. We advise on the call — no pressure." },
            { q: "How long does a report take?", a: "Typical 3–5 working days after inspection. Priority turnaround available." },
            { q: "Are you RICS regulated?", a: "Yes — RICS-registered valuer, PII cover £2m+ (or as required). Certificate on request." },
            { q: "Can I attend the survey?", a: "Yes — at the end of the visit for a walk-through. Most clients find it valuable." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 85, seo: 89, trust: 96, mobile: 89, accessibility: 94, speed: 90, brandConsistency: 93 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "RICS chartered surveyor site with survey-level decision tree + solicitor CTA.",
    benefits: [
      "Level 2 vs Level 3 decision helper",
      "11-service catalogue including party-wall + defect reports",
      "Sample-report gate for confidence before booking",
      "RICS badge foregrounded"
    ],
    priceLabel: "Free for chartered surveyors",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;

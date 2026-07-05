// Blueprint: Asbestos Surveyor + Licensed Removal.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "asbestos-surveyor-licensed",
  name: "Asbestos Surveyor + Licensed Removal",
  tagline: "Management + refurbishment + demo surveys. Licensed removal.",
  description:
    "UKAS-accredited asbestos surveying + HSE-licensed removal blueprint. B2B (duty holder + landlord + building owner) plus renovation-day homeowner traffic. CAR 2012 compliance narrative. Clear surveys-only vs licensed-removal service split.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["certification-provider"],
  outcomes: ["quote-requests", "service-sales", "trade-account"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Asbestos. Found, managed, removed properly.",
          subhead:
            "UKAS-accredited surveys. HSE-licensed removal. CAR 2012 duty-holder compliance packs. Post-1999 clearance certificates.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "Licensed removal enquiry"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Which survey do you need",
          items: [
            { title: "Management survey", body: "For occupied buildings pre-1999. Non-intrusive. Registers ACMs for the management plan." },
            { title: "Refurbishment / demolition survey", body: "Intrusive — before ANY refurb / demo work touching ACMs. Legal requirement." },
            { title: "Bulk sampling", body: "Suspicious material identified — analysed at UKAS lab." },
            { title: "Air testing + clearance", body: "Post-removal certificate before space returns to use." }
          ]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full service list",
          items: [
            { title: "Management asbestos survey" },
            { title: "Refurbishment / demolition survey" },
            { title: "Asbestos re-inspection + register update" },
            { title: "Bulk sampling + UKAS lab analysis" },
            { title: "HSE-licensed asbestos removal" },
            { title: "Non-licensed asbestos removal (NNLW)" },
            { title: "Air monitoring + clearance certificate" },
            { title: "Asbestos management plan (writing + review)" },
            { title: "Duty-holder training" },
            { title: "Emergency response + isolation" }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the property?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What FM buyers said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Asbestos FAQ",
          preseed: [
            { q: "Is my property likely to have asbestos?", a: "Any UK building constructed or refurbished before 2000 may contain ACMs. Very common: Artex, floor tiles, cement sheet roofs, boiler flues, pipe insulation." },
            { q: "Do I need a survey before refurb?", a: "Legally, yes — a Refurbishment / Demolition survey MUST be completed BEFORE ANY work disturbs materials that may contain asbestos (CAR 2012, Regulation 5)." },
            { q: "Can homeowners remove asbestos?", a: "Some non-licensed asbestos (bonded cement) can be removed by homeowners with correct PPE + disposal. Higher-risk material (insulation, coating, sprayed) — LICENSED removal only." },
            { q: "How long does it take?", a: "Small management survey — 1 day + report 3 days. Removal 1–5 days depending on scope + air testing turnaround." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 84, seo: 89, trust: 96, mobile: 89, accessibility: 94, speed: 90, brandConsistency: 93 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "chas"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "Asbestos surveyor + HSE-licensed removal site with CAR 2012 duty-holder compliance packs.",
    benefits: [
      "Management vs Refurb/Demo survey decision helper",
      "CAR 2012 Regulation 5 legal-mandate copy for anxious duty holders",
      "Licensed + non-licensed removal service split — homeowner clarity",
      "Clearance certificate + UKAS lab narrative for confidence"
    ],
    priceLabel: "Free for asbestos specialists",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;

// Blueprint: Construction Training Provider.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "training-provider-construction",
  name: "Training Provider · Construction",
  tagline: "CSCS, IPAF, PASMA, First Aid, Asbestos Awareness — booked online.",
  description:
    "Construction training provider blueprint. Course-first hero, schedule + book flow, accreditation strip (CITB / IPAF / PASMA / IOSH). Group booking discount funnel for main contractors.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["training-provider", "certification-provider"],
  outcomes: ["training-signups", "quote-requests", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Get carded. Get certified. Get on site.",
          subhead: "CSCS test prep, IPAF PAL, PASMA, First Aid at Work, Asbestos Awareness — most courses within 5 working days.",
          primaryCtaLabel: "See course schedule",
          secondaryCtaLabel: "Group booking?"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Courses we run",
          minTiles: 8,
          preseed: [
            { title: "CSCS test + card", body: "Green + blue + gold" },
            { title: "IPAF PAL / operator", body: "MEWP scissor + cherry" },
            { title: "PASMA mobile tower", body: "Assembly + inspection" },
            { title: "First Aid at Work", body: "3-day + refresher" },
            { title: "Asbestos Awareness", body: "1-day CAT A" },
            { title: "Manual Handling", body: "Half-day workplace" },
            { title: "Working at Height", body: "1-day competent person" },
            { title: "Site Manager Safety (SMSTS)", body: "5-day CITB" }
          ]
        }
      },
      { key: "pricing.three_tier_1", slotHint: "body", config: { heading: "Course prices + schedule" } },
      { key: "brands.strip_1", slotHint: "body", config: { heading: "Accreditations", minBrands: 6 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Why book with us",
          items: [
            { title: "Small classes", body: "Max 12 per instructor for practical courses." },
            { title: "Group discounts", body: "Save 20% on 6+ bookings from one company." },
            { title: "Weekend + evening", body: "Some courses run Sat + evening for shift workers." },
            { title: "On-site delivery", body: "Larger groups: we come to your site or yard." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What trainees said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Training FAQ",
          preseed: [
            { q: "Do you do CSCS card applications?", a: "Yes — we book the CITB Health & Safety test + apply for your card on completion. Cost + card fee shown at checkout." },
            { q: "How long is IPAF valid?", a: "5 years. We remind you 60 days before expiry." },
            { q: "On-site training?", a: "Yes for 6+ trainees. We travel nationwide — quoted by postcode." },
            { q: "Cancellations?", a: "Free reschedule up to 48 hours before start. No refund thereafter." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a course", ctaLabel: "Book" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 88, seo: 88, trust: 91, mobile: 92, accessibility: 94, speed: 90, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Construction training provider site with course schedule + group discount funnel.",
    benefits: [
      "8-course category grid (CSCS / IPAF / PASMA / SMSTS)",
      "Group discount CTA for main-contractor bookings",
      "On-site delivery option for large cohorts",
      "Accreditation strip (CITB / IPAF / PASMA / IOSH)"
    ],
    priceLabel: "Free for training providers",
    estimatedBuildMinutes: 13
  }
};
blueprintRegistry.register(manifest);
export default manifest;

// Blueprint: Handyman · Multi-Service Local.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "handyman-multi-service",
  name: "Handyman · Multi-Service",
  tagline: "Small jobs done properly. One call, most trades covered.",
  description:
    "Portfolio-first handyman blueprint. Positioned as the reliable 'small jobs' fix — flatpack, TV mount, shelf hang, doors sticking, small plumbing / electrical, painting patches. Half-day + full-day rate cards. WhatsApp-first.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["handyman"],
  outcomes: ["quote-requests", "phone-calls", "whatsapp-enquiries"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Small jobs, done properly. Book a half-day.",
          subhead: "Flatpack, TV mount, shelves, sticking doors, small plumbing + electrical patches. WhatsApp us a photo — we tell you honestly if it's our job or a specialist's.",
          primaryCtaLabel: "WhatsApp a photo",
          secondaryCtaLabel: "Book a half-day"
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "What we cover",
          items: [
            { title: "Flatpack assembly (IKEA, Wren, Habitat)" },
            { title: "TV wall-mount + cable manage" },
            { title: "Shelf + picture hanging (heavy items)" },
            { title: "Sticking / squeaky doors" },
            { title: "Curtain pole + blind fit" },
            { title: "Small plumbing (tap, syphon, radiator bleed)" },
            { title: "Small electrical (fixture swap — non-notifiable)" },
            { title: "Damaged plaster patch + touch-up paint" },
            { title: "Silicone sealing (bath, kitchen)" },
            { title: "Fence-post repair" },
            { title: "Draft-proofing + door threshold" },
            { title: "Odd jobs list — send us a list" }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent jobs", minTiles: 8 } },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How pricing works",
          items: [
            { title: "Half-day", body: "4 hours — enough for a few small jobs. Materials extra at cost." },
            { title: "Full day", body: "8 hours — good for a punch-list. Materials extra at cost." },
            { title: "Priced up-front", body: "We tell you the day rate before the visit. No surprises." },
            { title: "Honest about specialists", body: "Notifiable electrical / gas jobs — we pass to a Part P or Gas Safe partner." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where are you?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What locals said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Handyman FAQ",
          preseed: [
            { q: "Do you do notifiable electrical work?", a: "No — Part P notifiable work goes through our vetted electrician partner. We can arrange it for you or do the non-notifiable bits ourselves." },
            { q: "Minimum booking?", a: "Half-day (4 hours). We won't take single-hour bookings — the travel + set-up isn't worth it for you or us." },
            { q: "Materials?", a: "You supply or we source at cost. Small jobs we can bring standard fittings for you." },
            { q: "How much notice?", a: "Typical 1–2 weeks ahead. Emergency squeezes possible — WhatsApp us." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send your job list", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 89, seo: 86, trust: 84, mobile: 96, accessibility: 94, speed: 92, brandConsistency: 88 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Handyman multi-service site with WhatsApp-first booking + half-day rate card.",
    benefits: [
      "12-service 'small jobs' catalogue that homeowners recognise",
      "WhatsApp deep-link with photo for instant scope check",
      "Honest 'we don't do notifiable' copy avoids ASA + Part P trouble",
      "Half + full-day rate cards up front"
    ],
    priceLabel: "Free for handymen",
    estimatedBuildMinutes: 9
  }
};
blueprintRegistry.register(manifest);
export default manifest;

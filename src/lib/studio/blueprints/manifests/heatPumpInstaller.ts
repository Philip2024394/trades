// Blueprint: Heat Pump Installer · MCS + BUS Grant.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "heat-pump-installer-mcs",
  name: "Heat Pump Installer · MCS + BUS",
  tagline: "Air-source + ground-source heat pumps. MCS certified. BUS £7,500 grant.",
  description:
    "MCS + F-Gas certified heat-pump installer blueprint. Foregrounds BUS £7,500 grant eligibility, radiator survey process, and honest running-cost expectations. ASA-safe — no unqualified 'cheaper than gas' claims. Consumer-code membership shown (DESNZ code-of-practice recognition).",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["heat-pump-installer"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Heat pumps done properly. £7,500 grant handled.",
          subhead: "MCS certified. F-Gas licensed. Full radiator survey, honest running-cost estimate, BUS application on your behalf.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent installs"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How the install runs",
          items: [
            { title: "Home survey", body: "Heat-loss calc, radiator sizing, indoor unit siting." },
            { title: "Grant + design", body: "BUS £7,500 application on your behalf. Full design pack." },
            { title: "Install week", body: "Outdoor unit, hot-water cylinder, wet upgrades where needed. Boiler removed at the end." },
            { title: "Commissioning + handover", body: "Weather-compensation set. Controls walk-through. Warranty registered." }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent installs", minTiles: 8 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the property?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Heat pump FAQ",
          preseed: [
            { q: "Am I eligible for the £7,500 BUS grant?", a: "Most owner-occupied and privately-rented homes qualify. We check at survey and manage the application." },
            { q: "Will it be as cheap as gas to run?", a: "Depends on your insulation, radiators, tariff. Well-designed systems commonly land at or below gas — we give you an honest estimate at survey, not a promise." },
            { q: "Do I need new radiators?", a: "Sometimes. Heat-loss calc tells us which rooms need larger emitters. Priced in the quote — nothing added later." },
            { q: "How long does install take?", a: "Typical 4–5 days on site for ASHP + cylinder. GSHP + loop 2–3 weeks including groundworks." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 87, trust: 94, mobile: 92, accessibility: 94, speed: 89, brandConsistency: 93 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "mcs"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "MCS heat-pump installer site with BUS grant application handled inline.",
    benefits: [
      "MCS badge auto-lights from the register",
      "BUS £7,500 grant workflow explained honestly",
      "ASA-safe running-cost language — no 'cheaper than gas' guarantees",
      "Heat-loss calc + radiator survey narrative built in"
    ],
    priceLabel: "Free for MCS installers",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;

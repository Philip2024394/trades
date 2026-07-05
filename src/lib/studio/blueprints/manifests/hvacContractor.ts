// Blueprint: HVAC Contractor · Commercial + Domestic.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "hvac-contractor",
  name: "HVAC Contractor",
  tagline: "Air-con, heating, ventilation. F-Gas registered. Commercial + domestic.",
  description:
    "F-Gas-certified HVAC contractor blueprint. Positioned for commercial + domestic air-con install, ventilation systems, service contracts. F-Gas mandatory for refrigerant work — badge foregrounded.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["hvac-engineer"],
  outcomes: ["quote-requests", "service-sales", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.trust_anchor_1",
        slotHint: "hero",
        config: {
          headline: "Air-con, heating, ventilation. F-Gas registered.",
          subhead: "Commercial + domestic install. Service contracts. Refrigerant compliance handled properly.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent installs",
          verifiedSchemes: ["companies-house", "vat"]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we install",
          items: [
            { title: "Split + multi-split air-con", body: "1kW – 20kW residential + light-commercial." },
            { title: "VRF / VRV systems", body: "Multi-zone office + retail." },
            { title: "Mechanical ventilation (MVHR)", body: "New builds + Passivhaus retrofit." },
            { title: "Chiller + AHU install", body: "Commercial cooling + air-handling." }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent installs", minTiles: 8 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Services",
          items: [
            { title: "Design + specification" },
            { title: "Split / multi-split air-con install" },
            { title: "VRF / VRV multi-zone install" },
            { title: "MVHR + ventilation install" },
            { title: "Chiller + air-handling unit install" },
            { title: "Ductwork design + fabrication" },
            { title: "Annual service contracts" },
            { title: "F-Gas leak-check (mandatory)" },
            { title: "Emergency breakdown call-out" },
            { title: "Refrigerant recovery + decommission" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the site?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "HVAC FAQ",
          preseed: [
            { q: "Do I need F-Gas certification for my building?", a: "Buildings with equipment > 5 tCO2e need mandatory leak checks. We audit + report." },
            { q: "How long does an air-con install take?", a: "Single split — 1 day. Multi-zone office — 3–10 days depending on ducting." },
            { q: "Do you offer service contracts?", a: "Yes — annual + biannual visits, statutory leak check, filter replacement." },
            { q: "F-Gas ban on R410A — will my system still be supported?", a: "Existing R410A systems remain supported. New installs default to R32 or R290." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 85, seo: 85, trust: 91, mobile: 90, accessibility: 93, speed: 89, brandConsistency: 91 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "F-Gas certified HVAC contractor site with commercial service-contract funnel.",
    benefits: [
      "F-Gas compliance messaging + statutory leak-check copy",
      "Commercial + domestic dual-track hero",
      "MVHR + Passivhaus specialism callout",
      "R32 / R290 refrigerant transition FAQ preloaded"
    ],
    priceLabel: "Free for HVAC contractors",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;

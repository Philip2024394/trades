// Blueprint: Solar Installer · MCS Verified.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "solar-installer-mcs",
  name: "Solar Installer · MCS Verified",
  tagline: "Solar PV + battery. MCS certified. BUS-grant eligible.",
  description:
    "MCS-certified solar installer blueprint. Foregrounds MCS badge (BUS-grant eligibility) + G99/G100 application process. Payback calculator hook (Material Calculator #37). ASA-safe wording — no unqualified 'savings' claims.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["solar-installer"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.stat_hero_1",
        slotHint: "hero",
        config: {
          headline: "Solar PV + battery, installed properly.",
          subhead: "MCS certified. G99 / G100 registered. Roof survey to sign-off in one team.",
          primaryCtaLabel: "Book a roof survey",
          secondaryCtaLabel: "See recent installs"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we install",
          items: [
            { title: "In-roof + on-roof PV", body: "4 kW – 12 kW residential arrays." },
            { title: "Battery storage", body: "Home battery pack, G99/G100 registered." },
            { title: "EV charge point", body: "OZEV-approved installer for pairing with your PV." },
            { title: "iBoost / diverter", body: "Divert surplus to hot water instead of exporting." }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent installs", minTiles: 8 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the roof?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Solar FAQ",
          preseed: [
            { q: "Are you MCS certified?", a: "Yes — required for Boiler Upgrade Scheme / SEG eligibility." },
            { q: "How long does install take?", a: "Typical 4 kW rooftop 1–2 days. Battery + G99 registration adds 1 day + DNO paperwork." },
            { q: "Will it 'pay back'?", a: "Payback depends on your usage, orientation, tariff. We give you a rough figure at survey — never a guarantee." },
            { q: "Do you handle DNO applications?", a: "Yes — G98 (fast-track) or G99 depending on capacity. Included in the quote." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What clients said", minCards: 3 } },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 87, seo: 87, trust: 93, mobile: 91, accessibility: 93, speed: 89, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "mcs"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "MCS-verified solar installer site with BUS-grant + G99 workflow copy.",
    benefits: [
      "MCS badge auto-lights from the register",
      "ASA-safe 'payback' language — never guarantees",
      "DNO G99/G100 workflow explained inline",
      "Battery + EV charge point cross-sell without cluttering"
    ],
    priceLabel: "Free for MCS installers",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;

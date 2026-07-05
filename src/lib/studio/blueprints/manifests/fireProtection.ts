// Blueprint: Fire Protection Contractor.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "fire-protection-contractor",
  name: "Fire Protection Contractor",
  tagline: "Fire alarms, extinguishers, sprinklers, doors. BAFE + FIA registered.",
  description:
    "Fire protection contractor blueprint. BAFE-registered fire alarm install + servicing, extinguisher supply + servicing, sprinkler install, passive fire (doors + stopping). Positioned for B2B FM buyers + landlord duty-holder compliance.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["fire-protection"],
  outcomes: ["quote-requests", "service-sales", "trade-account"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Fire safety compliance. Kept up. Signed off.",
          subhead:
            "BAFE-registered install + service. Fire alarms, extinguishers, sprinklers, passive fire. Regulatory Reform Order sign-off packs.",
          primaryCtaLabel: "Book a fire risk assessment",
          secondaryCtaLabel: "Servicing enquiry"
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Fire protection services",
          items: [
            { title: "Fire risk assessment (RRO)" },
            { title: "Fire alarm design + install (BS5839)" },
            { title: "Fire alarm servicing + certification" },
            { title: "Emergency lighting install + test (BS5266)" },
            { title: "Extinguisher supply + servicing" },
            { title: "Sprinkler install (BS EN 12845)" },
            { title: "Suppression systems (kitchen, IT)" },
            { title: "Passive fire doors + stopping" },
            { title: "Fire compartmentation audit" },
            { title: "Fire safety training" },
            { title: "Landlord fire compliance packs" },
            { title: "Reactive callout + repair" }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent installs", minTiles: 8 } },
      { key: "brands.strip_1", slotHint: "body", config: { heading: "Manufacturers we're approved for", minBrands: 8 } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What FM buyers said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Fire safety FAQ",
          preseed: [
            { q: "Do I legally need an FRA?", a: "Yes — Regulatory Reform (Fire Safety) Order 2005 requires a documented fire risk assessment for any non-domestic premises + HMOs. We provide FRA + action plan." },
            { q: "How often do fire alarms need testing?", a: "Weekly manual test by duty holder. 6-monthly service + annual certification by us." },
            { q: "Are you BAFE registered?", a: "Yes — BAFE SP203 for fire alarm install, SP205 for extinguishers. Certificate on request." },
            { q: "Landlord packs?", a: "Yes — full fire compliance pack: FRA + alarm cert + extinguisher record + emergency lighting record. Renewed annually." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book an FRA", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 85, seo: 87, trust: 94, mobile: 90, accessibility: 94, speed: 89, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "chas"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments", "job_diary"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor", "cdm-2015"],
  browserCard: {
    oneLiner: "Fire protection contractor site with BAFE + RRO landlord-pack funnel.",
    benefits: [
      "BAFE SP203 / SP205 accreditation narrative",
      "Landlord fire compliance pack cross-sell for recurring revenue",
      "12-service fire protection catalogue",
      "Regulatory Reform Order copy for FM duty-holder anxiety"
    ],
    priceLabel: "Free for fire protection contractors",
    estimatedBuildMinutes: 13
  }
};
blueprintRegistry.register(manifest);
export default manifest;

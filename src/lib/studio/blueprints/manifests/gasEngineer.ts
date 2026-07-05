// Blueprint: Gas Engineer · Boiler & Heating.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "gas-engineer-heating",
  name: "Gas Engineer · Boiler & Heating",
  tagline: "Gas Safe registered. Boiler installs, breakdowns, CP12s.",
  description:
    "Gas Safe engineer blueprint. Foregrounds the Gas Safe badge (mandatory — advertising gas work without registration is illegal). CP12 landlord recurring-revenue funnel. Boiler-breakdown emergency call-out. FAQ addresses grant eligibility + manufacturer accredited-installer status.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["heating-engineer", "gas-engineer"],
  outcomes: ["quote-requests", "phone-calls", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.trust_anchor_1",
        slotHint: "hero",
        config: {
          headline: "Gas Safe engineers. Boilers fitted, serviced, fixed.",
          subhead:
            "Registered with the Gas Safe Register. Landlord CP12s, boiler installs, breakdown callouts.",
          primaryCtaLabel: "Book a service",
          secondaryCtaLabel: "Boiler breakdown? Call now",
          verifiedSchemes: ["gas-safe", "companies-house"]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we cover",
          items: [
            { title: "Boiler install (combi + system)", body: "Fixed-price quotes with warranty registration." },
            { title: "Boiler service", body: "Annual maintenance + condition report." },
            { title: "Breakdown + repair", body: "Same-day call-outs where possible." },
            { title: "Landlord CP12 (safety certificate)", body: "Annual gas safety inspection + certificate." }
          ]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full service catalogue",
          items: [
            { title: "Boiler install (combi / system / regular)" },
            { title: "Boiler service" },
            { title: "Boiler breakdown / repair" },
            { title: "Landlord CP12 gas safety certificate" },
            { title: "Cooker / hob install" },
            { title: "Gas leak investigation" },
            { title: "Central heating install" },
            { title: "Smart / TRV controls" },
            { title: "Powerflush" },
            { title: "Underfloor heating (wet)" },
            { title: "Air-source heat pump (MCS)" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "Recent boiler jobs", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the boiler?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Common questions",
          preseed: [
            { q: "How quickly can you attend a breakdown?", a: "Same-day within our coverage area during working hours. Out-of-hours: we'll tell you honestly on the call." },
            { q: "Do you offer manufacturer warranties?", a: "Yes — 7-12 year warranties available on select brands where we're an accredited installer." },
            { q: "Do you fit heat pumps?", a: "Yes — MCS certified for air-source heat pumps. BUS £7,500 grant handled inline." },
            { q: "What's included in a landlord CP12?", a: "Full gas safety inspection + certificate valid 12 months. We remind you 30 days before it expires." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a service", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 89, seo: 86, trust: 93, mobile: 93, accessibility: 94, speed: 91, brandConsistency: 91 },
  requiredCredentials: ["gas-safe", "companies-house", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "lead_alerts", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Gas Safe engineer site with CP12 recurring-revenue funnel + breakdown callout.",
    benefits: [
      "Gas Safe badge foregrounded — mandatory advertising compliance",
      "Landlord CP12 annual-reminder mini-funnel for repeat revenue",
      "Boiler breakdown call-out CTA above the fold",
      "Heat-pump cross-sell for MCS-certified engineers"
    ],
    priceLabel: "Free for Gas Safe engineers",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;

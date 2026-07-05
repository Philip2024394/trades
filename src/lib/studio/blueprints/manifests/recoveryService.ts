// Blueprint: Vehicle Recovery · 24/7 Callout.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "vehicle-recovery-247",
  name: "Vehicle Recovery · 24/7",
  tagline: "Cars, vans, trucks. Roadside + accident recovery. 24/7.",
  description:
    "24/7 vehicle recovery blueprint. Phone-first, sticky call ribbon. Fleet contract cross-sell for insurance company + garage regulars. NRSPP-ready compliance narrative.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["recovery-service"],
  outcomes: ["emergency-callout", "phone-calls", "local-coverage"],
  variant: "emergency",
  layout: {
    home: [
      {
        key: "hero.emergency_247_1",
        slotHint: "hero",
        config: {
          headline: "Broken down? Accident? Locked in? Call now.",
          subhead:
            "24/7 recovery across the region. Cars, vans, motorbikes, up to 3.5t + light commercial. Insurance-approved.",
          primaryCtaLabel: "Call now",
          secondaryCtaLabel: "WhatsApp us",
          responsePromiseMinutes: 45
        }
      },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Fees before dispatch",
          message: "Recovery cost quoted before we send a truck. No hidden extras.",
          ctaLabel: "See our pricing"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we recover",
          items: [
            { title: "Cars + light vans", body: "Up to 3.5t. Roadside jump-start + tow." },
            { title: "Motorbikes", body: "Enclosed transport, straps + saddles." },
            { title: "Accident recovery", body: "Insurance-approved, photo report + police liaison." },
            { title: "Fleet contracts", body: "Priority response for taxi + delivery + fleet regulars." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the vehicle?" } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full service list",
          items: [
            { title: "Roadside breakdown recovery" },
            { title: "Accident recovery + storage" },
            { title: "Local + long-distance transport" },
            { title: "Motorbike enclosed transport" },
            { title: "Motorsport transport" },
            { title: "Jump-start + tyre change" },
            { title: "Locked-in / locked-out assistance" },
            { title: "Fleet + taxi priority contracts" },
            { title: "Illegal-parking removal (private land)" },
            { title: "Insurance total-loss collection" }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What drivers said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Recovery FAQ",
          preseed: [
            { q: "How much does recovery cost?", a: "Base call-out + mileage. Fixed price quoted before dispatch — no meter starts until we're moving." },
            { q: "Do you take insurance jobs?", a: "Yes — direct invoicing with major UK insurers. Reference number handled on the call." },
            { q: "How fast can you arrive?", a: "45 minutes inside our coverage area during working hours. Out-of-hours honestly quoted." },
            { q: "Do you take fleet contracts?", a: "Yes — priority response, monthly billing, dedicated account manager." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Fleet enquiry?", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 93, seo: 82, trust: 84, mobile: 97, accessibility: 94, speed: 93, brandConsistency: 88 },
  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: ["job_diary", "lead_alerts", "quote_pipeline", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "24/7 vehicle recovery site with fee-transparency + fleet contract funnel.",
    benefits: [
      "Sticky call ribbon — never leaves the viewport",
      "Fleet contract cross-sell for taxi + delivery repeat business",
      "Insurance-approved narrative for direct invoicing",
      "45-minute response promise (adjustable per merchant coverage)"
    ],
    priceLabel: "Free for recovery services",
    estimatedBuildMinutes: 9
  }
};
blueprintRegistry.register(manifest);
export default manifest;

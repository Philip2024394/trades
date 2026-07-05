// Blueprint: Emergency Plumber · 24/7 Callout.
//
// Domestic plumber positioned for the phone-in-pocket emergency. Sticky
// call ribbon, response-time promise, no-call-out-fee disclosure that
// respects the ASA rulings (Rightio Nov 2020, Town Force Nov 2020) —
// diagnostic charge shown in the same visual field as the "no call-out"
// claim so the merchant can't accidentally trigger a complaint.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "plumber-emergency",
  name: "Plumber · Emergency + Domestic",
  tagline: "Burst pipe? Blocked drain? We're on the doorstep in 90 minutes.",
  description:
    "A phone-first plumbing blueprint. Sticky call bar, 90-minute response promise, transparent diagnostic-fee disclosure (ASA-compliant), and a coverage postcode gate so the visitor knows in one second if you're their guy. FAQ block covers day-rate expectations + 24-hour cover realities.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: ["plumber"],
  outcomes: ["emergency-callout", "phone-calls", "whatsapp-enquiries"],
  variant: "emergency",

  layout: {
    home: [
      {
        key: "hero.emergency_247_1",
        slotHint: "hero",
        config: {
          headline: "Burst? Leaking? Blocked? Call now.",
          subhead:
            "Local plumber. On the doorstep in 90 minutes across our coverage area. Diagnostic fee shown before we dispatch.",
          primaryCtaLabel: "Call now",
          secondaryCtaLabel: "WhatsApp us",
          responsePromiseMinutes: 90
        }
      },
      {
        key: "banner.ribbon_1",
        slotHint: "body",
        config: {
          label: "Transparent fees",
          message:
            "Diagnostic fee £X quoted before we send someone. No hidden extras.",
          ctaLabel: "See how we price"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we cover",
          items: [
            { title: "Burst + leaking pipes", body: "Isolate, patch, repair, refit." },
            { title: "Blocked drains + toilets", body: "Rods + high-pressure jet where needed." },
            { title: "No hot water / heating", body: "Diagnose + repair (gas engineer partner for boiler work)." },
            { title: "Landlord + insurance work", body: "Photo report on completion for your records." }
          ]
        }
      },
      {
        key: "hero.postcode_local_1",
        slotHint: "body",
        config: {
          heading: "Are we near you?",
          subhead: "Type your postcode — we'll tell you the response window right now."
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Planned + emergency services",
          items: [
            { title: "Leak detection + repair" },
            { title: "Burst pipe / emergency call-out" },
            { title: "Tap + mixer replacement" },
            { title: "Toilet install / repair" },
            { title: "Radiator install + swap" },
            { title: "Powerflush" },
            { title: "Unvented hot-water cylinder" },
            { title: "Outside tap + garden supply" },
            { title: "Bathroom 1st + 2nd fix" },
            { title: "Blocked drain clearance" },
            { title: "Appliance plumb-in" }
          ]
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: { heading: "Recent emergency jobs", minCards: 3 }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Fair questions before you call",
          preseed: [
            { q: "What does a call-out cost?", a: "Diagnostic fee quoted before we dispatch. On top: labour by the half-hour, materials at cost." },
            { q: "Are you a Gas Safe engineer?", a: "For boiler / gas work we partner with a Gas Safe engineer — legally required. For all non-gas plumbing we do the work directly." },
            { q: "How fast can you be here?", a: "90 minutes inside our coverage area during working hours. Out-of-hours: we tell you honestly on the call." },
            { q: "Do you invoice through insurance?", a: "Yes — photo report + invoice sent to your insurer." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: {
          heading: "Not urgent? Send a message",
          ctaLabel: "Send message"
        }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },

  score: {
    conversion: 94,
    seo: 82,
    trust: 86,
    mobile: 97,
    accessibility: 94,
    speed: 93,
    brandConsistency: 89
  },

  requiredCredentials: ["companies-house", "public-liability"],
  suggestedApps: [
    "job_diary",
    "lead_alerts",
    "quote_pipeline",
    "trade_connections",
    "faq_page",
    "online_payments"
  ],
  compliance: [
    "consumer-contracts-14day",
    "asa-superlative-guard",
    "gdpr-form-auditor"
  ],

  browserCard: {
    oneLiner: "Phone-first emergency plumber layout, ASA-safe fee disclosure baked in.",
    benefits: [
      "Sticky call ribbon — never leaves the viewport",
      "Diagnostic-fee transparency banner (ASA-compliant per Rightio + Town Force rulings)",
      "Postcode gate — visitor confirms coverage in one second",
      "WhatsApp deep-link prefilled with description + postcode"
    ],
    priceLabel: "Free for plumbers",
    estimatedBuildMinutes: 10
  }
};

blueprintRegistry.register(manifest);
export default manifest;

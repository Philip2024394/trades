// Blueprint: Roofing Emergency Callout.
//
// One of the three Lane-1 reference blueprints. Used to smoke-test the
// registry, the wizard, and the browser card render.
//
// Positioning: storm response + active-leak intent. Every section is
// picked for the phone-in-pocket homeowner scanning while water drips
// into a bucket. Sticky call ribbon (Feature #106) is the CTA layer.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "roofing-emergency-callout",
  name: "Roofing Emergency Callout",
  tagline: "24/7 storm response, active-leak repair, tarp cover.",
  description:
    "A phone-first blueprint for roofers who handle emergencies. Sticky call ribbon, 24/7 promise, coverage postcode gate, live-review proof, and a short quote form for the small % who don't call immediately. Compliance: Consumer Contracts pre-contract block (correctly excluding urgent-repair 14-day cancellation), ASA superlative guard, GDPR form auditor.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: [
    "roofer",
    "emergency-roofing",
    "flat-roofing",
    "commercial-roofing"
  ],

  outcomes: ["emergency-callout", "phone-calls", "local-coverage"],
  variant: "emergency",

  layout: {
    home: [
      {
        key: "hero.emergency_247_1",
        slotHint: "hero",
        config: {
          headline: "Storm damage? We're on the roof today.",
          subhead:
            "Same-day tarps, next-day repair. Insurance-friendly photo reports.",
          primaryCtaLabel: "Call now",
          secondaryCtaLabel: "Send a photo",
          responsePromiseMinutes: 90
        }
      },
      {
        key: "hero.trust_anchor_1",
        slotHint: "body",
        config: {
          verifiedSchemes: ["waste-carrier", "public-liability", "chas"]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How the callout works",
          items: [
            { title: "You call", body: "Answered in under 60 seconds, 24/7." },
            { title: "We assess", body: "Same-day site visit, photo report to your phone." },
            { title: "We tarp + book repair", body: "Weathertight tonight, permanent fix scheduled." }
          ]
        }
      },
      {
        key: "hero.postcode_local_1",
        slotHint: "body",
        config: {
          heading: "Enter your postcode",
          subhead: "We'll tell you if we can be there today."
        }
      },
      {
        key: "gallery.grid_1",
        slotHint: "body",
        config: {
          heading: "Recent storm jobs",
          minTiles: 6
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: {
          heading: "What homeowners said",
          minCards: 3
        }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Common questions",
          preseed: [
            { q: "Do you charge a call-out fee?", a: "We tell you the fee before we dispatch. No hidden charges." },
            { q: "Can you tarp tonight?", a: "Yes if you're within our coverage radius." },
            { q: "Do you invoice via insurance?", a: "We provide the photo report and invoice your insurer directly." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: {
          heading: "Send a photo, get a callback",
          ctaLabel: "Send it",
          consentLine: "By submitting you agree to our privacy policy."
        }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ],
    services: [
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Emergency + planned services",
          items: [
            { title: "Slipped / broken tile repair" },
            { title: "Storm damage + tarp cover" },
            { title: "Roof leak trace + patch" },
            { title: "Chimney flashing repair" },
            { title: "Gutter emergency clean" },
            { title: "Velux / rooflight repair" }
          ]
        }
      }
    ],
    coverage: [
      {
        key: "hero.postcode_local_1",
        slotHint: "hero",
        config: { heading: "Where do you need us?" }
      },
      { key: "map.embed_1", slotHint: "body" }
    ]
  },

  score: {
    conversion: 92,
    seo: 84,
    trust: 88,
    mobile: 96,
    accessibility: 95,
    speed: 91,
    brandConsistency: 90
  },

  requiredCredentials: ["waste-carrier", "chas"],
  suggestedApps: [
    "job_diary",
    "quote_pipeline",
    "lead_alerts",
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
    oneLiner: "Phone-first storm-response layout for roofers who work today.",
    benefits: [
      "Sticky call ribbon, never disappears on scroll",
      "Postcode coverage gate — visitor knows in one second",
      "Storm-mode banner auto-lights during Met Office warnings",
      "Insurance photo-report workflow baked in"
    ],
    priceLabel: "Free for roofers",
    estimatedBuildMinutes: 12
  },

  expectedModules: [
    "website",
    "verified-badges",
    "coverage-radius",
    "storm-mode",
    "lead-alerts",
    "job-diary",
    "quote-pipeline",
    "payments"
  ],
  industryIntelligence: [
    "Storm damage is a seasonal spike — Met Office warnings correlate",
    "Waste Carrier registration is required for tile + slate removal",
    "Work at Height Regs 2005 dictate scaffold / MEWP protocol",
    "Insurance photo-report is the standard evidence pack",
    "Non-destructive assessment before dispatch is an ASA-safe practice"
  ]
};

blueprintRegistry.register(manifest);
export default manifest;

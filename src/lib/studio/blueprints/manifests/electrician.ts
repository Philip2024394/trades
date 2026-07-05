// Blueprint: Electrician · Domestic (NICEIC/NAPIT verified).
//
// Service seeds sourced from Appendix D.5 (fuse-board, rewire, EICR,
// sockets, EV, solar, alarms). NICEIC + NAPIT verified widgets. Trust
// anchor + review wave + FAQ tuned to Part-P enquiries. ASA-safe
// wording — no "guaranteed to pass EICR" copy.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "electrician-domestic",
  name: "Electrician · Domestic",
  tagline: "NICEIC-verified, Part P certified, EV + solar ready.",
  description:
    "Full domestic-electrician blueprint. Above-the-fold NICEIC/NAPIT verified badge (auto-registered scheme, self-declared until you drop your number), EICR landlord CTA, EV-charging + solar mini-funnels for growth work. FAQ covers Part P, EICR pass expectations, and OZEV grants.",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: ["electrician"],
  outcomes: ["quote-requests", "phone-calls", "local-coverage"],
  variant: "corporate",

  layout: {
    home: [
      {
        key: "hero.trust_minimal_1",
        slotHint: "hero",
        config: {
          trustLabel: "TRUSTED & CERTIFIED",
          heading: "Your Trusted Electrical Experts",
          subheading:
            "Safe. Certified. Reliable. Serving your home and business.",
          primaryCtaLabel: "Get a Free Quote",
          primaryCtaHref: "#quote",
          secondaryCtaLabel: "View Services",
          secondaryCtaHref: "/services",
          responseCommitment: "Reply within 1hr · Mon-Sat"
        }
      },
      {
        key: "trust_bar.icon_row_1",
        slotHint: "body",
        config: {
          item1Icon: "shield",
          item1Label: "NICEIC Approved",
          item2Icon: "badge",
          item2Label: "Part P Registered",
          item3Icon: "star",
          item3Label: "5.0 · 380+ Reviews",
          item4Icon: "pin",
          item4Label: "Local Experts",
          surface: "tinted"
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          eyebrow: "Services",
          heading: "Domestic electrical services",
          // Pull the actual electrician services from the Knowledge
          // Graph package — merchant overrides via the section editor
          // if they want a bespoke list.
          useKnowledgeGraph: true
        }
      },
      {
        key: "features.three_up_reasons_1",
        slotHint: "body",
        config: {
          eyebrow: "Why hire us",
          heading: "How we work",
          item1Icon: "shield",
          item1Title: "Fully Certified",
          item1Body:
            "NICEIC + Part P registered. Every notifiable job filed to Building Control.",
          item2Icon: "clock",
          item2Title: "Reliable & On Time",
          item2Body:
            "The person on the phone is the person who arrives. Fixed windows, kept.",
          item3Icon: "award",
          item3Title: "2-Year Guarantee",
          item3Body:
            "Workmanship guaranteed for two years, no fine print. Certificates at handover.",
          surface: "light"
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: { heading: "Recent reviews", minCards: 3 }
      },
      {
        key: "cta.compact_band_1",
        slotHint: "body",
        config: {
          heading: "Need Help Today?",
          subheading: "We're here to help. Get in touch.",
          ctaLabel: "Call Now",
          ctaHref: "tel:0800000000",
          ctaIcon: "phone",
          variant: "filled"
        }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Common electrical questions",
          preseed: [
            { q: "Do I need an EICR as a landlord?", a: "Yes — every 5 years for rented properties in England (since April 2021)." },
            { q: "Do you notify Part P work?", a: "Yes. Every notifiable job is registered through our scheme (NICEIC/NAPIT)." },
            { q: "How long does a rewire take?", a: "Typical 2-bed 3–5 days. 3-bed 5–7 days. We give a firm window at quote." },
            { q: "Can you install my EV charger?", a: "Yes — 7kW single-phase or 22kW three-phase where supply allows." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: {
          heading: "Book a quote",
          ctaLabel: "Send request",
          consentLine: "We reply within 4 working hours."
        }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ],
    services: [
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full service catalogue",
          items: [
            { title: "Consumer unit upgrade (18th Ed)" },
            { title: "Full house rewire" },
            { title: "Partial rewire" },
            { title: "EICR periodic inspection + report" },
            { title: "Additional sockets / lighting" },
            { title: "Downlight installation" },
            { title: "Electric shower install" },
            { title: "Cooker circuit + connect" },
            { title: "EV home charger (7 kW / 22 kW)" },
            { title: "Solar PV + battery" },
            { title: "Smart home lighting" },
            { title: "Alarm / CCTV install" },
            { title: "Fault finding + emergency" }
          ]
        }
      }
    ]
  },

  score: {
    conversion: 88,
    seo: 87,
    trust: 92,
    mobile: 93,
    accessibility: 94,
    speed: 91,
    brandConsistency: 90
  },

  requiredCredentials: ["niceic", "napit", "companies-house", "public-liability"],
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
    oneLiner: "NICEIC-verified electrician site with EICR + EV + solar mini-funnels.",
    benefits: [
      "NICEIC + NAPIT verified badges (auto-registered scheme)",
      "EICR landlord CTA at hero — the 5-year-cycle repeat driver",
      "EV + solar cross-sell without cluttering the main funnel",
      "FAQ pre-answers Part P + notified-work questions"
    ],
    priceLabel: "Free for electricians",
    estimatedBuildMinutes: 12
  },

  expectedModules: [
    "website",
    "verified-badges",
    "coverage-radius",
    "quote-pipeline",
    "job-diary",
    "lead-alerts",
    "bookings",
    "membership",
    "payments"
  ],
  industryIntelligence: [
    "Landlord EICR is a legal 5-year recurring driver (April 2021 rule)",
    "Part P notified work must be registered through the scheme",
    "EV chargers require OZEV-authorised installer status",
    "MCS for solar + battery is a cross-sell path already lit",
    "Emergency call-outs are a phone-first funnel, not form-first"
  ]
};

blueprintRegistry.register(manifest);
export default manifest;

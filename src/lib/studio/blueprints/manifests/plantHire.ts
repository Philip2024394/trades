// Blueprint: Plant Hire.
//
// One of the three Lane-1 reference blueprints. Positioning: local
// plant hire with self-drive + operator options. The signature widget
// is the machine card grid with live day-rate + weekend-included
// pricing — a gap identified in the competitor analysis (no template
// on Wix/Webflow/Framer/Shopify ships this).

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,

  slug: "plant-hire-local",
  name: "Plant Hire · Local Depot",
  tagline: "Day-rate machines, operator options, next-day delivery.",
  description:
    "A hire-first blueprint. Machine cards show day-rate, week-rate, weekend-included note, and operator uplift alongside a WhatsApp booking CTA prefilled with the machine + postcode + dates. Coverage postcode gate + IPAF/PASMA verified widgets (when merchant holds them).",
  version: "1.0.0",

  publisher: { name: "Xrated Trades", verified: true },

  trades: [
    "plant-hire",
    "excavator-hire",
    "dumper-hire",
    "telehandler-hire",
    "crane-hire",
    "access-platform-hire",
    "heavy-machinery"
  ],

  outcomes: [
    "equipment-hire",
    "phone-calls",
    "whatsapp-enquiries",
    "local-coverage"
  ],
  variant: "industrial",

  layout: {
    home: [
      {
        key: "hero.plant_hire_bold_1",
        slotHint: "hero",
        config: {
          headline: "Machines on the ground. Day rates that make sense.",
          subhead:
            "Self-drive from £120/day. Operator packages from £300/day. Weekend included on 5-day hires.",
          primaryCtaLabel: "See machines",
          secondaryCtaLabel: "WhatsApp us"
        }
      },
      {
        key: "categories.grid_1",
        slotHint: "body",
        config: {
          heading: "Browse by machine",
          minTiles: 8,
          preseed: [
            { title: "Mini diggers", body: "0.8t – 3t" },
            { title: "Midi diggers", body: "5t – 8t" },
            { title: "Dumpers", body: "1t – 6t" },
            { title: "Telehandlers", body: "7m – 17m reach" },
            { title: "Rollers", body: "80kg – 5t" },
            { title: "Scissor lifts", body: "IPAF operator on request" },
            { title: "Cherry pickers", body: "IPAF operator on request" },
            { title: "Site welfare", body: "Portable cabins + toilets" }
          ]
        }
      },
      {
        key: "product_grid.classic_3col_1",
        slotHint: "body",
        config: {
          heading: "In stock right now",
          minProducts: 6,
          showDayRate: true,
          showWeekRate: true,
          showOperatorUplift: true
        }
      },
      {
        key: "hero.postcode_local_1",
        slotHint: "body",
        config: {
          heading: "Are we near you?",
          subhead: "Free delivery inside 15 miles. Set delivery quote outside."
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "How hire works",
          items: [
            { title: "Book by phone or WhatsApp", body: "Machine reserved when we've confirmed dates." },
            { title: "Delivered next day", body: "Local free delivery. Long-distance quoted." },
            { title: "5-day hire = 7 days on site", body: "Weekend included at no extra charge." },
            { title: "Off-hire when you're done", body: "Ring to release. We collect same or next day." }
          ]
        }
      },
      {
        key: "testimonials.card_grid_1",
        slotHint: "body",
        config: {
          heading: "Site foremen who hire from us",
          minCards: 3
        }
      },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Hire FAQ",
          preseed: [
            { q: "Do I need an operator?", a: "Self-drive available up to 3-tonne diggers with a valid CPCS/NPORS ticket. Larger machines require IPAF-carded operators — we can supply." },
            { q: "What insurance do I need?", a: "Public Liability £2m minimum. £5m for some LA / school sites. We'll ask on booking." },
            { q: "Do you deliver?", a: "Free within 15 miles. Outside that we quote by postcode." },
            { q: "What if it breaks down?", a: "24hr call-out. We swap or on-site repair within 4 hours." }
          ]
        }
      },
      {
        key: "contact.split_1",
        slotHint: "footer",
        config: {
          heading: "Book a machine",
          ctaLabel: "Send booking"
        }
      },
      { key: "footer.minimal_1", slotHint: "footer" }
    ],
    services: [
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full depot services",
          items: [
            { title: "Self-drive plant hire" },
            { title: "Operator packages (IPAF / CPCS)" },
            { title: "Long-term contract hire" },
            { title: "Emergency 24hr breakdown swap" },
            { title: "Site welfare + portable cabins" },
            { title: "Bulk site clearance packages" }
          ]
        }
      }
    ]
  },

  score: {
    conversion: 90,
    seo: 86,
    trust: 84,
    mobile: 94,
    accessibility: 92,
    speed: 92,
    brandConsistency: 90
  },

  requiredCredentials: ["ipaf", "pasma", "public-liability"],
  suggestedApps: [
    "job_diary",
    "quote_pipeline",
    "plant_hire",
    "lead_alerts",
    "trade_connections",
    "online_payments"
  ],
  compliance: [
    "consumer-contracts-14day",
    "asa-superlative-guard",
    "gdpr-form-auditor"
  ],

  browserCard: {
    oneLiner: "Local plant-hire depot layout with day-rate + operator machine cards.",
    benefits: [
      "Machine cards show day + week rate + weekend-included",
      "WhatsApp deep-link prefilled with machine + postcode + dates",
      "IPAF/PASMA operator badges when you hold them",
      "Postcode gate — free-delivery radius auto-calculated"
    ],
    priceLabel: "Free for plant-hire trades",
    estimatedBuildMinutes: 14
  },

  expectedModules: [
    "website",
    "verified-badges",
    "coverage-radius",
    "shop-mode",
    "material-calculators",
    "lead-alerts",
    "bookings",
    "customer-portal",
    "membership",
    "payments"
  ],
  industryIntelligence: [
    "Day + week + weekend-included is the standard hire model",
    "Operator hire (CPCS/NPORS carded) is a common upsell",
    "Delivery radius and truck size dictate free-delivery threshold",
    "IPAF PAL card is 5-year expiry — track renewals for repeat operators",
    "Damage waiver + insurance are the most-asked-before-booking questions"
  ]
};

blueprintRegistry.register(manifest);
export default manifest;

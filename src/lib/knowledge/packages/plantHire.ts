// Knowledge Package: Plant Hire.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Reference implementation proving the Domain × Package inheritance
// mechanic. Every service is drawn from PRD Appendix D + the plant-
// hire market research already grounded in the docs folder. Every
// compliance element carries a public source URL.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "plant-hire",
  name: "Plant Hire",
  emoji: "🚜",
  tagline: "Day-rate machines, operator options, next-day delivery.",
  description:
    "The trade knowledge for local + regional plant hire depots — self-drive and operator, delivery + collection, day/week/month rates, damage waiver economics, IPAF/PASMA-carded operators. Reference implementation for the Domain × Package mechanic.",
  version: "1.0.0",
  trades: [
    "plant-hire",
    "excavator-hire",
    "dumper-hire",
    "telehandler-hire",
    "crane-hire",
    "access-platform-hire",
    "heavy-machinery"
  ],

  // Which horizontal Domains this Package uses. Every one must be in
  // the KnowledgeDomainRegistry. Extensions below layer trade-specific
  // knowledge on top.
  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    // ─── Estimating extension ─────────────────────────────────
    {
      domainId: "estimating",
      notes:
        "Plant hire estimates aren't material take-offs — they're day × rate × add-ons (operator uplift, transport, damage waiver, fuel policy). The Domain's calculator shell holds; the numbers change.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            machine_id: "reference",
            hire_days: "number",
            weekend_included: "boolean",
            operator_uplift_minor: "number",
            delivery_zone: "string",
            damage_waiver_minor: "number"
          },
          reason:
            "Every hire line needs the machine, hire duration, operator uplift, delivery zone charge, and damage waiver — these are the negotiation levers of a plant-hire quote."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "day-rate-calculator",
          name: "Day-rate calculator",
          description:
            "Given machine + days + operator y/n + delivery postcode → total. Weekend-included applied on ≥5-day hires (industry norm since operators can't service out-of-hours)."
        },
        {
          capabilityId: "waste-factor",
          slug: "fuel-buffer",
          name: "Fuel buffer",
          description:
            "Merchants typically add a fuel-return-condition clause + a 5% fuel-buffer against low-return misreads."
        }
      ]
    },

    // ─── Quoting extension ────────────────────────────────────
    {
      domainId: "quoting",
      notes:
        "Plant-hire quotes are booking-flavoured — a Quote turning into a Hire commits a machine on the depot calendar. Cancellation windows + damage-waiver clauses are trade-specific.",
      capabilities: [
        {
          capabilityId: "quote-accept",
          slug: "reservation-accept",
          name: "Reservation on accept",
          description:
            "Accepting a plant-hire quote reserves the physical machine on the depot calendar for the hire window — atomic with the Deal → Won transition."
        }
      ],
      aiRetrieval: [
        {
          domainId: "quoting",
          id: "damage-waiver-clause",
          description:
            "Retrieve standard damage-waiver clause language + typical excess bands for the machine class.",
          keywords: ["damage waiver", "excess", "collision damage"]
        },
        {
          domainId: "quoting",
          id: "off-hire-terms",
          description:
            "Retrieve standard off-hire process copy: 'ring by 3pm for same-day collection, otherwise next-day off-hire'.",
          keywords: ["off-hire", "collection", "end-of-hire"]
        }
      ]
    },

    // ─── Compliance extension ─────────────────────────────────
    {
      domainId: "compliance",
      notes:
        "IPAF + PASMA are contractually required by most main contractors for operator-supplied hires. Not statutory, but you won't win commercial work without them.",
      compliance: [
        {
          id: "puwer-1998",
          name: "Provision and Use of Work Equipment Regulations 1998",
          regulator: "HSE",
          source:
            "https://www.legislation.gov.uk/uksi/1998/2306/contents/made"
        },
        {
          id: "loler-1998",
          name: "Lifting Operations and Lifting Equipment Regulations 1998",
          regulator: "HSE",
          source:
            "https://www.legislation.gov.uk/uksi/1998/2307/contents/made"
        },
        {
          id: "ipaf-pal",
          name: "IPAF PAL Card — MEWP operator competence",
          regulator: "IPAF",
          source: "https://www.ipaf.org/en/pal-card-check",
          credentialScheme: "ipaf"
        },
        {
          id: "pasma-card",
          name: "PASMA Card — mobile access tower competence",
          regulator: "PASMA",
          source: "https://pasma.co.uk/pasma-cardholder-check/",
          credentialScheme: "pasma"
        }
      ],
      aiRetrieval: [
        {
          domainId: "compliance",
          id: "operator-card-expiry",
          description:
            "IPAF PAL Card is valid 5 years. Retrieve renewal windows so the platform can schedule reminders 60 days before expiry.",
          keywords: ["ipaf", "renewal", "expiry"]
        }
      ]
    },

    // ─── CRM extension ────────────────────────────────────────
    {
      domainId: "crm",
      notes:
        "Customer types split cleanly: main-contractor account (repeat, credit-line), sub-contractor account (weekly hire), self-build (one-off), utility (regular short-term). Deal fields extended with machine + dates.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            machine_id: "reference",
            hire_start_at: "date",
            hire_end_at: "date",
            with_operator: "boolean"
          },
          reason:
            "A plant-hire Deal is inseparable from the machine + hire window. Depot calendars need this in the Deal shape, not on a side entity."
        }
      ],
      integrations: [
        {
          id: "dvsa-mot-lookup",
          name: "DVSA MOT History",
          description:
            "Auto-verify hired machines' MOT status for road-legal delivery vehicles. Free public API."
        }
      ]
    }
  ],

  // ─── Trade knowledge (evidence-grounded) ────────────────────
  services: [
    {
      slug: "mini-digger-hire",
      name: "Mini digger hire (0.8t–3t)",
      frequency: "core",
      pricingModel: "day-rate",
      description:
        "Domestic + light-commercial excavation. Day / week / weekend-included rates."
    },
    {
      slug: "midi-digger-hire",
      name: "Midi digger hire (5t–8t)",
      frequency: "core",
      pricingModel: "day-rate",
      description:
        "Groundworks + landscaping. Larger reach + payload; low-loader delivery required."
    },
    {
      slug: "dumper-hire",
      name: "Dumper hire (1t–6t)",
      frequency: "core",
      pricingModel: "day-rate",
      description: "Site muck-shifting. High-tip + swivel-tip variants."
    },
    {
      slug: "telehandler-hire",
      name: "Telehandler hire",
      frequency: "common",
      pricingModel: "day-rate",
      description: "7m–17m reach. Materials handling on tight sites."
    },
    {
      slug: "roller-hire",
      name: "Roller hire (80kg–5t)",
      frequency: "common",
      pricingModel: "day-rate",
      description:
        "Sub-base + tarmac compaction. Pedestrian to ride-on."
    },
    {
      slug: "scissor-lift-hire",
      name: "Scissor lift hire",
      frequency: "common",
      pricingModel: "day-rate",
      requiresCompliance: ["ipaf-pal"],
      description:
        "Working at height. IPAF-carded operator required for hires with operator supply."
    },
    {
      slug: "cherry-picker-hire",
      name: "Cherry picker hire",
      frequency: "common",
      pricingModel: "day-rate",
      requiresCompliance: ["ipaf-pal"],
      description:
        "Articulating boom lifts to 25m+. IPAF-carded operator required."
    },
    {
      slug: "site-welfare-hire",
      name: "Site welfare + portable cabins",
      frequency: "specialism",
      pricingModel: "quote-required",
      description:
        "Mobile welfare units + portable toilets — often bundled with plant hire for main-contractor sites."
    },
    {
      slug: "operator-hire",
      name: "Machine + operator hire",
      frequency: "common",
      pricingModel: "day-rate",
      requiresCompliance: ["ipaf-pal", "pasma-card"],
      description:
        "Man + machine day-rate: £300–£500/day range depending on machine class."
    },
    {
      slug: "long-term-contract-hire",
      name: "Long-term contract hire",
      frequency: "specialism",
      pricingModel: "quote-required",
      description:
        "3+ month site placements at monthly rates. Includes servicing + swap-outs."
    }
  ],

  customerTypes: [
    {
      slug: "main-contractor",
      name: "Main contractor",
      description:
        "Repeat B2B account with credit line. Values same-day delivery + reliability over price."
    },
    {
      slug: "sub-contractor",
      name: "Sub-contractor",
      description:
        "Weekly hires. Values weekend-included pricing + no drop-off fees."
    },
    {
      slug: "self-builder",
      name: "Self-builder",
      description:
        "One-off homeowner. Needs machine + operator + delivery all costed clearly upfront."
    },
    {
      slug: "utility-contractor",
      name: "Utility contractor",
      description:
        "Short-notice hires for reactive network work. Values 24hr breakdown swap."
    }
  ],

  workflow: [
    {
      slug: "enquiry",
      name: "Enquiry",
      description:
        "Customer phones or WhatsApps with machine + dates + postcode.",
      poweredByCapability: "lead-capture"
    },
    {
      slug: "quote-with-availability",
      name: "Quote with availability",
      description:
        "Rate quoted + machine reserved on depot calendar pending accept.",
      poweredByCapability: "day-rate-calculator"
    },
    {
      slug: "delivery",
      name: "Delivery",
      description:
        "Low-loader delivery + on-site handover with damage-check paperwork."
    },
    {
      slug: "off-hire",
      name: "Off-hire",
      description:
        "Customer rings by 3pm for same-day collection or next-day. Damage inspection at return.",
      poweredByCapability: "reservation-accept"
    },
    {
      slug: "invoice-and-close",
      name: "Invoice + close",
      description:
        "Invoice sent, damage claim (if any) raised separately, deposit returned."
    }
  ],

  commonFaqs: [
    {
      question: "Do I need an operator?",
      answer:
        "Self-drive available up to 3-tonne diggers with a valid CPCS/NPORS ticket. Larger machines require IPAF-carded operators — we can supply."
    },
    {
      question: "What insurance do I need?",
      answer:
        "Public Liability £2m minimum. £5m for some LA / school sites. We'll ask on booking."
    },
    {
      question: "Do you deliver?",
      answer:
        "Free within 15 miles. Outside that we quote by postcode. Same-day delivery on stock machines."
    },
    {
      question: "What if it breaks down?",
      answer:
        "24hr call-out. We swap or on-site repair within 4 hours during working hours."
    },
    {
      question: "Weekend hires?",
      answer:
        "Standard 5-day hires include the weekend at no extra charge — industry norm, no small-print."
    }
  ],

  recommendedModules: [
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
  canonicalBlueprint: "plant-hire-local",

  // Migrated verbatim from BlueprintManifest.industryIntelligence on
  // plant-hire-local (R4). Same source of truth, cleaner home. The
  // Blueprint's copy stays for now — adapters resolve to the Package
  // when a Package is present.
  industryIntelligence: [
    "Day + week + weekend-included is the standard hire model",
    "Operator hire (CPCS/NPORS carded) is a common upsell",
    "Delivery radius and truck size dictate free-delivery threshold",
    "IPAF PAL card is 5-year expiry — track renewals for repeat operators",
    "Damage waiver + insurance are the most-asked-before-booking questions"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

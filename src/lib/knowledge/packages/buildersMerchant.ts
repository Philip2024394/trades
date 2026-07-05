// Knowledge Package: Builders Merchant.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Trade-first counter merchant. Distinct from a retail-only shop by
// its dual retail/trade pricing, credit accounts (30-day terms
// typical), cut-to-size + machining services, and free-delivery
// radius. Grounded in PRD Appendix D.2 + Merchant Research §3.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "builders-merchant",
  name: "Builders Merchant",
  emoji: "🧱",
  tagline: "Trade-first counter with retail + credit.",
  description:
    "Full-line builders / timber / tool merchant with trade-account pricing, credit lines, cut-to-size, and van delivery. Reference implementation for the merchant tier of the Knowledge Graph.",
  version: "1.0.0",
  trades: [
    "building-merchant",
    "builders-supplies",
    "timber-merchant",
    "tool-merchant",
    "fixings-supplier",
    "aggregate-supplier",
    "roofing-supplier",
    "plumbing-merchant",
    "electrical-wholesaler"
  ],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    // Estimating — dual pricing + minimum order + cut-to-size
    {
      domainId: "estimating",
      notes:
        "Merchants estimate two prices simultaneously: retail (walk-in) and trade (signed-in). Cut-to-size adds a machining charge line; free delivery threshold subtracts.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            retail_price_minor: "number",
            trade_price_minor: "number",
            cut_charge_minor: "number",
            length_mm: "number",
            width_mm: "number"
          },
          reason:
            "Merchant lines carry BOTH prices so a signed-in trade account instantly sees their price. Cut charges + dimensions carry so the estimate re-quotes if a cut is added."
        }
      ],
      capabilities: [
        {
          capabilityId: "pricing-rule",
          slug: "dual-retail-trade",
          name: "Dual retail/trade pricing",
          description:
            "Guest sees retail; signed-in trade account sees their tier. Explicit — no bait-and-switch. Matches Havnwright's 10–30% typical trade discount range."
        },
        {
          capabilityId: "material-calculator",
          slug: "cut-to-size-quoter",
          name: "Cut-to-size quoter",
          description:
            "Adds machining charge line based on cut count + material class. Trade accounts often get zero-fee cuts as a repeat-buyer incentive."
        }
      ]
    },
    // CRM — Company extended with credit line + trade-account status
    {
      domainId: "crm",
      notes:
        "Merchant Contacts are almost always tied to a Company (trade account). Credit_limit + payment_terms live on Company, not Contact.",
      entityExtensions: [
        {
          entityId: "company",
          additionalFields: {
            trade_account_status: "enum",
            credit_score: "number",
            last_statement_at: "date",
            preferred_delivery_zone: "string"
          },
          reason:
            "Trade-account status (pending / approved / suspended) gates pricing visibility. Credit score seeded from CreditSafe / Experian on approval."
        }
      ],
      capabilities: [
        {
          capabilityId: "deal-pipeline",
          slug: "trade-account-application",
          name: "Trade account application",
          description:
            "Structured Deal-like flow for new trade accounts — application → references → credit check → approval. Matches typical 24-48h approval window."
        }
      ]
    },
    // Compliance — Companies House + VAT are the norm; add ASA trade discount claim
    {
      domainId: "compliance",
      notes:
        "Merchants advertise 'trade prices' — must be substantiated. CAP 3.18 applies to headline pricing including VAT for consumer-facing ads.",
      compliance: [
        {
          id: "consumer-rights-act-2015-goods",
          name: "Consumer Rights Act 2015 — quality of goods",
          regulator: "UK Parliament",
          source:
            "https://www.legislation.gov.uk/ukpga/2015/15/part/1/chapter/2/enacted"
        }
      ]
    }
  ],

  services: [
    {
      slug: "trade-counter",
      name: "Trade counter",
      frequency: "core",
      pricingModel: "fixed-price",
      description:
        "Walk-in trade counter — signed-in accounts get their tier; guests see retail. Open 7am typical for merchants targeting early-start trades."
    },
    {
      slug: "trade-accounts",
      name: "Trade accounts (30-day credit)",
      frequency: "core",
      pricingModel: "quote-required",
      description:
        "30-day terms with tier pricing. Typical £1,000–£15,000 starter limits, reviewed at 3 months."
    },
    {
      slug: "click-and-collect",
      name: "Click & collect",
      frequency: "core",
      pricingModel: "fixed-price",
      description:
        "Online order → same-day collection from the yard during trade hours."
    },
    {
      slug: "van-delivery",
      name: "Van delivery",
      frequency: "core",
      pricingModel: "fixed-price",
      description:
        "Free within 5 miles over £75–£100 typical. Long-distance quoted."
    },
    {
      slug: "hiab-delivery",
      name: "Hiab crane delivery",
      frequency: "common",
      pricingModel: "quote-required",
      description:
        "Bulk-bag + palletised offload — driveway or garden drop."
    },
    {
      slug: "cut-to-size",
      name: "Cut-to-size + machining",
      frequency: "common",
      pricingModel: "fixed-price",
      description:
        "Length + width cuts, planing, moulding. Common differentiator vs online-only competitors."
    },
    {
      slug: "bulk-order-quote",
      name: "Bulk order quotation",
      frequency: "common",
      pricingModel: "quote-required",
      description:
        "Trade customer uploads a CSV or spec sheet — merchant quotes back same-day."
    },
    {
      slug: "returns-and-exchanges",
      name: "Returns & exchanges",
      frequency: "core",
      pricingModel: "fixed-price",
      description:
        "Standard 30-day return policy on unused stock. Trade returns often processed as account credit."
    }
  ],

  customerTypes: [
    {
      slug: "contractor-account",
      name: "Contractor trade account",
      description:
        "Small builder / groundworker / roofer with 30-day credit. Repeat weekly buyer."
    },
    {
      slug: "self-builder",
      name: "Self-builder",
      description:
        "One-off homeowner project. Cash / card, walk-in or delivery. Values price transparency."
    },
    {
      slug: "large-contractor",
      name: "Large contractor account",
      description:
        "Regional builder / civils firm with £5k+ credit line. Site-drop delivery, bulk orders."
    },
    {
      slug: "letting-agent",
      name: "Letting agent / property manager",
      description:
        "Regular small-order maintenance buyer. Values consolidated monthly statement."
    }
  ],

  workflow: [
    {
      slug: "trade-account-application",
      name: "Trade account application",
      description:
        "New buyer submits application + references + trading history. 24–48h approval.",
      poweredByCapability: "trade-account-application"
    },
    {
      slug: "counter-or-online-order",
      name: "Counter or online order",
      description:
        "Signed-in trade account sees their prices; guest sees retail. Cut-to-size and delivery options at add-to-cart."
    },
    {
      slug: "fulfilment",
      name: "Fulfilment",
      description:
        "Click-and-collect: pick + ready notification. Van delivery: schedule + goods-out."
    },
    {
      slug: "monthly-statement",
      name: "Monthly statement + payment",
      description:
        "Consolidated statement mid-month; 30-day payment window. Late accounts placed on stop."
    }
  ],

  commonFaqs: [
    {
      question: "How do I open a trade account?",
      answer:
        "12 months trading history + 2 references. 24–48 hour turnaround. Credit check via CreditSafe / Experian."
    },
    {
      question: "What credit limits do you offer?",
      answer:
        "£1,000 – £15,000 starter limits. Reviewed after 3 months' trading with us."
    },
    {
      question: "Do you deliver on Saturday?",
      answer:
        "Yes to trade accounts — book by Friday 3pm. Retail Saturday delivery quoted by postcode."
    },
    {
      question: "Can I click-and-collect?",
      answer:
        "Yes — order online, collect same-day from the yard during trade hours."
    },
    {
      question: "What's the cut-to-size fee?",
      answer:
        "Retail: per-cut fee. Trade accounts: zero-fee cuts as a repeat-buyer benefit."
    }
  ],

  recommendedModules: [
    "website",
    "verified-badges",
    "shop-mode",
    "wholesale-mode",
    "material-calculators",
    "downloads",
    "trade-connections",
    "stock",
    "customer-portal",
    "delivery-tracking",
    "payments"
  ],
  canonicalBlueprint: "builders-merchant-full",

  industryIntelligence: [
    "Trade accounts + credit lines are the primary revenue driver",
    "Free delivery inside a radius is the local buyer's tipping point",
    "Cut-to-size + machining service is a common competitive lever",
    "Companies House + VAT are foot-of-page mandatory for B2B trust",
    "Bulk-order CSV upload is a repeat-buyer retention tool"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

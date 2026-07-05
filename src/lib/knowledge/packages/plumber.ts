// Knowledge Package: Plumber (non-gas domestic).
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Domestic non-gas plumber. Covers leaks + emergency callouts +
// bathroom 1st/2nd fix + unvented cylinder work (G3 ticket). Gas
// engineering is a separate Package — plumbers often partner with a
// Gas Safe engineer rather than dual-badge. Grounded in Appendix D.3.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "plumber",
  name: "Plumber",
  emoji: "🚿",
  tagline: "Leaks, bathrooms, unvented cylinders. 24-hour emergency.",
  description:
    "Domestic non-gas plumber. Leak detection + repair, tap/toilet/radiator work, unvented cylinder (G3), bathroom 1st + 2nd fix, blocked drains. Emergency call-outs are the phone-first funnel.",
  version: "1.0.0",
  trades: ["plumber"],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Plumbing estimates split into break/fix (day-rate + parts) and installation (per-fixture fixed). Emergency call-out fee is a discrete line — never bundled to avoid ASA misleading claims.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            callout_fee_minor: "number",
            fixture_type: "string",
            emergency: "boolean"
          },
          reason:
            "Callout fee lives on the line for ASA-safe disclosure. Fixture type drives typical labour banding."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Unvented hot-water cylinders (G3) require notified installer competence per Building Regs. Water fittings must meet WRAS approval. Plumbers advertising gas work without Gas Safe registration is illegal.",
      compliance: [
        {
          id: "water-supply-regulations-1999",
          name: "Water Supply (Water Fittings) Regulations 1999",
          regulator: "Defra / Ofwat",
          source:
            "https://www.legislation.gov.uk/uksi/1999/1148/contents/made"
        },
        {
          id: "building-regs-part-g",
          name: "Building Regulations Part G — Sanitation, hot water safety and water efficiency (includes G3 unvented cylinders)",
          regulator: "MHCLG",
          source:
            "https://www.gov.uk/government/publications/sanitation-hot-water-safety-and-water-efficiency-approved-document-g"
        },
        {
          id: "wras-approved-products",
          name: "WRAS-approved products — water fittings compliance",
          regulator: "WRAS",
          source: "https://www.wras.co.uk/"
        }
      ],
      aiRetrieval: [
        {
          domainId: "compliance",
          id: "callout-fee-disclosure",
          description:
            "Retrieve the ASA-safe pattern for disclosing call-out fees — must be in the same visual field as the offer, never hidden.",
          keywords: ["callout", "fee", "asa", "disclosure"]
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Emergency customers convert quickly — phone-first with a clear callout fee wins. Track callout-to-completion time as a KPI. Landlord/agent accounts drive repeat volume.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            emergency: "boolean",
            callout_fee_minor: "number",
            arrived_at: "date"
          },
          reason:
            "Emergency flag + arrival time drive response-time KPIs and let the merchant compare their real ETAs to advertised ones."
        }
      ]
    }
  ],

  services: [
    { slug: "leak-detection-repair", name: "Leak detection + repair", frequency: "core", pricingModel: "day-rate", description: "Trace visible/hidden leaks. Emergency + planned response." },
    { slug: "burst-emergency", name: "Burst pipe + emergency callout", frequency: "core", pricingModel: "fixed-price", description: "24/7 callout. Fee disclosed upfront. Isolate + repair + refit." },
    { slug: "tap-mixer-replacement", name: "Tap / mixer replacement", frequency: "core", pricingModel: "fixed-price", description: "Basin, bath, kitchen tap swap. Includes stop valve check." },
    { slug: "toilet-install-repair", name: "Toilet install / repair", frequency: "core", pricingModel: "fixed-price", description: "New pan + cistern or fault fix." },
    { slug: "radiator-swap", name: "Radiator install / swap", frequency: "core", pricingModel: "fixed-price", description: "New rad + valves + flush." },
    { slug: "unvented-cylinder", name: "Unvented hot-water cylinder", frequency: "specialism", pricingModel: "quote-required", description: "G3-ticket install of pressurised cylinder. Building Regs notification via scheme." },
    { slug: "outside-tap", name: "Outside tap + garden supply", frequency: "common", pricingModel: "fixed-price", description: "New external tap + isolation valve." },
    { slug: "bathroom-1st-2nd-fix", name: "Bathroom 1st + 2nd fix", frequency: "core", pricingModel: "quote-required", description: "Pipework before + after plastering." },
    { slug: "blocked-drain", name: "Blocked drain / waste clearance", frequency: "common", pricingModel: "fixed-price", description: "Sinks, WCs, waste stacks. Rods + jet if needed." },
    { slug: "appliance-plumb-in", name: "Appliance plumb-in", frequency: "common", pricingModel: "fixed-price", description: "Dishwasher, washing machine, waste + water supply." }
  ],

  customerTypes: [
    { slug: "homeowner-planned", name: "Homeowner (planned)", description: "Bathroom refits, replacements. Quote-comparison shopper." },
    { slug: "homeowner-emergency", name: "Homeowner (emergency)", description: "Burst / leak. Wants a person on the phone within a ring." },
    { slug: "letting-agent", name: "Letting agent / landlord", description: "Repeat maintenance account. Values same-day response + statement invoicing." },
    { slug: "insurance-referral", name: "Insurance referral", description: "Claim-work referred by home insurer. Values photo report + accepted rate cards." }
  ],

  workflow: [
    { slug: "call-or-form", name: "Call (emergency) or form (planned)", description: "Emergency: pick up on the ring. Planned: form with photos + timescale.", poweredByCapability: "lead-capture" },
    { slug: "callout-fee-quote", name: "Callout fee + estimated time quoted", description: "Fee disclosed before dispatch. ASA-safe — never bundled." },
    { slug: "attend-and-fix", name: "Attend + diagnose + fix", description: "Time-per-half-hour after callout fee. Parts at cost." },
    { slug: "invoice-and-photo-report", name: "Invoice + photo report", description: "Photo evidence of leak + fix. Insurance-invoiced where applicable." }
  ],

  commonFaqs: [
    { question: "What does a call-out cost?", answer: "Callout fee quoted before we dispatch. Labour by the half-hour, materials at cost. No hidden extras." },
    { question: "Are you Gas Safe?", answer: "For boiler / gas work we partner with a Gas Safe engineer — legally required. Non-gas plumbing we do directly." },
    { question: "How fast can you get here?", answer: "90 minutes inside our coverage area during working hours. Out-of-hours: we tell you honestly on the call." },
    { question: "Do you invoice insurance?", answer: "Yes — photo report + invoice to your insurer. Bring your reference number." },
    { question: "G3 unvented cylinder?", answer: "Yes — we hold the G3 ticket for unvented cylinder work. Building Regs notification via our scheme." }
  ],

  recommendedModules: ["website", "verified-badges", "coverage-radius", "storm-mode", "lead-alerts", "quote-pipeline", "bookings", "payments"],
  canonicalBlueprint: "plumber-emergency",

  industryIntelligence: [
    "Emergency callouts are phone-first — form-first loses the customer",
    "Callout fee disclosure is ASA-mandatory (Rightio + Town Force 2020 rulings)",
    "G3 ticket is required for unvented cylinders — separate from Gas Safe",
    "Advertising Gas Safe work without registration is illegal (Gas Safety Regs 1998)",
    "Letting agents drive the highest-repeat non-emergency volume"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

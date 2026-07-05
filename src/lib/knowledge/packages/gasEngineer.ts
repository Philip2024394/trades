// Knowledge Package: Gas Engineer.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Domestic gas + heating engineer. Gas Safe registration is
// STATUTORILY mandatory to advertise or perform gas work under the
// Gas Safety (Installation and Use) Regulations 1998. CP12 landlord
// annual cycle drives significant recurring revenue. Increasingly
// cross-training MCS heat-pump for the BUS £7,500 grant path.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "gas-engineer",
  name: "Gas Engineer",
  emoji: "🔥",
  tagline: "Boilers, servicing, breakdowns. Gas Safe registered.",
  description:
    "Domestic gas + heating engineer. Boiler installs, annual services, breakdown callouts, CP12 landlord certificates. Cross-sell path into MCS heat-pump installation.",
  version: "1.0.0",
  trades: ["gas-engineer", "heating-engineer"],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Boiler quotes are (boiler + flue + fittings) + labour + system commission. Boiler tier + house size drive the model. Powerflush is often mis-estimated — a real trade-specific line.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            boiler_kw: "number",
            fuel_type: "enum",
            radiator_count: "number",
            powerflush_included: "boolean"
          },
          reason:
            "Boiler kW + fuel type gate the appliance choice. Radiator count drives powerflush pricing (per-rad model)."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Gas Safety Regs 1998 make Gas Safe registration mandatory to advertise + perform gas work. Advertising gas work without registration is illegal (Reg 3). CP12 is the annual landlord safety certificate.",
      compliance: [
        {
          id: "gas-safe-mandatory",
          name: "Gas Safety (Installation and Use) Regulations 1998, Reg 3 — competent person",
          regulator: "HSE",
          source:
            "https://www.legislation.gov.uk/uksi/1998/2451/regulation/3/made",
          credentialScheme: "gas-safe"
        },
        {
          id: "landlord-gas-safety-record",
          name: "Landlord Gas Safety Record (CP12) — annual",
          regulator: "HSE",
          source:
            "https://www.hse.gov.uk/gas/landlords/gas-safety-check.htm"
        },
        {
          id: "mcs-bus-grant",
          name: "MCS certification — required for Boiler Upgrade Scheme £7,500 grant",
          regulator: "DESNZ + MCS",
          source: "https://mcscertified.com/installers/becoming-certified/"
        }
      ],
      aiRetrieval: [
        {
          domainId: "compliance",
          id: "gas-safe-advertising",
          description:
            "Retrieve mandatory statutory advertising language — Gas Safe registration number MUST appear on all gas-work advertising.",
          keywords: ["gas safe", "advertising", "mandatory"]
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Landlord accounts are the highest-value recurring segment — CP12 is annual (vs EICR 5-year for electricians). Contact.role extended.",
      entityExtensions: [
        {
          entityId: "contact",
          additionalFields: {
            cp12_last_test_date: "date",
            cp12_next_due_date: "date",
            boiler_install_year: "number",
            annual_service_due_month: "number"
          },
          reason:
            "CP12 renewal is annual; boiler service is annual too. Two recurring cycles per landlord contact — automate reminders."
        }
      ],
      aiRetrieval: [
        {
          domainId: "crm",
          id: "cp12-annual-reminder",
          description:
            "Retrieve CP12 annual reminder cadence + typical Direct Debit membership pricing.",
          keywords: ["cp12", "annual", "reminder", "landlord"]
        }
      ]
    }
  ],

  services: [
    { slug: "boiler-install-combi", name: "Boiler install (combi)", frequency: "core", pricingModel: "quote-required", description: "Swap or new combi. Warranty registered on completion." },
    { slug: "boiler-install-system", name: "Boiler install (system + regular)", frequency: "core", pricingModel: "quote-required", description: "System + regular with hot-water cylinder." },
    { slug: "boiler-service", name: "Annual boiler service", frequency: "core", pricingModel: "fixed-price", description: "Annual maintenance + condition report. £75–£120 typical." },
    { slug: "boiler-breakdown", name: "Boiler breakdown / repair", frequency: "core", pricingModel: "day-rate", description: "Same-day where possible. Diagnostic fee + parts + labour." },
    { slug: "cp12-landlord", name: "Landlord gas safety certificate (CP12)", frequency: "core", pricingModel: "fixed-price", description: "Annual inspection + certificate. Reminder issued 30 days before expiry." },
    { slug: "cooker-hob-install", name: "Cooker / hob install", frequency: "common", pricingModel: "fixed-price", description: "Gas appliance connect + test + certificate." },
    { slug: "gas-leak-investigation", name: "Gas leak investigation", frequency: "core", pricingModel: "day-rate", description: "Trace + isolate. Emergency out-of-hours callouts." },
    { slug: "central-heating-install", name: "Central heating install", frequency: "common", pricingModel: "quote-required", description: "Full CH: boiler + pipework + radiators + controls." },
    { slug: "smart-controls", name: "Smart / TRV controls", frequency: "common", pricingModel: "fixed-price", description: "Nest / Hive / Honeywell + TRVs. Gas parts require Gas Safe." },
    { slug: "powerflush", name: "Powerflush", frequency: "common", pricingModel: "fixed-price", description: "System descale + sludge removal. Per-radiator pricing model." },
    { slug: "heat-pump-install", name: "Heat pump install (MCS)", frequency: "specialism", pricingModel: "quote-required", description: "ASHP + GSHP. MCS certified for BUS £7,500 grant eligibility." }
  ],

  customerTypes: [
    { slug: "homeowner", name: "Homeowner", description: "One-off installs + annual service. Multi-quote for larger jobs." },
    { slug: "landlord-cp12", name: "Landlord (annual CP12)", description: "Annual CP12 — highest-recurring revenue segment. Values reminder + statement invoicing." },
    { slug: "letting-agent", name: "Letting agent", description: "Multi-property CP12 + boiler service. Values web-portal + bulk scheduling." },
    { slug: "commercial-light", name: "Commercial (light)", description: "Small commercial gas + heating. Longer payment terms typical." }
  ],

  workflow: [
    { slug: "enquiry", name: "Enquiry / breakdown call", description: "Homeowner submits form; landlord + emergency call direct.", poweredByCapability: "lead-capture" },
    { slug: "diagnose-or-quote", name: "Diagnose (breakdown) or quote (planned)", description: "Breakdown: attend + diagnose + fix. Planned: survey + full quote with warranty registration." },
    { slug: "work", name: "Work done", description: "Install / service / certificate. Building Control notification via Gas Safe scheme if applicable." },
    { slug: "certificate-and-warranty", name: "Certificate + warranty registration", description: "CP12 / Gas Safety Notice + boiler warranty registered on your behalf." },
    { slug: "annual-reminder", name: "Annual reminder", description: "Booked 30 days before annual expiry — service or CP12 re-inspection." }
  ],

  commonFaqs: [
    { question: "How quickly can you attend a breakdown?", answer: "Same-day within our coverage area during working hours. Out-of-hours honestly quoted on the call." },
    { question: "Do you offer manufacturer warranties?", answer: "Yes — 7–12 year manufacturer warranties available on select brands where we're an accredited installer." },
    { question: "Do you fit heat pumps?", answer: "Yes — MCS certified for air-source. BUS £7,500 grant application handled inline." },
    { question: "What's included in a landlord CP12?", answer: "Full gas safety inspection + certificate valid 12 months. Reminder 30 days before it expires." },
    { question: "Are you Gas Safe registered?", answer: "Yes — registration number displayed on all advertising as required by the Gas Safety Regs 1998." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "lead-alerts", "bookings", "membership", "payments"],
  canonicalBlueprint: "gas-engineer-heating",

  industryIntelligence: [
    "CP12 landlord certificate is an annual recurring driver — biggest repeat-revenue segment",
    "Gas Safe registration is statutorily mandatory to advertise gas work (Gas Safety Regs 1998 Reg 3)",
    "Boiler manufacturer accredited-installer status unlocks 7–12 year warranties",
    "MCS certification is the BUS £7,500 grant path for heat-pump cross-sell",
    "Emergency call-outs are a phone-first funnel — homeowners without heat won't fill forms"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

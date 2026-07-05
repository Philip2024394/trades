// Knowledge Package: Electrician (Domestic).
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Domestic electrical contractor with Part P notified work,
// NICEIC/NAPIT scheme membership, EICR landlord recurring cycles, and
// growing EV / solar cross-sell. Grounded in PRD Appendix D.5 +
// existing blueprint.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "electrician",
  name: "Electrician",
  emoji: "⚡",
  tagline: "Domestic + light commercial. Certified, notified, insured.",
  description:
    "Domestic electrician doing rewires, EICRs, consumer units, additions, fault-finding, EV chargers, and increasingly MCS-certified solar + battery. Every notifiable job is registered through NICEIC / NAPIT / STROMA.",
  version: "1.0.0",
  trades: ["electrician"],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Electrical estimates are labour + parts + certification fee. Consumer unit + rewire jobs have well-known typical ranges; EICR is fixed-fee per property size.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            notifiable: "boolean",
            certification_fee_minor: "number",
            property_bedrooms: "number"
          },
          reason:
            "Notifiable flag drives Part P scheme submission fee inclusion. Property size drives EICR fixed-fee band."
        }
      ],
      capabilities: [
        {
          capabilityId: "labour-calculator",
          slug: "eicr-band-calculator",
          name: "EICR fixed-fee band",
          description:
            "1-bed £120–£150, 2-bed £150–£200, 3-bed £180–£220, 4-bed £220–£280 typical bands. Landlord repeats every 5 years (April 2021 rule)."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Part P is the mandatory legal framework for notifiable work in England + Wales. NICEIC / NAPIT / STROMA are the three current Competent Person Schemes.",
      compliance: [
        {
          id: "part-p-notification",
          name: "Building Regulations Part P — electrical safety in dwellings",
          regulator: "MHCLG",
          source:
            "https://www.gov.uk/government/publications/electrical-safety-approved-document-p"
        },
        {
          id: "eicr-landlord-2020",
          name: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020",
          regulator: "MHCLG",
          source: "https://www.legislation.gov.uk/uksi/2020/312/contents/made"
        },
        {
          id: "bs7671-18th",
          name: "BS 7671 (IET Wiring Regulations, 18th Edition)",
          regulator: "IET / BSI",
          source: "https://electrical.theiet.org/bs-7671/"
        },
        {
          id: "ozev-installer-scheme",
          name: "OZEV Authorised Installer Scheme — EV chargers",
          regulator: "OZEV (DfT)",
          source:
            "https://www.gov.uk/government/collections/electric-vehicle-chargepoint-grants"
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Landlord customers are a recurring 5-year cycle (EICR). Contact.role extended with 'landlord' + 'letting-agent'.",
      entityExtensions: [
        {
          entityId: "contact",
          additionalFields: {
            eicr_last_test_date: "date",
            eicr_next_due_date: "date",
            managed_property_count: "number"
          },
          reason:
            "Storing EICR expiry per landlord lets us schedule the 5-year reminder automatically — repeat revenue on autopilot."
        }
      ],
      aiRetrieval: [
        {
          domainId: "crm",
          id: "eicr-cycle-reminder",
          description:
            "Look up EICR renewal window (60 days before expiry) to schedule landlord reminders.",
          keywords: ["eicr", "renewal", "landlord", "5 year"]
        }
      ]
    }
  ],

  services: [
    { slug: "consumer-unit-upgrade", name: "Consumer unit / fuse-board upgrade", frequency: "core", pricingModel: "fixed-price", description: "18th Ed RCD/SPD-protected board. Part P notified." },
    { slug: "full-rewire", name: "Full or partial rewire", frequency: "core", pricingModel: "quote-required", description: "Typical 3-bed 5–7 days on the tools. Part P notified." },
    { slug: "eicr-inspection", name: "EICR periodic inspection + report", frequency: "core", pricingModel: "fixed-price", description: "Landlord mandatory every 5 years (April 2021 rule for private-rented in England)." },
    { slug: "sockets-and-lighting", name: "Additional sockets + lighting circuits", frequency: "core", pricingModel: "fixed-price", description: "Add or replace fixtures. Part P if new circuit." },
    { slug: "fault-finding", name: "Fault finding + emergency call-out", frequency: "core", pricingModel: "day-rate", description: "Diagnose tripping / dead circuits. Emergency out-of-hours available." },
    { slug: "ev-charger-install", name: "EV charger install (7 kW)", frequency: "common", pricingModel: "fixed-price", description: "OZEV-authorised installer. £350–£500 grant may apply for eligible households." },
    { slug: "solar-pv-install", name: "Solar PV + battery install", frequency: "specialism", pricingModel: "quote-required", description: "MCS certified required for BUS / SEG eligibility." },
    { slug: "alarm-cctv-install", name: "Alarm + CCTV install", frequency: "common", pricingModel: "quote-required", description: "SSAIB / NSI-registered for police-response alarms." },
    { slug: "electric-shower-install", name: "Electric shower install", frequency: "common", pricingModel: "fixed-price", description: "Circuit + shower unit fit. Part P notifiable." }
  ],

  customerTypes: [
    { slug: "homeowner", name: "Homeowner", description: "One-off + fault work. Multi-quote comparison; values NICEIC/NAPIT credential." },
    { slug: "landlord", name: "Landlord (recurring EICR)", description: "5-year EICR cycle. Values reminder service + consolidated invoicing." },
    { slug: "letting-agent", name: "Letting agent", description: "Multi-property EICR + minor works. Values web-portal + statement invoicing." },
    { slug: "commercial-light", name: "Commercial (light)", description: "Small-office / retail fit-outs + PAT + minor works." }
  ],

  workflow: [
    { slug: "enquiry", name: "Enquiry", description: "Homeowner or landlord submits form with property size + intended work.", poweredByCapability: "lead-capture" },
    { slug: "site-survey", name: "Site survey", description: "For rewires + solar + EV. Full site inspection + measure." },
    { slug: "quote-with-notifiable-flag", name: "Quote (notifiable flagged)", description: "Itemised quote clearly showing Part P scheme submission fee where applicable." },
    { slug: "work-and-notify", name: "Work + notify scheme", description: "Job done, notification submitted through scheme, certificate issued." },
    { slug: "certificate-and-invoice", name: "Certificate + invoice", description: "Handover pack: EIC / EICR + invoice + workmanship guarantee." }
  ],

  commonFaqs: [
    { question: "Do I need an EICR as a landlord?", answer: "Yes — every 5 years for rented properties in England (Electrical Safety Standards Regs 2020, in force April 2021)." },
    { question: "Do you notify Part P work?", answer: "Yes. Every notifiable job is registered through our scheme (NICEIC/NAPIT/STROMA)." },
    { question: "How long does a rewire take?", answer: "Typical 2-bed 3–5 days. 3-bed 5–7 days. Firm window at quote." },
    { question: "Can you install my EV charger?", answer: "Yes — 7kW single-phase or 22kW three-phase where supply allows. OZEV-authorised installer." },
    { question: "Solar + battery?", answer: "Yes — MCS certified. BUS grant + SEG export tariff eligibility handled at survey." }
  ],

  recommendedModules: ["website", "verified-badges", "coverage-radius", "quote-pipeline", "job-diary", "lead-alerts", "bookings", "membership", "payments"],
  canonicalBlueprint: "electrician-domestic",

  industryIntelligence: [
    "Landlord EICR is a legal 5-year recurring driver (April 2021 rule)",
    "Part P notified work must be registered through the scheme",
    "EV chargers require OZEV-authorised installer status",
    "MCS for solar + battery is a cross-sell path already lit",
    "Emergency call-outs are a phone-first funnel, not form-first"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

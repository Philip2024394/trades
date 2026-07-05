// Knowledge Package: Roofer.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Both planned (re-roof, repointing, chimney) and emergency (storm
// damage, active leak) roofing under one Package. Verticals split via
// service frequency, not by Package fork — the same trade with two
// workflow entry points. Grounded in PRD Appendix D.6 + storm-mode
// research.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "roofer",
  name: "Roofer",
  emoji: "🏠",
  tagline: "Planned re-roofs + emergency storm response.",
  description:
    "Covers pitched + flat roofing, chimney and lead work, storm response, and insurance photo reports. Handles both scheduled work (re-roof, refurb) and same-day emergency callouts.",
  version: "1.0.0",
  trades: [
    "roofer",
    "emergency-roofing",
    "flat-roofing",
    "commercial-roofing"
  ],

  usesDomains: ["estimating", "quoting", "compliance", "crm"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Roofing estimates are area × pitch × slate/tile size + scaffold + skip. Pitch multiplier is the trade-specific factor; standard 22.5°–45° range covers most UK pitched roofs.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            pitch_degrees: "number",
            tile_type: "string",
            area_m2: "number",
            scaffold_days: "number"
          },
          reason:
            "Area × pitch gives real slope area; scaffold days is often a bigger cost line than the tiles themselves."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "roof-area-calculator",
          name: "Roof area calculator",
          description:
            "Ground area × pitch multiplier → true slope area. Tile-per-m² lookup by tile spec."
        },
        {
          capabilityId: "waste-factor",
          slug: "tile-cut-waste",
          name: "Tile cut waste",
          description:
            "Hip + valley cuts typically add 5–10% waste. Complex geometries can hit 15%."
        }
      ]
    },
    {
      domainId: "quoting",
      notes:
        "Storm-response quotes are text-based (photo + address + phone) — the customer wants a callout, not a document. Planned re-roof quotes are full documents with scaffold + skip line items.",
      capabilities: [
        {
          capabilityId: "quote-send",
          slug: "photo-quote-response",
          name: "Photo-first quote response",
          description:
            "For emergency callouts, response is a short WhatsApp reply with ETA + callout charge — NOT a formal quote document."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Waste Carrier registration is required for tile / slate removal. Work at Height Regs 2005 govern scaffold + MEWP protocol.",
      compliance: [
        {
          id: "work-at-height-2005",
          name: "Work at Height Regulations 2005",
          regulator: "HSE",
          source:
            "https://www.legislation.gov.uk/uksi/2005/735/contents/made"
        },
        {
          id: "waste-carrier-licence",
          name: "Waste Carrier Licence — required for tile/slate removal",
          regulator: "Environment Agency",
          source:
            "https://www.gov.uk/register-renew-waste-carrier-broker-dealer-england",
          credentialScheme: "waste-carrier"
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Roofer Deals often attach to an insurance claim — the customer's insurer is a secondary Contact / Company on the Deal.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            insurer_reference: "string",
            photo_report_url: "string",
            storm_event_date: "date"
          },
          reason:
            "Storm claims need the insurer reference + photo report on the Deal itself so the merchant + insurer + customer all have one record."
        }
      ]
    }
  ],

  services: [
    { slug: "slipped-tile-repair", name: "Slipped / broken tile repair", frequency: "core", pricingModel: "fixed-price", description: "Replace individual tiles or slates. Same-day where scaffold not required." },
    { slug: "storm-damage-repair", name: "Storm damage repair", frequency: "core", pricingModel: "quote-required", description: "Emergency response — tarp cover + insurance photo report + repair schedule." },
    { slug: "full-reroof", name: "Full re-roof", frequency: "core", pricingModel: "quote-required", description: "Strip + felt + batten + re-tile / re-slate. Typical 5–8 days on a 3-bed." },
    { slug: "flat-roof-repair", name: "Flat roof repair + replacement", frequency: "core", pricingModel: "quote-required", description: "EPDM / GRP / felt overlay. Manufacturer-training-backed warranty." },
    { slug: "chimney-repair", name: "Chimney repair + rebuild", frequency: "common", pricingModel: "quote-required", description: "Repoint, cap, rebuild. Chimney removal notified via Building Control." },
    { slug: "lead-flashing", name: "Lead flashing", frequency: "common", pricingModel: "fixed-price", description: "Chimney + abutment lead work. Real cast lead, correct code weights." },
    { slug: "roofline-fitting", name: "Fascia / soffit / bargeboards", frequency: "common", pricingModel: "fixed-price", description: "uPVC or timber roofline replacement. Includes soffit ventilation strips." },
    { slug: "gutter-service", name: "Gutter clean / repair / replace", frequency: "core", pricingModel: "fixed-price", description: "Clear + inspect. Replace where broken. Downpipe unblock included." },
    { slug: "roof-safety-survey", name: "Roof safety survey + report", frequency: "specialism", pricingModel: "fixed-price", description: "Written report + photos. Commercial buildings + pre-purchase surveys." }
  ],

  customerTypes: [
    { slug: "homeowner-planned", name: "Homeowner — planned work", description: "Re-roof / repointing / gutters. Multi-quote comparison shopper." },
    { slug: "homeowner-emergency", name: "Homeowner — emergency", description: "Active leak / storm damage. Wants callback within the hour." },
    { slug: "letting-agent", name: "Letting agent / landlord", description: "Multi-property maintenance account. Values consolidated invoicing." },
    { slug: "insurance-broker", name: "Insurance broker", description: "Claims-work referrer. Values photo reports + accepted rate cards." }
  ],

  workflow: [
    { slug: "enquiry", name: "Enquiry (call / WhatsApp / form)", description: "Emergency callers want a person; planned enquirers accept a form.", poweredByCapability: "lead-capture" },
    { slug: "survey-or-tarp", name: "Site survey (planned) OR tarp cover (emergency)", description: "Planned survey books scaffold + skip. Emergency response tarps + photographs." },
    { slug: "quote-or-authorisation", name: "Written quote OR insurance authorisation", description: "Planned: full itemised quote. Emergency: insurance auth + rate-card confirmation." },
    { slug: "scaffold-and-work", name: "Scaffold + work window", description: "Scaffold up, work done, sign-off + snag walk." },
    { slug: "photo-report-and-invoice", name: "Photo report + invoice", description: "Photo evidence pack sent to customer + insurer if applicable. Invoice follows." }
  ],

  commonFaqs: [
    { question: "Can you tarp tonight?", answer: "Yes if you're within our coverage radius. Response window quoted on the call." },
    { question: "Do you invoice via insurance?", answer: "Yes — we provide the photo report + invoice your insurer directly. Bring your reference number." },
    { question: "Do you charge a call-out fee?", answer: "We tell you the fee before we dispatch. No hidden charges." },
    { question: "How long does a full re-roof take?", answer: "Typical 3-bed 5–8 days depending on weather + complexity. Timeline confirmed at survey." },
    { question: "What warranty do you give?", answer: "Workmanship guarantee 12 months. Materials carry the manufacturer's warranty." }
  ],

  recommendedModules: ["website", "verified-badges", "coverage-radius", "storm-mode", "lead-alerts", "job-diary", "quote-pipeline", "payments"],
  canonicalBlueprint: "roofing-emergency-callout",

  industryIntelligence: [
    "Storm damage is a seasonal spike — Met Office warnings correlate",
    "Waste Carrier registration is required for tile + slate removal",
    "Work at Height Regs 2005 dictate scaffold / MEWP protocol",
    "Insurance photo-report is the standard evidence pack",
    "Non-destructive assessment before dispatch is an ASA-safe practice"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

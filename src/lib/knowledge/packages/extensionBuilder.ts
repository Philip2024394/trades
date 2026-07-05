// Knowledge Package: Extension Builder.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Single-storey, two-storey, wrap-around and kitchen extensions.
// Building Regs + Party Wall + CDM + Permitted Development all live
// or dead on this trade. Grounded in real UK regulations, no invented
// requirements.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "extension-builder",
  name: "Extension Builder",
  emoji: "🏗️",
  tagline: "Rear, side, wrap-around — Building Control + Party Wall handled.",
  description:
    "Full-service extension builder. Single-storey rear, side-return, two-storey and wrap-arounds. Coordinates architect, structural engineer, Building Control, Party Wall surveyor + all the sub-trades. Planning + Permitted Development advice at first-quote stage.",
  version: "1.0.0",
  trades: ["extension-builder", "extension-specialist"],

  usesDomains: ["estimating", "quoting", "compliance", "crm", "projects"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Extension estimates are footprint × per-m² build cost + steels + fit-out. Steels/RSJs quoted by tonnage — always by the structural engineer, never guessed. Fit-out is 40-60% of build cost.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            footprint_m2: "number",
            storeys: "number",
            steel_tonnage: "number",
            party_wall_award_required: "boolean",
            building_control_route: "enum"
          },
          reason:
            "Storey count drives Party Wall trigger; footprint + fit-out spec drives price; Building Control route (Full Plans vs Building Notice) drives inspection cadence."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Extensions touch Building Regs, Party Wall, Planning + CDM. Every build over 100k requires a Principal Designer + Principal Contractor. Permitted Development limits are strict — err on side of Full Plans.",
      compliance: [
        {
          id: "building-regs-approved-doc-a",
          name: "Building Regulations Approved Document A — Structure",
          regulator: "MHCLG",
          source:
            "https://www.gov.uk/government/publications/structure-approved-document-a"
        },
        {
          id: "party-wall-act-1996",
          name: "Party Wall etc. Act 1996 — notice + award requirements",
          regulator: "MHCLG",
          source:
            "https://www.legislation.gov.uk/ukpga/1996/40/contents"
        },
        {
          id: "gpdo-2015-permitted-development",
          name: "Town and Country Planning (General Permitted Development) Order 2015",
          regulator: "MHCLG",
          source:
            "https://www.legislation.gov.uk/uksi/2015/596/contents/made"
        },
        {
          id: "cdm-2015-domestic",
          name: "CDM 2015 — domestic clients + designer/contractor duties",
          regulator: "HSE",
          source: "https://www.legislation.gov.uk/uksi/2015/51/contents/made"
        }
      ]
    },
    {
      domainId: "projects",
      notes:
        "Extension projects are 6-16 weeks in phases: strip-out, foundations, steel, brickwork, roof, windows, fit-out, snags. Photo record at each phase is the go-to evidence for handover + retention.",
      entityExtensions: [
        {
          entityId: "phase",
          additionalFields: {
            building_control_inspection_required: "boolean",
            party_wall_notification_stage: "boolean",
            retention_percent: "number"
          },
          reason:
            "Building Control inspections trigger at specific phases (foundations, DPC, drainage, insulation, completion) — misses trigger repeat work."
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Extension customers are homeowners doing forever-home upgrades. Multi-quote comparison is standard. Architects + structural engineers refer customers; keep those relationships warm.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            architect_appointed: "boolean",
            se_appointed: "boolean",
            planning_status: "enum",
            party_wall_status: "enum"
          },
          reason:
            "Architect + SE + planning status determine whether you're the first port of call or the fifth — pricing conversation differs."
        }
      ]
    }
  ],

  services: [
    { slug: "single-storey-rear", name: "Single-storey rear extension", frequency: "core", pricingModel: "quote-required", description: "Kitchen-diner extension. 8-12 week programme typical." },
    { slug: "side-return", name: "Side-return extension", frequency: "core", pricingModel: "quote-required", description: "London-style side infill. Terraced house widening." },
    { slug: "two-storey-side", name: "Two-storey side extension", frequency: "core", pricingModel: "quote-required", description: "Ground + first floor. Planning-permission mandatory typically." },
    { slug: "wrap-around", name: "Wrap-around extension", frequency: "common", pricingModel: "quote-required", description: "Combined rear + side. 12-16 week programme." },
    { slug: "kitchen-extension", name: "Kitchen extension + open-plan", frequency: "core", pricingModel: "quote-required", description: "Rear extension with knock-through, RSJ install." },
    { slug: "orangery", name: "Orangery", frequency: "specialism", pricingModel: "quote-required", description: "Glass-heavy variant. Sub-25% roof glazed keeps under permitted development." },
    { slug: "loft-conversion", name: "Loft conversion + dormer", frequency: "common", pricingModel: "quote-required", description: "Roof-space conversion with dormer or hip-to-gable." },
    { slug: "porch", name: "Porch build", frequency: "common", pricingModel: "fixed-price", description: "Front porch under 3m² footprint sits within permitted development." },
    { slug: "garage-conversion", name: "Garage conversion", frequency: "common", pricingModel: "quote-required", description: "Habitable-space conversion. Building Regs sign-off required." },
    { slug: "feasibility-visit", name: "Feasibility site visit", frequency: "common", pricingModel: "fixed-price", description: "Non-obligation quote visit — buildable + planning status assessment." }
  ],

  customerTypes: [
    { slug: "homeowner-forever", name: "Homeowner (forever home)", description: "Multi-quote, values design + finish. Longest sales cycle — 3-6 months from first contact." },
    { slug: "homeowner-flip", name: "Homeowner (sell-and-move)", description: "Budget-constrained; wants a return-on-investment framing. Timeline-driven." },
    { slug: "developer-single-plot", name: "Small developer (single-plot)", description: "Repeatable spec. Values consistency + speed." },
    { slug: "buy-to-let-landlord", name: "Buy-to-let landlord (yield upgrade)", description: "Converting to add a bedroom. Values speed + minimum void time." }
  ],

  workflow: [
    { slug: "enquiry-and-triage", name: "Enquiry + triage", description: "Photos, planning status, architect status. Qualify buildability at first pass.", poweredByCapability: "lead-capture" },
    { slug: "feasibility-visit", name: "Feasibility site visit", description: "Assess access, existing structure, PD limits, party-wall triggers." },
    { slug: "quote-and-approve", name: "Quote + contract", description: "Priced schedule of works, JCT Home-Owner contract, deposit + stage payments defined." },
    { slug: "pre-start-and-notify", name: "Pre-start + party-wall + Building Control", description: "Notices served, insurance in place, Building Control appointed." },
    { slug: "phase-build", name: "Phased build", description: "Strip-out → foundations → steels → brickwork → roof → windows → fit-out. Photo record at each stage." },
    { slug: "handover-and-completion", name: "Handover + completion certificate", description: "Snag walk, Building Control final, retention hold, warranty issue." }
  ],

  commonFaqs: [
    { question: "Do I need planning permission?", answer: "Depends on size + Article 4 status. Many single-storey rears fit permitted development. We check on the feasibility visit." },
    { question: "What's the Party Wall Act?", answer: "If you dig within 3m of a neighbour's foundations, or the wall is shared, you must serve notice. Missing it can stop the job mid-build." },
    { question: "How long does a rear extension take?", answer: "Single-storey typically 8-12 weeks. Two-storey 12-16 weeks. Weather, planning + supply chain add tolerance." },
    { question: "Do you provide the architect?", answer: "We work with your architect or introduce one. Design + build packages available." },
    { question: "How much retention?", answer: "Typical 2.5-5% held for 6 months against snags. Released after Building Control final + snag close-out." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "trade-connections", "meet-the-team", "downloads", "payments"],
  canonicalBlueprint: undefined,

  industryIntelligence: [
    "Party Wall Act notices must be served 2 months before excavation within 3m of a neighbour",
    "Permitted development for rear extensions limits: single storey 4m detached / 3m other; height 4m",
    "Building Control chooses Full Plans OR Building Notice — Full Plans is safer for extensions",
    "Retention is standard 2.5-5% of contract value, held for 6-12 months",
    "CDM 2015 domestic client duties transfer to the contractor by default — you're the Principal Designer"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

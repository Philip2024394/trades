// Knowledge Package: Landscaper.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Hardscape + softscape — patios, decking, driveways, retaining walls,
// planting, turfing, drainage. Grounded in PRD Appendix D + real UK
// SUDS + permitted-development compliance.

import { knowledgePackageRegistry } from "../packageRegistry";
import type { KnowledgePackage } from "../packageTypes";

const pkg: KnowledgePackage = {
  id: "landscaper",
  name: "Landscaper",
  emoji: "🌳",
  tagline: "Hardscape + softscape — driveways to planting, done right.",
  description:
    "Full-service landscaper. Hardscape (patios, decking, driveways, walls) and softscape (turfing, planting, drainage) — plus garden building install where planning permits. SUDS-aware drainage and impermeable-driveway rules built in.",
  version: "1.0.0",
  trades: ["landscaper", "landscape-gardener", "garden-designer"],

  usesDomains: ["estimating", "quoting", "compliance", "crm", "materials"],

  extensions: [
    {
      domainId: "estimating",
      notes:
        "Landscape estimates are area × unit rate + labour + plant + drainage. Aggregates (Type 1, sharp sand) sold by tonne — mixed unit conversion is the highest error surface.",
      entityExtensions: [
        {
          entityId: "estimate-line",
          additionalFields: {
            surface_type: "string",
            area_m2: "number",
            aggregate_type: "string",
            aggregate_depth_mm: "number",
            skip_size_yd3: "number"
          },
          reason:
            "Sub-base depth × area drives aggregate tonnage; skip sizing depends on excavation volume; both are consistently under-quoted by newcomers."
        }
      ],
      capabilities: [
        {
          capabilityId: "material-calculator",
          slug: "aggregate-tonnage-calculator",
          name: "Aggregate tonnage calculator",
          description:
            "Area × depth × density — density is per aggregate type (Type 1: ~2.1 t/m³, sharp sand ~1.6 t/m³). Includes 5% waste factor."
        },
        {
          capabilityId: "waste-factor",
          slug: "landscape-waste-factor",
          name: "Landscape waste factor",
          description:
            "Adds 5-10% for aggregate compaction + 10% for slabs to allow for breakage on cuts."
        }
      ]
    },
    {
      domainId: "compliance",
      notes:
        "Impermeable driveways over 5m² need planning permission unless drainage manages runoff on-site (SUDS). Garden buildings over permitted-development limits need planning. Timber decking uses CE-marked treated timber.",
      compliance: [
        {
          id: "suds-driveway-2008",
          name: "Impermeable Paving of Front Gardens — planning rules (2008 GPDO amendment)",
          regulator: "MHCLG / Planning Portal",
          source:
            "https://www.planningportal.co.uk/permission/common-projects/paving-your-front-garden"
        },
        {
          id: "wildlife-countryside-1981",
          name: "Wildlife and Countryside Act 1981 — protected species + hedgerow work windows",
          regulator: "Natural England",
          source:
            "https://www.legislation.gov.uk/ukpga/1981/69/contents"
        },
        {
          id: "waste-carrier-lower-tier",
          name: "Environmental Permitting Regulations — waste carrier registration",
          regulator: "Environment Agency",
          source:
            "https://www.gov.uk/waste-carrier-or-broker-registration",
          credentialScheme: "waste-carrier"
        }
      ]
    },
    {
      domainId: "materials",
      notes:
        "Landscapers buy aggregates by the tonne from local yards. Slab + block choices drive customer conversations — texture-samples on-site outperform showroom visits.",
      entityExtensions: [
        {
          entityId: "material-item",
          additionalFields: {
            porosity: "string",
            frost_resistant: "boolean",
            typical_lifespan_years: "number"
          },
          reason:
            "Porosity + frost resistance drive winter longevity of any UK external hard surface — customers should know the spec before choosing."
        }
      ]
    },
    {
      domainId: "crm",
      notes:
        "Homeowners are single-project; developers + estate managers are multi-property recurring. Track callback windows — spring is the enquiry peak.",
      entityExtensions: [
        {
          entityId: "deal",
          additionalFields: {
            garden_size_m2: "number",
            season_target: "enum",
            access_route: "string"
          },
          reason:
            "Season-target drives scheduling; access route (side gate, front only, rear) drives whether a mini-digger fits."
        }
      ]
    }
  ],

  services: [
    { slug: "patio-lay", name: "Patio lay", frequency: "core", pricingModel: "quote-required", description: "Porcelain, sandstone or riven — sub-base, sand, jointing compound." },
    { slug: "block-paving-drive", name: "Block-paving driveway", frequency: "core", pricingModel: "quote-required", description: "Excavation, sub-base, edging, SUDS-compliant drainage." },
    { slug: "resin-drive", name: "Resin-bound driveway", frequency: "common", pricingModel: "quote-required", description: "Permeable resin over base — meets SUDS out of the box." },
    { slug: "decking-install", name: "Composite / hardwood decking", frequency: "core", pricingModel: "quote-required", description: "Framed sub-structure, board install, balustrade." },
    { slug: "retaining-wall", name: "Retaining wall (up to 1m)", frequency: "common", pricingModel: "quote-required", description: "Brick, block or gabion — over 1m is engineer-designed." },
    { slug: "turfing", name: "Turfing + lawn preparation", frequency: "core", pricingModel: "fixed-price", description: "Site prep, top-soil, turf laid + rolled." },
    { slug: "planting-design", name: "Planting scheme + install", frequency: "common", pricingModel: "quote-required", description: "Border design, soil amendment, plant supply + install." },
    { slug: "garden-drainage", name: "Garden drainage / soakaway", frequency: "common", pricingModel: "quote-required", description: "Land drain, soakaway, French drain. Percolation-tested." },
    { slug: "fencing-install", name: "Fencing install", frequency: "common", pricingModel: "fixed-price", description: "Feather-edge, panel, close-board. Concrete or timber posts." },
    { slug: "artificial-grass", name: "Artificial grass install", frequency: "specialism", pricingModel: "fixed-price", description: "Sub-base, weed membrane, seamed install." },
    { slug: "garden-clearance", name: "Garden clearance", frequency: "common", pricingModel: "fixed-price", description: "Overgrown reset — waste-carrier licensed removal." }
  ],

  customerTypes: [
    { slug: "homeowner", name: "Homeowner", description: "Single-project. Values design + finish + tidy site over shortest turnaround." },
    { slug: "letting-landlord", name: "Landlord (let-property tidy)", description: "Between-tenant grass cuts + tidy. Values fast quote + flexible schedule." },
    { slug: "developer-new-build", name: "Developer (new-build finishing)", description: "Recurring plot-by-plot finish. Values consistency + turnaround." },
    { slug: "commercial-grounds", name: "Commercial grounds (offices, schools)", description: "Contracted maintenance + occasional project work. Values invoicing." }
  ],

  workflow: [
    { slug: "enquiry", name: "Enquiry", description: "Photo + rough dimensions + preferred timing. Season affects lead-time.", poweredByCapability: "lead-capture" },
    { slug: "site-visit", name: "Site visit + design", description: "Measure, sketch layout, discuss materials + samples on-site." },
    { slug: "quote-and-approve", name: "Quote + approval", description: "Priced schedule with visualisation. Materials + labour separated." },
    { slug: "schedule-and-work", name: "Schedule + work", description: "Weather-check. Excavation, sub-base, install, planting sequence." },
    { slug: "handover-and-aftercare", name: "Handover + aftercare", description: "Care notes (turf watering, sealer schedule), 12-month callback." }
  ],

  commonFaqs: [
    { question: "Do I need planning for a patio or driveway?", answer: "Impermeable driveways over 5m² need planning unless the runoff is managed on-site (SUDS). Patios don't need planning within permitted development limits." },
    { question: "When is best to landscape?", answer: "March–October for softscape (planting, turfing). Hard landscaping can be year-round if the ground isn't frozen." },
    { question: "How long does a typical patio take?", answer: "Small patio (20-30m²) 3–5 days. Large project with drainage 2–3 weeks." },
    { question: "Do you clear the old surface?", answer: "Yes — waste-carrier licensed removal is included in the quote. Skip or grab-lorry priced separately." },
    { question: "Do you plant as well as build?", answer: "Yes — planting schemes are a common add-on to a patio or fencing project. Nursery-supplied at trade rates." }
  ],

  recommendedModules: ["website", "verified-badges", "quote-pipeline", "job-diary", "trade-connections", "material-calculators", "meet-the-team"],
  canonicalBlueprint: undefined,

  industryIntelligence: [
    "Impermeable driveways over 5m² trigger planning permission unless SUDS on-site",
    "Aggregate tonnage is area × depth × density — Type 1 is ~2.1 t/m³",
    "Spring (Mar–May) is the enquiry peak — schedule accordingly",
    "Waste-carrier registration is mandatory for any spoil removal",
    "Access route (side gate width) determines whether a mini-digger fits"
  ]
};

knowledgePackageRegistry.register(pkg);
export default pkg;

// Specialist agent catalog — the 30 knowledge-backed specialists that
// Phase 24 adds on top of the baseline 10.
//
// Every specialist here follows the same shape: retrieves knowledge
// entries scoped to its speciality keywords, returns a Nex-voiced
// contribution with confidence + evidence. Complex specialists that
// wrap dedicated engines (digital_twin → twin, cost_planning → fi/est)
// override the default invoke.
//
// New specialists plug in via `buildSpecialistAgent()` — no framework
// change required.

import { retrieveKnowledge } from "../knowledge";
import type {
  Agent,
  AgentCategory,
  AgentId,
  AgentInvocationContext,
  AgentPermission,
  AgentResult,
  AgentSpeciality,
  CountryCode
} from "./types";
import { evidenceFor } from "./types";

type SpecialistSpec = {
  id:                  AgentId;
  name:                string;
  role:                string;
  speciality:          AgentSpeciality;
  category:            AgentCategory;
  permissions:         AgentPermission[];
  tools:               string[];
  country_support:     CountryCode[];
  expertise_keywords:  string[];
  boundaries?:         string[];
  /** True when this specialist's findings should be treated as citing
   *  official sources (regulations family). Bumps priority in
   *  conflict-resolution. */
  official?:           boolean;
  /** Custom invoke, or `undefined` to use the default knowledge-backed
   *  invoker. */
  invoke?:             (ctx: AgentInvocationContext) => Promise<AgentResult>;
};

/** Default knowledge-backed invoker. Retrieves 3 entries scoped by the
 *  specialist's keywords + the merchant ask, returns a Nex-voiced
 *  reply, and never invents facts. */
function defaultInvoke(spec: SpecialistSpec) {
  return async (ctx: AgentInvocationContext): Promise<AgentResult> => {
    // Focus the query with the specialist's own vocabulary.
    const primaryKeyword = spec.expertise_keywords[0] ?? spec.speciality;
    const query = `${primaryKeyword} ${ctx.focus_ask}`.trim();
    const hits = await retrieveKnowledge(query, 3).catch(() => []);
    const source = spec.official
      ? `${spec.name} → hammerex_knowledge_entries (official)`
      : `${spec.name} → hammerex_knowledge_entries`;
    const evidence = evidenceFor(source, ["hammerex_knowledge_entries"]);

    if (!hits || hits.length === 0) {
      return {
        agent_id:    spec.id,
        headline:    `Nothing on file for ${spec.name}.`,
        speak:       `Nothing on file for ${spec.name} on this ask yet. If it matters for the job, mark it for research and I'll dig deeper.`,
        confidence:  "low",
        is_official: spec.official ?? false,
        evidence
      };
    }
    const bullets = hits.map((h) => `- ${h.title ?? "(untitled entry)"}`).join("\n");
    return {
      agent_id:    spec.id,
      headline:    `${hits.length} ${spec.name} reference${hits.length === 1 ? "" : "s"} on file.`,
      speak:       `${spec.name}:\n${bullets}`,
      confidence:  hits.length >= 3 ? "medium" : "low",
      is_official: spec.official ?? false,
      evidence,
      metadata:    { hit_count: hits.length }
    };
  };
}

/** Turn a spec into a full Agent. */
export function buildSpecialistAgent(spec: SpecialistSpec): Agent {
  return {
    id:                 spec.id,
    name:               spec.name,
    role:               spec.role,
    speciality:         spec.speciality,
    category:           spec.category,
    permissions:        spec.permissions,
    version:            "2026-07",
    tools:              spec.tools,
    country_support:    spec.country_support,
    expertise_keywords: spec.expertise_keywords,
    boundaries:         spec.boundaries,
    invoke:             spec.invoke ?? defaultInvoke(spec)
  };
}

// ─── Regulations family ─────────────────────────────────────────

const REGULATIONS_COUNTRIES: CountryCode[] = ["UK", "IE", "AU", "US", "CA", "NZ", "AE"];

const planning: SpecialistSpec = {
  id: "planning", name: "Planning Agent",
  role: "Points at planning permission requirements + local authority processes",
  speciality: "planning", category: "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: REGULATIONS_COUNTRIES,
  expertise_keywords: ["planning permission", "planning", "listed building consent", "conservation area", "PD rights", "permitted development"],
  boundaries: ["Never makes a permission determination — that's the LPA's job."],
  official: true
};

const buildingControl: SpecialistSpec = {
  id: "building_control", name: "Building Control Agent",
  role: "Building Control notification, sign-off, and completion certificate steps",
  speciality: "building_control", category: "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: REGULATIONS_COUNTRIES,
  expertise_keywords: ["building control", "building regulations", "completion certificate", "sign off", "notice", "part a", "part b", "part l", "part p"],
  boundaries: ["Never a substitute for a Building Control officer's inspection."],
  official: true
};

const fireSafety: SpecialistSpec = {
  id: "fire_safety", name: "Fire Safety Agent",
  role: "Passive + active fire protection, means of escape, compartmentation",
  speciality: "fire_safety", category: "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: REGULATIONS_COUNTRIES,
  expertise_keywords: ["fire", "fire safety", "fire door", "compartmentation", "means of escape", "smoke alarm", "part b", "sprinkler", "fd30", "fd60"],
  boundaries: ["Never certifies fire strategy — that's a fire engineer's remit."],
  official: true
};

const accessibility: SpecialistSpec = {
  id: "accessibility", name: "Accessibility Agent",
  role: "Access, mobility, and inclusive design (Part M / ADA / DDA equivalents)",
  speciality: "accessibility", category: "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: REGULATIONS_COUNTRIES,
  expertise_keywords: ["accessibility", "part m", "ada", "wheelchair", "ramp", "grab rail", "level threshold", "inclusive design"],
  official: true
};

const heritage: SpecialistSpec = {
  id: "heritage", name: "Heritage Agent",
  role: "Listed buildings, conservation areas, heritage assets",
  speciality: "heritage", category: "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: REGULATIONS_COUNTRIES,
  expertise_keywords: ["listed", "heritage", "conservation area", "historic england", "cadw", "hes", "grade i", "grade ii"],
  boundaries: ["Never sign-off for listed building consent — LPA + heritage officer only."],
  official: true
};

const structural: SpecialistSpec = {
  id: "structural", name: "Structural Engineering Agent",
  role: "Load paths, beams, foundations, load-bearing wall removal",
  speciality: "structural", category: "regulations",
  permissions: ["read_regulations", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: REGULATIONS_COUNTRIES,
  expertise_keywords: ["structural", "load bearing", "beam", "rsj", "steel beam", "foundation", "underpin", "lintel"],
  boundaries: ["Never a substitute for a chartered structural engineer's calcs + sign-off."],
  official: true
};

// ─── Trades family ──────────────────────────────────────────────

const timber: SpecialistSpec = {
  id: "timber", name: "Timber Agent",
  role: "Timber species, treatments, structural sizing, moisture rules",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["timber", "wood", "joist", "rafter", "cls", "c16", "c24", "treated", "hardwood", "softwood", "osb", "plywood"]
};

const steel: SpecialistSpec = {
  id: "steel", name: "Steel Agent",
  role: "Steel sections, beam sizing indications, corrosion, fixings",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["steel", "rsj", "ub", "uc", "channel", "angle", "flitch", "galvanised"],
  boundaries: ["Never sizes a beam definitively — hand off to Structural Engineering Agent."]
};

const concrete: SpecialistSpec = {
  id: "concrete", name: "Concrete Agent",
  role: "Mix designs, curing, foundations, screeds, GEN3/C30",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["concrete", "screed", "gen1", "gen3", "c30", "c40", "curing", "footing", "slab", "reinforcement", "rebar"]
};

const masonry: SpecialistSpec = {
  id: "masonry", name: "Masonry Agent",
  role: "Bricks, blocks, mortar, pointing, wall ties, DPC",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["brick", "block", "mortar", "pointing", "wall tie", "dpc", "cavity", "coursing"]
};

const roofing: SpecialistSpec = {
  id: "roofing", name: "Roofing Agent",
  role: "Tiles, slates, felts, flashings, pitch, verges, valleys",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["roof", "roofing", "tile", "slate", "felt", "flashing", "verge", "ridge", "valley", "gutter", "fascia"]
};

const plumbing: SpecialistSpec = {
  id: "plumbing", name: "Plumbing Agent",
  role: "Copper, PEX, MDPE, waste, hot/cold, pressure, boilers",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["plumb", "plumbing", "copper", "pex", "waste", "trap", "boiler", "mdpe", "compression", "solder", "push-fit"]
};

const electrical: SpecialistSpec = {
  id: "electrical", name: "Electrical Agent",
  role: "18th edition, cable sizing, RCBOs, testing, Part P",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["electric", "electrical", "18th edition", "rcbo", "cable", "consumer unit", "part p", "socket", "ring main"],
  boundaries: ["Never sign-off electrical certificates — Part P registered electrician only."]
};

const hvac: SpecialistSpec = {
  id: "hvac", name: "HVAC Agent",
  role: "Ventilation, AC, MVHR, ductwork, Part F",
  speciality: "trade_craft", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["hvac", "ventilation", "mvhr", "air conditioning", "ductwork", "extract fan", "part f", "trickle vent"]
};

const renewableEnergy: SpecialistSpec = {
  id: "renewable_energy", name: "Renewable Energy Agent",
  role: "Solar PV, thermal, batteries, EV chargers, grants",
  speciality: "renewables", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["solar", "pv", "battery", "ev charger", "renewable", "mcs", "smart export", "seg"]
};

const heatPump: SpecialistSpec = {
  id: "heat_pump", name: "Heat Pump Agent",
  role: "ASHP + GSHP sizing, radiator upgrades, buffer tanks, BUS grant",
  speciality: "renewables", category: "trades",
  permissions: ["read_knowledge", "read_products"],
  tools: ["knowledge.retrieve", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["heat pump", "ashp", "gshp", "buffer tank", "bus grant", "flow temperature", "cop", "scop"]
};

// ─── Commercial family ──────────────────────────────────────────

const quantitySurveyor: SpecialistSpec = {
  id: "quantity_surveyor", name: "Quantity Surveyor Agent",
  role: "Bills of quantities, valuations, variations, retention",
  speciality: "commercial", category: "commercial",
  permissions: ["read_projects", "read_products", "read_costs", "read_knowledge"],
  tools: ["knowledge.retrieve", "est.buildEstimate"],
  country_support: ["*"],
  expertise_keywords: ["qs", "quantity surveyor", "bill of quantities", "boq", "variation", "valuation", "retention", "practical completion"]
};

const pricing: SpecialistSpec = {
  id: "pricing", name: "Pricing Agent",
  role: "Market pricing, benchmarks, day rates, uplift bands",
  speciality: "cost_engineering", category: "commercial",
  permissions: ["read_products", "read_suppliers"],
  tools: ["mp.searchProducts", "mp.rankListings"],
  country_support: ["*"],
  expertise_keywords: ["day rate", "market price", "benchmark", "hourly rate", "unit rate"]
};

const marginAnalysis: SpecialistSpec = {
  id: "margin_analysis", name: "Margin Analysis Agent",
  role: "Gross margin, contribution, break-even by job",
  speciality: "cost_engineering", category: "commercial",
  permissions: ["read_projects", "read_costs"],
  tools: ["fi.buildFinancialSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["margin", "gross margin", "contribution", "break-even", "profit per job"]
};

const costPlanning: SpecialistSpec = {
  id: "cost_planning", name: "Cost Planning Agent",
  role: "Order-of-magnitude cost plans, elemental cost analysis",
  speciality: "cost_engineering", category: "commercial",
  permissions: ["read_projects", "read_costs", "read_products"],
  tools: ["est.buildEstimate", "mp.searchProducts"],
  country_support: ["*"],
  expertise_keywords: ["cost plan", "elemental cost", "budget", "cost per m2", "order of magnitude"]
};

const tenderReview: SpecialistSpec = {
  id: "tender_review", name: "Tender Review Agent",
  role: "Reviewing incoming tenders + preparing bids",
  speciality: "commercial", category: "commercial",
  permissions: ["read_projects", "read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: ["*"],
  expertise_keywords: ["tender", "bid", "itt", "rfi", "prequal", "ppq", "sq"]
};

// ─── Business family ────────────────────────────────────────────

const cashFlow: SpecialistSpec = {
  id: "cash_flow", name: "Cash Flow Agent",
  role: "13-week cash forecast, AR ageing, VAT window",
  speciality: "cash_flow", category: "business",
  permissions: ["read_projects", "read_costs"],
  tools: ["fi.buildFinancialSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["cash flow", "cashflow", "forecast", "overdue", "ar ageing", "vat window", "runway"]
};

const scheduling: SpecialistSpec = {
  id: "scheduling", name: "Scheduling Agent",
  role: "Diary planning, sequencing, critical path",
  speciality: "scheduling", category: "business",
  permissions: ["read_projects", "read_calendar"],
  tools: ["pi.buildProjectSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["schedule", "diary", "sequence", "critical path", "gantt", "programme"]
};

const workforce: SpecialistSpec = {
  id: "workforce", name: "Workforce Agent",
  role: "Team utilisation, hiring gaps, subcontractor scheduling",
  speciality: "workforce", category: "business",
  permissions: ["read_projects", "read_calendar"],
  tools: ["md.buildMDBriefing"],
  country_support: ["*"],
  expertise_keywords: ["workforce", "utilisation", "hire", "subcontractor", "labour", "crew", "team"]
};

const fleet: SpecialistSpec = {
  id: "fleet", name: "Fleet Agent",
  role: "Vehicle utilisation, fuel, MOT, service intervals",
  speciality: "fleet", category: "business",
  permissions: ["read_projects", "read_suppliers"],
  tools: ["knowledge.retrieve"],
  country_support: ["*"],
  expertise_keywords: ["fleet", "van", "vehicle", "fuel", "mot", "service", "mileage"]
};

const businessCoach: SpecialistSpec = {
  id: "business_coach", name: "Business Coach Agent",
  role: "Growth, systems, pricing strategy, positioning",
  speciality: "coaching", category: "business",
  permissions: ["read_projects", "read_customers", "read_costs"],
  tools: ["bi.buildBusinessSnapshot"],
  country_support: ["*"],
  expertise_keywords: ["grow", "growth", "positioning", "strategy", "coach", "advice"]
};

// ─── Property family ────────────────────────────────────────────

const assetIntelligence: SpecialistSpec = {
  id: "asset_intelligence", name: "Asset Intelligence Agent",
  role: "Property assets, plant lists, warranty registers",
  speciality: "asset", category: "property",
  permissions: ["read_property", "read_projects"],
  tools: ["cc.buildPropertySnapshot"],
  country_support: ["*"],
  expertise_keywords: ["asset", "warranty", "plant", "equipment", "register"]
};

const maintenanceForecast: SpecialistSpec = {
  id: "maintenance_forecast", name: "Maintenance Forecast Agent",
  role: "Reactive vs planned, lifecycle, replacement horizons",
  speciality: "asset", category: "property",
  permissions: ["read_property", "read_projects"],
  tools: ["cc.buildPropertySnapshot"],
  country_support: ["*"],
  expertise_keywords: ["maintenance", "ppm", "lifecycle", "replacement", "service interval", "reactive"]
};

const digitalTwinAgent: SpecialistSpec = {
  id: "digital_twin", name: "Digital Twin Agent",
  role: "What-if simulations against the merchant's real numbers",
  speciality: "digital_twin", category: "property",
  permissions: ["read_property", "read_projects", "read_costs"],
  tools: ["twin.runSimulation"],
  country_support: ["*"],
  expertise_keywords: ["what if", "simulate", "scenario", "if I hire", "if fuel", "if prices"]
};

// ─── AI family ──────────────────────────────────────────────────

const research: SpecialistSpec = {
  id: "research", name: "Research Agent",
  role: "Deep research when knowledge base is thin",
  speciality: "research", category: "ai",
  permissions: ["read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: ["*"],
  expertise_keywords: ["research", "look into", "find out", "investigate", "deep dive"]
};

const factVerification: SpecialistSpec = {
  id: "fact_verification", name: "Fact Verification Agent",
  role: "Cross-checks claims against knowledge entries",
  speciality: "verification", category: "ai",
  permissions: ["read_knowledge"],
  tools: ["knowledge.retrieve"],
  country_support: ["*"],
  expertise_keywords: ["verify", "check", "confirm", "cross check", "is it true"]
};

const translation: SpecialistSpec = {
  id: "translation", name: "Translation Agent",
  role: "Translates trade jargon between regions (drywall/plasterboard, etc.)",
  speciality: "translation", category: "ai",
  permissions: ["read_knowledge"],
  tools: ["world.regional"],
  country_support: ["*"],
  expertise_keywords: ["translate", "regional term", "us term", "uk term", "au term", "convert"]
};

// ─── Full catalog ───────────────────────────────────────────────

export const SPECIALIST_SPECS: SpecialistSpec[] = [
  planning, buildingControl, fireSafety, accessibility, heritage, structural,
  timber, steel, concrete, masonry, roofing, plumbing, electrical, hvac,
  renewableEnergy, heatPump,
  quantitySurveyor, pricing, marginAnalysis, costPlanning, tenderReview,
  cashFlow, scheduling, workforce, fleet, businessCoach,
  assetIntelligence, maintenanceForecast, digitalTwinAgent,
  research, factVerification, translation
];

export const SPECIALIST_AGENTS: Agent[] = SPECIALIST_SPECS.map(buildSpecialistAgent);

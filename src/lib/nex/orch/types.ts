// Nex Orchestrator — multi-agent coordination contracts.
//
// The merchant only ever talks to Nex. Behind the scenes the
// orchestrator picks 1–N specialist agents, runs them in the right
// order (parallel where independent, sequential where a later agent
// needs an earlier agent's output), then composes their replies into
// ONE answer in Nex's voice.
//
// Phase 24 expanded this from 10 agents → ~40 specialists (regulations,
// trades, commercial, business, property, AI families). New agents plug
// in via `catalog.ts` without changing framework code.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Agent identity + permissions ───────────────────────────────

export type AgentId =
  // Phase 15/19 (baseline 10)
  | "regulations"
  | "estimating"
  | "procurement"
  | "vision"
  | "sitebook"
  | "finance"
  | "marketing"
  | "customer"
  | "knowledge"
  | "property"
  // Phase 24 — regulations family
  | "planning"
  | "building_control"
  | "fire_safety"
  | "accessibility"
  | "heritage"
  | "structural"
  // Phase 24 — trades family
  | "timber"
  | "steel"
  | "concrete"
  | "masonry"
  | "roofing"
  | "plumbing"
  | "electrical"
  | "hvac"
  | "renewable_energy"
  | "heat_pump"
  // Phase 24 — commercial family
  | "quantity_surveyor"
  | "pricing"
  | "margin_analysis"
  | "cost_planning"
  | "tender_review"
  // Phase 24 — business family
  | "cash_flow"
  | "scheduling"
  | "workforce"
  | "fleet"
  | "business_coach"
  // Phase 24 — property family
  | "asset_intelligence"
  | "maintenance_forecast"
  | "digital_twin"
  // Phase 24 — AI family
  | "research"
  | "fact_verification"
  | "translation";

/** Category of data an agent may read. Every agent declares exactly
 *  the categories it needs. */
export type AgentPermission =
  | "read_projects"        // sitebook + project intel
  | "read_costs"           // per-project cost lines (finance-safe)
  | "read_customers"       // CRM
  | "read_reviews"         // network reviews
  | "read_marketing"       // social posts + daily metrics
  | "read_calendar"        // job diary
  | "read_products"        // marketplace catalogue
  | "read_suppliers"       // MD supplier profiles
  | "read_knowledge"       // knowledge engine
  | "read_regulations"     // regulations retriever (world/region-aware)
  | "read_photos"          // sitebook photos + vision
  | "read_property"        // construction cloud
  | "write_drafts";        // may prepare drafts (still gated by AB approval)

export type AgentSpeciality =
  | "regulations"
  | "estimating"
  | "procurement"
  | "vision"
  | "diary"
  | "finance"
  | "marketing"
  | "customer_care"
  | "knowledge"
  | "property"
  // Phase 24
  | "planning"
  | "building_control"
  | "fire_safety"
  | "accessibility"
  | "heritage"
  | "structural"
  | "trade_craft"
  | "renewables"
  | "cost_engineering"
  | "commercial"
  | "cash_flow"
  | "scheduling"
  | "workforce"
  | "fleet"
  | "coaching"
  | "asset"
  | "digital_twin"
  | "research"
  | "verification"
  | "translation";

/** High-level family grouping for the planner + explainer. */
export type AgentCategory =
  | "regulations"
  | "trades"
  | "commercial"
  | "business"
  | "property"
  | "ai";

/** ISO-3166 alpha-2 code, or "*" meaning "region-agnostic". */
export type CountryCode = "UK" | "IE" | "AU" | "US" | "CA" | "NZ" | "AE" | "*";

/** The Agent contract. Every registered agent MUST supply exactly
 *  these fields — permission audits are static across the registry. */
export type Agent = {
  id:            AgentId;
  name:          string;                // "Estimating Agent"
  role:          string;                // "Specialist in labour + materials pricing"
  speciality:    AgentSpeciality;
  category:      AgentCategory;
  permissions:   AgentPermission[];
  version:       string;                // e.g. "2026-07"
  /** The tools an agent may call. Never runs actions the caller
   *  hasn't approved via AB. */
  tools:         string[];              // e.g. ["est.buildEstimate", "mp.searchProducts"]
  /** Countries this agent is competent in. `["*"]` = works anywhere. */
  country_support: CountryCode[];
  /** Keywords the planner uses to detect when this agent is needed. */
  expertise_keywords: string[];
  /** Explicit boundary — what this agent DOES NOT do. Surfaces in
   *  conflict-resolution when an agent strays off-piste. */
  boundaries?:   string[];
  /** The engine invocation. Returns a single-source claim + evidence
   *  chain. Never throws — orchestrator swallows errors cleanly. */
  invoke:        (ctx: AgentInvocationContext) => Promise<AgentResult>;
};

export type AgentInvocationContext = {
  merchant_slug: string;
  /** The specific slice of the ask this agent should focus on. May be
   *  the whole ask (single-agent case) or a sub-ask carved out by the
   *  planner (compound case). */
  focus_ask:     string;
  /** Optional country hint from the ask or the merchant's profile. */
  country?:      CountryCode;
  /** Prior agent replies so a later agent can use earlier context.
   *  Never carries raw data across permission boundaries — only the
   *  serialised speak string + a small metadata object. */
  prior:         Array<{ agent_id: AgentId; speak: string; metadata?: Record<string, unknown> }>;
};

export type AgentResult = {
  agent_id:     AgentId;
  headline:     string;                 // one-line summary of what this agent found
  speak:        string;                 // the agent's full contribution (plain text)
  /** Small metadata for downstream agents (e.g. estimator passing a
   *  materials list to procurement). Never PII. */
  metadata?:    Record<string, unknown>;
  confidence:   "low" | "medium" | "high";
  evidence:     Evidence;
  /** When true the orchestrator flags this agent's output as an
   *  approval-required draft (routed to AB). */
  is_draft?:    boolean;
  /** True when the agent's finding cites an official regulation/standard.
   *  Conflict-resolution prefers this over general knowledge. */
  is_official?: boolean;
  error?:       string;
};

// ─── Plan + result ──────────────────────────────────────────────

export type PlanStep = {
  agent_id:  AgentId;
  focus_ask: string;
  /** Steps that must complete before this one runs. When empty, the
   *  step runs in the first parallel batch. */
  depends_on: AgentId[];
};

export type OrchestrationPlan = {
  ask:       string;
  steps:     PlanStep[];
  reason:    string;                    // "your ask asked for a price + supplier check + margin call"
};

export type OrchestrationResult = {
  ask:            string;
  plan:           OrchestrationPlan;
  /** Every agent that contributed, in execution order. Errors are
   *  surfaced not hidden. */
  contributions:  AgentResult[];
  /** The composed "I checked:" trail. */
  explanation:    string;
  /** The merchant-facing one-block reply. */
  speak:          string;
  errors:         Array<{ agent_id: AgentId; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

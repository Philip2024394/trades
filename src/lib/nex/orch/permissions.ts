// Permission enforcement — static audit + runtime check.
//
// Every agent declares its permissions in the registry. The
// orchestrator refuses to invoke an agent for a task requiring a
// permission it doesn't hold. This is a belt-and-braces check on top
// of the underlying engine's own gating.
//
// Phase 24 added ~30 specialist agents. Most are knowledge-backed and
// require only `read_knowledge` (+ occasionally `read_regulations` or
// `read_products`). Complex specialists (QS, cost_planning, digital_twin)
// need the same category set as their non-specialist ancestors.

import type { Agent, AgentId, AgentPermission } from "./types";

/** Which permissions each speciality REQUIRES (never more, never less).
 *  Registered agents must match this exactly — auditRegistry() reports
 *  drift at boot. */
export const REQUIRED_PERMISSIONS: Record<AgentId, AgentPermission[]> = {
  // Baseline 10
  regulations:  ["read_regulations", "read_knowledge"],
  estimating:   ["read_projects", "read_products", "read_knowledge"],
  procurement:  ["read_products", "read_suppliers"],
  vision:       ["read_photos"],
  sitebook:     ["read_projects", "read_photos"],
  finance:      ["read_projects", "read_costs"],
  marketing:    ["read_marketing", "read_customers", "write_drafts"],
  customer:     ["read_customers", "read_projects", "write_drafts"],
  knowledge:    ["read_knowledge"],
  property:     ["read_property", "read_projects", "read_photos"],

  // Regulations family — read_regulations + knowledge
  planning:         ["read_regulations", "read_knowledge"],
  building_control: ["read_regulations", "read_knowledge"],
  fire_safety:      ["read_regulations", "read_knowledge"],
  accessibility:    ["read_regulations", "read_knowledge"],
  heritage:         ["read_regulations", "read_knowledge"],
  structural:       ["read_regulations", "read_knowledge"],

  // Trades family — knowledge + products (for materials guidance)
  timber:           ["read_knowledge", "read_products"],
  steel:            ["read_knowledge", "read_products"],
  concrete:         ["read_knowledge", "read_products"],
  masonry:          ["read_knowledge", "read_products"],
  roofing:          ["read_knowledge", "read_products"],
  plumbing:         ["read_knowledge", "read_products"],
  electrical:       ["read_knowledge", "read_products"],
  hvac:             ["read_knowledge", "read_products"],
  renewable_energy: ["read_knowledge", "read_products"],
  heat_pump:        ["read_knowledge", "read_products"],

  // Commercial family
  quantity_surveyor: ["read_projects", "read_products", "read_costs", "read_knowledge"],
  pricing:           ["read_products", "read_suppliers"],
  margin_analysis:   ["read_projects", "read_costs"],
  cost_planning:     ["read_projects", "read_costs", "read_products"],
  tender_review:     ["read_projects", "read_knowledge"],

  // Business family
  cash_flow:      ["read_projects", "read_costs"],
  scheduling:     ["read_projects", "read_calendar"],
  workforce:      ["read_projects", "read_calendar"],
  fleet:          ["read_projects", "read_suppliers"],
  business_coach: ["read_projects", "read_customers", "read_costs"],

  // Property family
  asset_intelligence:   ["read_property", "read_projects"],
  maintenance_forecast: ["read_property", "read_projects"],
  digital_twin:         ["read_property", "read_projects", "read_costs"],

  // AI family
  research:          ["read_knowledge"],
  fact_verification: ["read_knowledge"],
  translation:       ["read_knowledge"]
};

export type AuditFinding = {
  agent_id: AgentId;
  problem:  "missing_permission" | "excess_permission" | "unregistered";
  detail:   string;
};

/** Static check — every agent's declared permissions must match
 *  REQUIRED_PERMISSIONS exactly. Returns [] when clean. */
export function auditRegistry(agents: Agent[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const a of agents) {
    const required = REQUIRED_PERMISSIONS[a.id];
    if (!required) {
      findings.push({ agent_id: a.id, problem: "unregistered", detail: "no REQUIRED_PERMISSIONS entry" });
      continue;
    }
    const requiredSet = new Set(required);
    const declared = new Set(a.permissions);
    for (const perm of requiredSet) {
      if (!declared.has(perm)) findings.push({ agent_id: a.id, problem: "missing_permission", detail: perm });
    }
    for (const perm of declared) {
      if (!requiredSet.has(perm)) findings.push({ agent_id: a.id, problem: "excess_permission", detail: perm });
    }
  }
  return findings;
}

/** Runtime check — before invoking an agent for a task-specific
 *  permission, verify the agent holds it. */
export function canAgentPerform(agent: Agent, needed: AgentPermission): boolean {
  return agent.permissions.includes(needed);
}

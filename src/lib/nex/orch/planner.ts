// Planner — turn a compound ask into an OrchestrationPlan.
//
// Phase 15/19: baseline 10 agents matched via hand-tuned regexes.
// Phase 24: ~40 specialists — the planner now walks
// `AGENTS[i].expertise_keywords` and matches on keyword hits, then
// layers the hand-tuned shapes on top for well-known compound asks.

import { AGENTS } from "./registry";
import type { AgentId, OrchestrationPlan, PlanStep } from "./types";

/** Legacy hand-tuned regex mappings for the baseline 10 — kept because
 *  they capture nuances (e.g. "part [a-z]" for regulations) that plain
 *  keyword matching would miss. */
const LEGACY_KEYWORDS: Array<{ agent: AgentId; re: RegExp }> = [
  { agent: "regulations", re: /\b(regulations?|regs?|compliance|part\s+[a-z]|building\s+regs)\b/i },
  { agent: "estimating",  re: /\b(price|quote|estimate|labour|material\s+cost|margin|profit)\b/i },
  { agent: "procurement", re: /\b(supplier|buy|source|delivery|stock|catalogue|catalog)\b/i },
  { agent: "vision",      re: /\b(photo|image|drawing|damage|defect|snap|picture)\b/i },
  { agent: "sitebook",    re: /\b(site\s+diary|snag|photo\s+diary|daily\s+log)\b/i },
  { agent: "finance",     re: /\b(cash\s?flow|revenue|profit\s+report|vat|overdue|invoice)\b/i },
  { agent: "marketing",   re: /\b(post|marketing|facebook|instagram|tiktok|campaign|social)\b/i },
  { agent: "customer",    re: /\b(customer|homeowner|remind|appointment|follow[- ]up|message)\b/i },
  { agent: "knowledge",   re: /\b(research|guide|advice|how\s+to|installation)\b/i },
  { agent: "property",    re: /\b(property|passport|building\s+passport|address|house\s+history)\b/i }
];

/** Common dependencies. New specialists mostly stand alone. */
const DEPS: Partial<Record<AgentId, AgentId[]>> = {
  estimating:        ["procurement"],
  finance:           ["estimating"],
  customer:          ["estimating"],
  quantity_surveyor: ["estimating"],
  cost_planning:     ["estimating"],
  margin_analysis:   ["finance"],
  cash_flow:         ["finance"]
};

export function planForAsk(ask: string): OrchestrationPlan {
  const t = ask.toLowerCase();
  const agents = new Set<AgentId>();

  // 1. Legacy direct regex matches (baseline 10).
  for (const { agent, re } of LEGACY_KEYWORDS) if (re.test(t)) agents.add(agent);

  // 2. Specialist keyword matches (Phase 24 — 30 agents).
  for (const a of AGENTS) {
    // Legacy agents already handled above.
    if (LEGACY_KEYWORDS.some((k) => k.agent === a.id)) continue;
    for (const kw of a.expertise_keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(t)) { agents.add(a.id); break; }
    }
  }

  // 3. Shape-driven adds. Familiar compound asks pull the same crew.
  //    "quote this / price this X" → estimator + procurement + finance + customer
  if (/\bquote\s+(this|my|the)\b|\bprice\s+(this|my|the)\b/.test(t)) {
    agents.add("estimating"); agents.add("procurement"); agents.add("finance"); agents.add("customer");
  }
  //    "organise / plan / prepare next project" → estimator + procurement + sitebook + customer
  if (/\borganise\s+.+project\b|\bplan\s+.+project\b|\bprepare\s+.+project\b|\bstarting\s+.+(next\s+monday|next\s+week)\b/.test(t)) {
    agents.add("estimating"); agents.add("procurement"); agents.add("sitebook"); agents.add("customer");
  }
  //    "plan my week" → sitebook + customer + procurement + scheduling
  if (/\bplan\s+my\s+(week|day)\b/.test(t)) {
    agents.add("sitebook"); agents.add("customer"); agents.add("procurement"); agents.add("scheduling");
  }
  //    "shopping list" → procurement
  if (/\bshopping\s+list\b/.test(t)) agents.add("procurement");

  //    Load-bearing wall / knock through — full construction team.
  if (/\bload[- ]?bearing\b|\bremove\s+(this|a)\s+wall\b|\bknock\s+(through|down)\b/.test(t)) {
    agents.add("structural"); agents.add("building_control"); agents.add("regulations");
    agents.add("fire_safety"); agents.add("estimating"); agents.add("planning");
  }
  //    Loft conversion — regs + structural + heat + fire + estimator + qs
  if (/\bloft\s+conversion\b|\bloft\s+conv\b/.test(t)) {
    agents.add("planning"); agents.add("building_control"); agents.add("structural");
    agents.add("fire_safety"); agents.add("estimating"); agents.add("quantity_surveyor");
  }
  //    Heat pump — renewables + planning + regs + electrical + heat_pump
  if (/\bheat\s+pump\b|\bashp\b|\bgshp\b/.test(t)) {
    agents.add("heat_pump"); agents.add("renewable_energy"); agents.add("planning");
    agents.add("electrical"); agents.add("building_control");
  }
  //    Listed building — heritage + planning + building_control
  if (/\blisted\s+building\b|\bgrade\s+(i|ii)\b|\bconservation\s+area\b/.test(t)) {
    agents.add("heritage"); agents.add("planning"); agents.add("building_control");
  }

  if (agents.size === 0) {
    return {
      ask,
      steps:  [],
      reason: "The planner didn't match any compound shape — the caller should fall back to the single-agent intent classifier."
    };
  }

  // 4. Build steps with dependencies (only those that survive filtering).
  const steps: PlanStep[] = Array.from(agents).map((agent) => ({
    agent_id:   agent,
    focus_ask:  focusFor(agent, ask),
    depends_on: (DEPS[agent] ?? []).filter((d) => agents.has(d))
  }));

  return {
    ask,
    steps,
    reason: describePlan(ask, agents)
  };
}

function focusFor(agent: AgentId, ask: string): string {
  // For now every agent focuses on the whole ask. A future upgrade
  // could carve sub-asks (e.g. "materials only" vs "labour only") per
  // agent.
  void agent;
  return ask;
}

function describePlan(ask: string, agents: Set<AgentId>): string {
  const list = Array.from(agents).join(", ");
  return `Ask "${ask}" spans multiple specialities — coordinating: ${list}.`;
}

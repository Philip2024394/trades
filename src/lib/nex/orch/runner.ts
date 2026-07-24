// Runner — execute an OrchestrationPlan.
//
// Topological-sort steps by dependency, then run each level in
// parallel. Errors from a single agent don't kill the plan — they
// surface on OrchestrationResult.errors.

import { getAgent } from "./registry";
import type { AgentId, AgentResult, OrchestrationPlan, OrchestrationResult, PlanStep } from "./types";

export type RunPlanInput = {
  merchant_slug: string;
  plan:          OrchestrationPlan;
};

export async function runPlan(input: RunPlanInput): Promise<OrchestrationResult> {
  const plan = input.plan;
  const levels = topoLevels(plan.steps);

  const contributions: AgentResult[] = [];
  const errors: OrchestrationResult["errors"] = [];
  const bag = new Map<AgentId, AgentResult>();

  for (const level of levels) {
    const priorArr = Array.from(bag.values()).map((r) => ({
      agent_id: r.agent_id, speak: r.speak, metadata: r.metadata
    }));
    const results = await Promise.all(level.map(async (step) => {
      const agent = getAgent(step.agent_id);
      if (!agent) {
        return {
          agent_id: step.agent_id, headline: "unknown agent", speak: "",
          confidence: "low" as const,
          evidence:   { source: "runner", tables: [], computed_at: new Date().toISOString() },
          error:      `agent ${step.agent_id} not in registry`
        };
      }
      try {
        return await agent.invoke({
          merchant_slug: input.merchant_slug,
          focus_ask:     step.focus_ask,
          prior:         priorArr
        });
      } catch (err) {
        return {
          agent_id: step.agent_id, headline: "error", speak: "",
          confidence: "low" as const,
          evidence:   { source: "runner", tables: [], computed_at: new Date().toISOString() },
          error:      err instanceof Error ? err.message : String(err)
        };
      }
    }));
    for (const r of results) {
      contributions.push(r);
      if (r.error) errors.push({ agent_id: r.agent_id, error: r.error });
      else bag.set(r.agent_id, r);
    }
  }

  return {
    ask:           plan.ask,
    plan,
    contributions,
    explanation:   buildExplanation(contributions),
    speak:         compose(contributions),
    errors
  };
}

/** Group steps into levels so all steps at level i can run in
 *  parallel and every step at level i+1 has its deps at earlier
 *  levels. */
function topoLevels(steps: PlanStep[]): PlanStep[][] {
  const remaining = new Map<AgentId, PlanStep>();
  for (const s of steps) remaining.set(s.agent_id, s);
  const done = new Set<AgentId>();
  const levels: PlanStep[][] = [];

  let guard = 0;
  while (remaining.size > 0) {
    if (++guard > 100) break;   // cycle guard — shouldn't hit in real plans
    const ready = Array.from(remaining.values()).filter((s) => s.depends_on.every((d) => done.has(d) || !remaining.has(d)));
    if (ready.length === 0) {
      // Break the cycle — fire everything remaining as one level.
      levels.push(Array.from(remaining.values()));
      break;
    }
    levels.push(ready);
    for (const r of ready) { done.add(r.agent_id); remaining.delete(r.agent_id); }
  }
  return levels;
}

function buildExplanation(contributions: AgentResult[]): string {
  if (contributions.length === 0) return "";
  const labels = contributions.map((c) => nameOf(c.agent_id));
  return `I checked: ${labels.join(", ")}.`;
}

function compose(contributions: AgentResult[]): string {
  if (contributions.length === 0) return "";
  const lines: string[] = [];
  for (const c of contributions) {
    if (c.error) {
      lines.push(`- ${nameOf(c.agent_id)}: (unavailable — ${c.error})`);
    } else {
      lines.push(`- ${nameOf(c.agent_id)}: ${c.headline} (confidence: ${c.confidence})`);
    }
  }
  return lines.join("\n");
}

function nameOf(id: AgentId): string {
  // Baseline 10 use polished labels; the 30 Phase-24 specialists fall
  // back to a title-cased version of their id.
  const legacy: Partial<Record<AgentId, string>> = {
    regulations: "Regulations",
    estimating:  "Estimating",
    procurement: "Procurement",
    vision:      "Vision",
    sitebook:    "SiteBook",
    finance:     "Finance",
    marketing:   "Marketing",
    customer:    "Customer",
    knowledge:   "Knowledge",
    property:    "Property"
  };
  if (legacy[id]) return legacy[id]!;
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Orchestrator top-level answer function.
//
// Merchant asks Nex → planner picks agents → runner executes →
// composed reply with an "I checked:" trail.

import { planForAsk } from "./planner";
import { runPlan } from "./runner";
import type { OrchestrationResult } from "./types";

export type OrchestrateInput = {
  merchant_slug: string;
  ask:           string;
};

export async function orchestrate(input: OrchestrateInput): Promise<OrchestrationResult> {
  const plan = planForAsk(input.ask);
  return runPlan({ merchant_slug: input.merchant_slug, plan });
}

/** Returns true if the ask is "compound" enough to warrant the
 *  orchestrator. Single-agent asks should route via the existing
 *  intent classifier for a cleaner reply. */
export function isCompoundAsk(text: string): boolean {
  const plan = planForAsk(text);
  return plan.steps.length >= 2;
}

/** Format the orchestrator output as a merchant-facing reply. */
export function formatOrchestration(res: OrchestrationResult): string {
  const lines: string[] = [];
  if (res.plan.steps.length === 0) return "";
  lines.push(res.explanation);
  lines.push("");
  lines.push(res.speak);
  if (res.errors.length > 0) {
    lines.push("");
    lines.push("Agents that couldn't respond this time:");
    for (const e of res.errors) lines.push(`- ${e.agent_id}: ${e.error}`);
  }
  lines.push("");
  lines.push("Ask about any specialist above (e.g. 'finance nex, how's cash flow?') and I'll dive deeper.");
  return lines.join("\n");
}

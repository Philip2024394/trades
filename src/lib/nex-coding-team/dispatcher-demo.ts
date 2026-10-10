// NEX Coding Team · Demo/stub Dispatcher
// Deterministic stub that satisfies the AgentDispatcher contract without calling
// any LLM. Used by the dispatch API to smoke-test the pipeline mechanics
// (permissions · state · logging · artifact write · gate aggregation) without
// spending LLM tokens or requiring Founder-authorised model access.
//
// It emits tiny, honest artifacts labelled `[STUB]` so no one confuses them
// with real agent output. Verdicts are always APPROVE unless an intentional
// failure token is present in the founder prompt (used by pipeline regression tests).

import type { AgentDispatcher, AgentDispatchInput, AgentDispatchOutput } from "./runtime";
import { safeWrite } from "./safe-write";

/**
 * Force a specific verdict for a specific agent by embedding a marker in the
 * founder prompt. Only intended for pipeline-mechanic regression tests.
 * Example: `Founder prompt goes here #FORCE_VERDICT:reviewer=REJECT`
 */
function forcedVerdictFor(agent_id: string, founder_prompt: string): AgentDispatchOutput["verdict"] | null {
  const marker = new RegExp(`#FORCE_VERDICT:${agent_id}=([A-Z_]+)`);
  const m = founder_prompt.match(marker);
  if (!m || !m[1]) return null;
  const v = m[1];
  const allowed: AgentDispatchOutput["verdict"][] = [
    "APPROVE",
    "APPROVE_WITH_NOTES",
    "REJECT",
    "FLAG",
    "NEEDS_FOUNDER_INPUT",
    "ERROR",
    "SKIPPED_NOT_APPLICABLE",
  ];
  return (allowed as string[]).includes(v) ? (v as AgentDispatchOutput["verdict"]) : null;
}

export const DEMO_DISPATCHER: AgentDispatcher = {
  async dispatch(input: AgentDispatchInput): Promise<AgentDispatchOutput> {
    const { run_id, agent_id, context, artifact_write_target } = input;
    const forced = forcedVerdictFor(agent_id, context.founder_prompt);
    const verdict: AgentDispatchOutput["verdict"] = forced ?? "APPROVE";
    const body = [
      `# ${agent_id} · demo artifact [STUB]`,
      ``,
      `_This is a deterministic stub emitted by the demo dispatcher._`,
      `_The real coding-team pipeline delegates dispatch to Claude Code sub-agents_`,
      `_or NEX1's autonomous runtime. This artifact exists only to prove that_`,
      `_the pipeline mechanics (permissions · state · logging · aggregation) work._`,
      ``,
      `## Inputs seen`,
      `- founder_prompt (first 200 chars): \`${context.founder_prompt.slice(0, 200).replace(/[`\n]/g, " ")}\``,
      `- ticket_md present: ${context.ticket_md !== undefined}`,
      `- spec_md present: ${context.spec_md !== undefined}`,
      `- prior verdicts count: ${Object.values(context.prior_verdicts).filter(Boolean).length}`,
      ``,
      `## Verdict`,
      `- **${verdict}**`,
      ``,
      `## Truth-taxonomy discipline`,
      `- [FACT] this is a stub; no real analysis performed.`,
      `- [DECISION] pipeline continues per plan when verdict = APPROVE.`,
      `- [HYPOTHESIS] the real dispatcher (Claude Code / NEX1) will produce meaningful analysis.`,
      `- [PROPOSAL] swap this dispatcher for a real one in production; see \`runtime.ts\` AgentDispatcher contract.`,
      ``,
    ].join("\n");
    const wr = safeWrite(run_id, agent_id, artifact_write_target, body);
    return {
      verdict,
      summary: `[STUB] ${agent_id} produced ${wr.ok ? "artifact" : "no artifact"}: ${wr.reason ?? "OK"}`,
      evidence: wr.ok ? [wr.target_rel ?? ""] : [],
      blockers: verdict === "APPROVE" || verdict === "APPROVE_WITH_NOTES" || verdict === "SKIPPED_NOT_APPLICABLE" ? [] : [`stub ${verdict}`],
      next_action: null,
      artifact_relpath: wr.target_rel,
    };
  },
};

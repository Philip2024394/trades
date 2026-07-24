// Mesh — Phase 24 top-level multi-agent orchestrator.
//
// The mesh is what merchants effectively talk to when their ask spans
// multiple specialities. Steps:
//
//   1. Plan       — planForAsk() picks the specialist set.
//   2. Route      — country hint attached, agents filtered by country
//                   support (agents that don't cover the region are
//                   dropped and their concern is flagged for research).
//   3. Execute    — parallel Promise.all + level-based topo order.
//   4. Merge      — voice.composeNexReply() unifies to one voice.
//   5. Resolve    — confidence.detectConflicts / resolveConflict.
//   6. Explain    — explain() available on request.
//
// The mesh never mutates state, never persists anything, never sends
// messages. Everything it does is read + reason.

import { planForAsk } from "./planner";
import { getAgent } from "./registry";
import {
  detectConflicts,
  resolveConflict,
  rollupConfidence,
  type Conflict
} from "./confidence";
import { composeNexReply } from "./voice";
import { explain as buildExplain } from "./explain";
import type {
  AgentId,
  AgentResult,
  CountryCode,
  OrchestrationPlan,
  PlanStep
} from "./types";
import { evidenceFor } from "./types";

export type MeshInput = {
  merchant_slug: string;
  ask:           string;
  /** Country hint from merchant profile or the ask text. Defaults to UK
   *  (Thenetworkers home region). */
  country?:      CountryCode;
};

export type MeshResult = {
  ask:                string;
  plan:               OrchestrationPlan;
  contributions:      AgentResult[];
  conflicts:          Conflict[];
  overall_confidence: "low" | "medium" | "high";
  official_cited:     boolean;
  /** Merchant-facing reply — Nex voice, no agent names. */
  speak:              string;
  /** On-demand internal trace. Only shown when the merchant asks. */
  explain:            string;
  errors:             Array<{ agent_id: AgentId; error: string }>;
};

const DEFAULT_COUNTRY: CountryCode = "UK";

/** Full mesh run — plan + parallel invoke + merge + voice + explain. */
export async function runMesh(input: MeshInput): Promise<MeshResult> {
  const country = input.country ?? DEFAULT_COUNTRY;
  const plan = planForAsk(input.ask);
  const contributions: AgentResult[] = [];
  const errors: MeshResult["errors"] = [];

  if (plan.steps.length === 0) {
    return {
      ask: input.ask, plan, contributions: [], conflicts: [],
      overall_confidence: "low", official_cited: false,
      speak:   "I need a bit more to work with. Give me more of the picture and I'll assemble the right specialists.",
      explain: buildExplain({ ask: input.ask, contributions: [], conflicts: [], overall_confidence: "low" }),
      errors
    };
  }

  // Topo-levels — steps at level i can run in parallel; level i+1 sees
  // level i's results in `prior`.
  const levels = topoLevels(plan.steps);
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
          evidence:   evidenceFor("mesh runner", []),
          error:      `agent ${step.agent_id} not in registry`
        };
      }
      // Country gating — if the agent doesn't cover this region, skip
      // with a research-flag rather than invoking blind.
      const covers = agent.country_support.includes("*") || agent.country_support.includes(country);
      if (!covers) {
        return {
          agent_id: step.agent_id,
          headline: `${agent.name} doesn't cover ${country} yet.`,
          speak:    `${agent.name} doesn't cover ${country} yet — flagged for research.`,
          confidence: "low" as const,
          evidence: evidenceFor("mesh runner · country gating", []),
          metadata: { skipped_country: country }
        };
      }
      try {
        return await agent.invoke({
          merchant_slug: input.merchant_slug,
          focus_ask:     step.focus_ask,
          country,
          prior:         priorArr
        });
      } catch (err) {
        return {
          agent_id: step.agent_id, headline: "error", speak: "",
          confidence: "low" as const,
          evidence:   evidenceFor("mesh runner", []),
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

  // Post-processing — dedupe, detect conflicts, roll up confidence.
  const conflicts = detectConflicts(contributions);
  const resolved  = applyConflictPreferences(contributions, conflicts);
  const overall   = rollupConfidence(resolved);
  const official  = resolved.some((r) => r.is_official && !r.error);
  const speak     = composeNexReply({
    contributions: resolved,
    conflicts,
    overall_confidence: overall,
    official_cited:     official
  });
  const explainText = buildExplain({
    ask:                input.ask,
    contributions:      contributions,
    conflicts,
    overall_confidence: overall
  });

  return {
    ask:                input.ask,
    plan,
    contributions,
    conflicts,
    overall_confidence: overall,
    official_cited:     official,
    speak,
    explain:            explainText,
    errors
  };
}

/** For each conflict pair, if resolvable, drop the runner-up from the
 *  visible reply. Ties keep both. */
function applyConflictPreferences(contributions: AgentResult[], conflicts: Conflict[]): AgentResult[] {
  if (conflicts.length === 0) return contributions;
  const drop = new Set<AgentId>();
  for (const c of conflicts) {
    const res = resolveConflict(c);
    if (res.is_tie || !res.runner_up) continue;
    drop.add(res.runner_up.agent_id);
  }
  if (drop.size === 0) return contributions;
  return contributions.filter((r) => !drop.has(r.agent_id));
}

/** Group steps into levels so all steps at level i can run in parallel
 *  and every step at level i+1 has its deps at earlier levels. */
function topoLevels(steps: PlanStep[]): PlanStep[][] {
  const remaining = new Map<AgentId, PlanStep>();
  for (const s of steps) remaining.set(s.agent_id, s);
  const done = new Set<AgentId>();
  const levels: PlanStep[][] = [];

  let guard = 0;
  while (remaining.size > 0) {
    if (++guard > 100) break;
    const ready = Array.from(remaining.values()).filter((s) => s.depends_on.every((d) => done.has(d) || !remaining.has(d)));
    if (ready.length === 0) {
      levels.push(Array.from(remaining.values()));
      break;
    }
    levels.push(ready);
    for (const r of ready) { done.add(r.agent_id); remaining.delete(r.agent_id); }
  }
  return levels;
}

// ─── Entry-point wrapper for the chat route ─────────────────────

export type AnswerMeshInput = {
  merchant_slug: string;
  ask:           string;
  country?:      CountryCode;
  /** When true, include the internal trace in the reply (append after
   *  the Nex-voice reply). */
  reveal_trace?: boolean;
};

export type AnswerMeshResult = {
  speak:   string;
  reveal?: string;
  data:    MeshResult;
};

export async function answerMesh(input: AnswerMeshInput): Promise<AnswerMeshResult> {
  const mesh = await runMesh({
    merchant_slug: input.merchant_slug,
    ask:           input.ask,
    country:       input.country
  });
  return {
    speak:  mesh.speak,
    reveal: input.reveal_trace ? mesh.explain : undefined,
    data:   mesh
  };
}

/** Returns true when the ask asks Nex to open the hood. */
const REVEAL_RE = /\b(how did you|why did you|show your working|explain your|open the hood|who did you check)\b/i;
export function asksForExplanation(ask: string): boolean {
  return REVEAL_RE.test(ask);
}

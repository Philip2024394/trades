// src/lib/nex/research-brain/plan-worker.ts
//
// Founder Path A · Phase A2 · Plan Worker.
//
// Decomposes a ResearchObjective into a ResearchPlan (sub-questions
// with dependencies). Composition-first: deterministic decomposition
// via heuristic patterns for the common cases; LLM fallback disabled
// by default (a future BEGIN can wire it via existing rescue provider).

import type { ResearchObjective, ResearchPlan, ResearchStep } from "./contract";
import { makePlanId } from "./contract";

const MAX_STEPS = 6;

/** Deterministic plan patterns · ordered · first match wins. */
const PATTERNS: Array<{
  name: string;
  matches: (obj: string) => boolean;
  build: (obj: string) => ResearchStep[];
}> = [
  // "compare X and Y" → two lookup steps + one synthesis step
  {
    name: "comparison",
    matches: (o) => /\b(compare|vs\.?|versus|difference between)\b/i.test(o),
    build: (o) => {
      const m = o.match(/\b(?:compare|vs\.?|versus|difference between)\s+(.+?)\s+(?:and|vs\.?|versus|to)\s+(.+?)(?:\?|$|\.)/i);
      if (m) {
        return [
          { step_id: "s1", question: `What are the key facts about ${m[1].trim()}?`, reason: "left-hand entity lookup" },
          { step_id: "s2", question: `What are the key facts about ${m[2].trim()}?`, reason: "right-hand entity lookup" },
          { step_id: "s3", question: `Compare ${m[1].trim()} and ${m[2].trim()} on the shared attributes.`, reason: "comparison synthesis", depends_on: ["s1", "s2"] },
        ];
      }
      return [{ step_id: "s1", question: o, reason: "comparison_pattern_no_split" }];
    },
  },
  // "how many X in Y" → single count query
  {
    name: "count",
    matches: (o) => /\bhow many\b/i.test(o),
    build: (o) => [{ step_id: "s1", question: o, reason: "single_count_query" }],
  },
  // "list X in Y" · "what are the X" → single listing query
  {
    name: "list",
    matches: (o) => /\b(list|what are the|which are the|show me)\b/i.test(o),
    build: (o) => [{ step_id: "s1", question: o, reason: "single_list_query" }],
  },
  // "why does X" · "why is X" → 2-step (definition + explanation)
  {
    name: "why",
    matches: (o) => /\bwhy (does|is|are|do|did|will|would)\b/i.test(o),
    build: (o) => {
      const subject = o.replace(/^why\s+(does|is|are|do|did|will|would)\s+/i, "").replace(/\?$/, "").trim();
      return [
        { step_id: "s1", question: `What is ${subject}?`, reason: "define subject" },
        { step_id: "s2", question: o, reason: "answer the why", depends_on: ["s1"] },
      ];
    },
  },
  // "what is X" · "who is X" · single lookup
  {
    name: "definition",
    matches: (o) => /^\s*(what|who|when|where) (is|are|was|were)\b/i.test(o),
    build: (o) => [{ step_id: "s1", question: o, reason: "single_definition_lookup" }],
  },
  // "michelin star" · "rating" · "review" · anecdotal · needs corroboration
  {
    name: "corroboration",
    matches: (o) => /\b(michelin|award|rating|reviews?|opinion|reputation|history)\b/i.test(o),
    build: (o) => [
      { step_id: "s1", question: o, reason: "primary source lookup" },
      { step_id: "s2", question: `${o} · corroborating source`, reason: "corroboration", depends_on: ["s1"] },
    ],
  },
];

export interface PlanWorkerOptions {
  /** Cap on total steps · overrides pattern output if larger. */
  max_steps?: number;
}

/**
 * Build a ResearchPlan from an objective. Deterministic first · falls
 * back to a single-step passthrough when no pattern matches. No LLM.
 */
export function planResearch(
  objective: ResearchObjective,
  opts: PlanWorkerOptions = {},
): ResearchPlan {
  const t0 = performance.now();
  const max = Math.min(opts.max_steps ?? MAX_STEPS, MAX_STEPS);

  let steps: ResearchStep[] = [];
  let method: ResearchPlan["method"] = "deterministic";

  for (const pat of PATTERNS) {
    if (pat.matches(objective.objective)) {
      steps = pat.build(objective.objective);
      break;
    }
  }
  if (steps.length === 0) {
    // Honest fallback · single-step passthrough.
    steps = [{ step_id: "s1", question: objective.objective, reason: "no_pattern_match" }];
    method = "single_step";
  }

  // Depth cap: deeper plans get truncated; shallower plans keep all steps.
  const capForDepth = Math.min(objective.depth * 2, max);
  if (steps.length > capForDepth) {
    steps = steps.slice(0, capForDepth);
  }

  return {
    plan_id: makePlanId(objective.objective),
    objective: objective.objective,
    steps,
    method,
    planner_ms: Math.round(performance.now() - t0),
  };
}

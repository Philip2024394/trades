// src/lib/nex/master-ai/research-priority.ts
//
// NEX Master AI Engineer · Research Prioritisation (§10)
// Philip 2026-09-07 · AUTHORIZE
//
// Deterministic priority score that exposes its reasoning. Never a
// black-box number. The formula is:
//
//   score = (impact * urgency * confidence_in_signal *
//            log2(1 + recurrence) * expected_benefit)
//          / (cost * risk * complexity)
//
// clamped so no factor becomes zero. All 8 factors are stored on the
// record so the reasoning is transparent.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { researchPrioritiesPath } from "./paths";
import type { ResearchPriorityScore } from "./types";

function clamp1to10(n: number): number { return Math.max(1, Math.min(10, n)); }
function clampNonNeg(n: number): number { return Math.max(0, n); }

export function computePriority(input: {
  question: string;
  driver: ResearchPriorityScore["driver"];
  components: Partial<ResearchPriorityScore["components"]>;
}): ResearchPriorityScore {
  const components: ResearchPriorityScore["components"] = {
    impact:              clamp1to10(input.components.impact ?? 5),
    urgency:             clamp1to10(input.components.urgency ?? 5),
    confidence_in_signal: clamp1to10(input.components.confidence_in_signal ?? 5),
    recurrence_count:    clampNonNeg(input.components.recurrence_count ?? 0),
    expected_benefit:    clamp1to10(input.components.expected_benefit ?? 5),
    cost_estimate:       clamp1to10(input.components.cost_estimate ?? 5),
    risk_estimate:       clamp1to10(input.components.risk_estimate ?? 5),
    complexity_estimate: clamp1to10(input.components.complexity_estimate ?? 5),
  };
  const numerator =
    components.impact
    * components.urgency
    * components.confidence_in_signal
    * Math.log2(1 + components.recurrence_count + 1)  // +1 so recurrence=0 doesn't wipe score
    * components.expected_benefit;
  const denominator =
    components.cost_estimate
    * components.risk_estimate
    * components.complexity_estimate;
  const score = Math.round((numerator / denominator) * 100) / 100;
  const reasoning = `(impact${components.impact}*urgency${components.urgency}*conf${components.confidence_in_signal}*log2(1+rec${components.recurrence_count}+1)*benefit${components.expected_benefit})/(cost${components.cost_estimate}*risk${components.risk_estimate}*complexity${components.complexity_estimate})=${score}`;
  const record: ResearchPriorityScore = {
    score_id: randomUUID(),
    question: input.question,
    driver: input.driver,
    components,
    score,
    reasoning,
    computed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(researchPrioritiesPath(), record);
  return record;
}

export function readAllPriorities(): ResearchPriorityScore[] {
  return readJsonlAll<ResearchPriorityScore>(researchPrioritiesPath());
}

/** Rank all priorities by score (highest first). */
export function rankPriorities(): ResearchPriorityScore[] {
  return [...readAllPriorities()].sort((a, b) => b.score - a.score);
}

export function _resetPrioritiesForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(researchPrioritiesPath())) fs.unlinkSync(researchPrioritiesPath()); } catch { /* ignore */ }
}

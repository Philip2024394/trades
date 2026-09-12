// src/lib/nex/master-ai/task-complexity-classification.ts
//
// NEX Master AI · Task Complexity Classification (World-First §1)
// Philip 2026-09-07 · AUTHORIZE
//
// Classify any incoming task across 8 dimensions and produce a
// deterministic composite complexity score. Master AI uses this to
// decide bounded execution parameters, escalation to Founder, and
// research depth.
//
// PRESERVATION:
//   · Deterministic · same inputs → identical score
//   · Every dimension 0-10 with rationale
//   · Composite verdict TRIVIAL / MODERATE / COMPLEX / EXTREME / UNKNOWN
//   · UNKNOWN when < 3 dimensions have evidence · never fabricates

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { taskComplexityClassificationsPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// 8 complexity dimensions
// ═════════════════════════════════════════════════════════════════════

export type ComplexityDimension = {
  score: number;                                    // 0..10 (0 = trivial · 10 = extreme)
  rationale: string;                                // required ≥ 5 chars OR "UNKNOWN"
  evidence_present: boolean;                        // false when this dimension is UNKNOWN
};

export type EightDimensions = {
  novelty: ComplexityDimension;                     // is this new territory?
  dependencies: ComplexityDimension;                // how many upstream systems must change?
  risk: ComplexityDimension;                        // blast radius of failure
  required_knowledge: ComplexityDimension;          // depth of domain knowledge needed
  time_estimate: ComplexityDimension;               // expected duration
  scale: ComplexityDimension;                       // users/data/systems affected
  reversibility: ComplexityDimension;               // 0 = fully reversible · 10 = irreversible
  verification_difficulty: ComplexityDimension;     // how hard to prove it works
};

export const EIGHT_DIMENSION_KEYS: readonly (keyof EightDimensions)[] = Object.freeze([
  "novelty", "dependencies", "risk", "required_knowledge",
  "time_estimate", "scale", "reversibility", "verification_difficulty",
] as const);

export type ComplexityVerdict = "TRIVIAL" | "MODERATE" | "COMPLEX" | "EXTREME" | "UNKNOWN";

export type TaskComplexityClassification = {
  classification_id: string;
  recorded_at_iso: string;
  task_slug: string;
  task_description: string;
  dimensions: EightDimensions;
  composite_score: number;                          // 0..10 · weighted average of evidenced dimensions
  verdict: ComplexityVerdict;
  reasoning: string;
  recommended_max_iterations: number;
  recommended_max_runtime_ms: number;
  recommended_max_files_changed: number;
  requires_founder_approval: boolean;
  requires_pre_benchmark: boolean;
};

export class InvalidComplexityError extends Error {
  constructor(reason: string) { super(`invalid_complexity:${reason}`); }
}

function validateDim(d: ComplexityDimension, name: string): void {
  if (d.score < 0 || d.score > 10 || !Number.isFinite(d.score)) {
    throw new InvalidComplexityError(`${name}_score_out_of_range:${d.score}`);
  }
  if (d.evidence_present && (!d.rationale || d.rationale.trim().length < 5)) {
    throw new InvalidComplexityError(`${name}_rationale_too_short`);
  }
  if (!d.evidence_present && d.rationale !== "UNKNOWN") {
    throw new InvalidComplexityError(`${name}_no_evidence_requires_UNKNOWN_rationale`);
  }
}

/** Deterministic classification · same inputs → identical output. */
export function classifyTask(input: {
  task_slug: string;
  task_description: string;
  dimensions: EightDimensions;
}): TaskComplexityClassification {
  if (!input.task_slug || input.task_slug.length < 3) throw new InvalidComplexityError("task_slug_too_short");
  if (!input.task_description || input.task_description.length < 10) throw new InvalidComplexityError("task_description_too_short");
  for (const key of EIGHT_DIMENSION_KEYS) validateDim(input.dimensions[key], key);

  const evidenced = EIGHT_DIMENSION_KEYS.filter((k) => input.dimensions[k].evidence_present);
  let composite: number;
  let verdict: ComplexityVerdict;
  let reasoning: string;
  if (evidenced.length < 3) {
    composite = 0;
    verdict = "UNKNOWN";
    reasoning = `only ${evidenced.length}/8 dimensions have evidence · cannot form defensible complexity verdict`;
  } else {
    // Weighted composite: risk + reversibility get 1.5× weight because they gate safety
    const weights: Record<keyof EightDimensions, number> = {
      novelty: 1.0, dependencies: 1.0, risk: 1.5, required_knowledge: 1.0,
      time_estimate: 0.75, scale: 1.0, reversibility: 1.5, verification_difficulty: 1.25,
    };
    let sum = 0, wSum = 0;
    for (const key of evidenced) {
      sum += input.dimensions[key].score * weights[key];
      wSum += weights[key];
    }
    composite = Math.round((sum / wSum) * 100) / 100;
    if (composite < 2.5) verdict = "TRIVIAL";
    else if (composite < 5) verdict = "MODERATE";
    else if (composite < 7.5) verdict = "COMPLEX";
    else verdict = "EXTREME";
    reasoning = `composite ${composite} across ${evidenced.length}/8 evidenced dimensions · weighted by risk×1.5 + reversibility×1.5 + verification_difficulty×1.25`;
  }

  // Recommended bounds scale with verdict · fail-closed for EXTREME
  let iters: number, runtime: number, files: number;
  switch (verdict) {
    case "TRIVIAL":  iters = 2;  runtime = 5_000;  files = 4;  break;
    case "MODERATE": iters = 8;  runtime = 60_000; files = 12; break;
    case "COMPLEX":  iters = 16; runtime = 180_000; files = 32; break;
    case "EXTREME":  iters = 32; runtime = 600_000; files = 64; break;
    default:         iters = 1;  runtime = 5_000;  files = 1;  break;   // UNKNOWN = minimum
  }

  const requiresFounderApproval = verdict === "EXTREME" ||
    input.dimensions.risk.score >= 8 ||
    input.dimensions.reversibility.score >= 8;
  const requiresPreBenchmark = verdict === "COMPLEX" || verdict === "EXTREME" ||
    input.dimensions.verification_difficulty.score >= 7;

  const rec: TaskComplexityClassification = {
    classification_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    task_slug: input.task_slug,
    task_description: input.task_description,
    dimensions: input.dimensions,
    composite_score: composite,
    verdict,
    reasoning,
    recommended_max_iterations: iters,
    recommended_max_runtime_ms: runtime,
    recommended_max_files_changed: files,
    requires_founder_approval: requiresFounderApproval,
    requires_pre_benchmark: requiresPreBenchmark,
  };
  appendJsonLine(taskComplexityClassificationsPath(), rec);
  return rec;
}

export function readAllClassifications(): TaskComplexityClassification[] {
  return readJsonlAll<TaskComplexityClassification>(taskComplexityClassificationsPath());
}

export function summariseByVerdict(): Record<ComplexityVerdict, number> {
  const out: Record<ComplexityVerdict, number> = { TRIVIAL: 0, MODERATE: 0, COMPLEX: 0, EXTREME: 0, UNKNOWN: 0 };
  for (const c of readAllClassifications()) out[c.verdict]++;
  return out;
}

/** Helper for building a dimension with evidence. */
export function withEvidence(score: number, rationale: string): ComplexityDimension {
  return { score, rationale, evidence_present: true };
}

/** Helper for building an UNKNOWN dimension honestly. */
export function unknownDim(): ComplexityDimension {
  return { score: 0, rationale: "UNKNOWN", evidence_present: false };
}

export function _resetComplexityForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(taskComplexityClassificationsPath())) fs.unlinkSync(taskComplexityClassificationsPath()); } catch { /* ignore */ }
}

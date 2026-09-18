// src/lib/nex-agent/code-engine/capability-concern.ts
//
// NEX1 · CONCERN · Metacognition · Founder-authorised 2026-09-18.
//
// PURPOSE
//   Deterministic aggregator of intermediate-signal risk within the CURRENT
//   turn. Biological analogue: anterior cingulate monitoring for conflict.
//   Engineering translation: rule-based score that returns
//   NONE / LOW / ELEVATED / HIGH based on how many risk signals are
//   present.
//
//   Concern DOES NOT BLOCK. It surfaces a warning that appears in the
//   composer rationale and in the trace, and it modulates downstream
//   confidence tags. The purpose is to preserve conflict rather than
//   silently resolve it — same pattern as Fix 30B.
//
//   Zero LLM. Deterministic. Pure function (no I/O).

import type { PriorRelationship } from "./capability-prior-evidence-comparator";

export type ConcernLevel = "NONE" | "LOW" | "ELEVATED" | "HIGH";

export interface ConcernSignals {
  /** From Fix 30B comparator. Null when no comparator ran this turn. */
  readonly prior_relationship: PriorRelationship | null;
  /** Investigation verdict, if the current turn ran investigation. */
  readonly investigation_verdict:
    | "SELECTED"
    | "NO_SELECTION"
    | "TIE"
    | "INSUFFICIENT_EVIDENCE"
    | "UNRESOLVED"
    | "REQUIRE_MORE_INVESTIGATION"
    | "SUFFICIENT"
    | "INSUFFICIENT"
    | null;
  /** True when Fix 24 Class 2 Bridge succeeded (an actual actionable
   *  assertion was found). */
  readonly bridge_ok: boolean;
  /** True when adjacent test exists but assertion shape was unsupported. */
  readonly adjacent_test_unparseable: boolean;
  /** True when target discovery matched with low confidence (multiple
   *  candidates or fallback pass). */
  readonly target_discovery_low_confidence: boolean;
  /** Count of ambiguities the classifier surfaced this turn. */
  readonly ambiguity_count: number;
}

export interface ConcernAssessment {
  readonly level: ConcernLevel;
  readonly score: number;
  /** Human-readable list of the individual signals that raised the score. */
  readonly hits: readonly string[];
  readonly rationale_suffix: string;
  readonly evidence_kind: "INFERRED";
  readonly policy_id: "NEX1_CONCERN_POLICY";
  readonly policy_version: "v1";
}

// ── Score table (Concern's own rulebook) ────────────────────────────────

const WEIGHTS = {
  PRIOR_CONFLICTS_CURRENT: 3,
  PRIOR_UNRESOLVED_SAME_FILE: 2,
  PRIOR_INFORMATIONAL_ONLY: 1,
  investigation_INSUFFICIENT: 2,
  investigation_TIE_or_UNRESOLVED: 2,
  investigation_REQUIRE_MORE_INVESTIGATION: 3,
  bridge_not_ok: 1,
  adjacent_test_unparseable: 1,
  target_discovery_low_confidence: 1,
  ambiguity_count_multiplier: 1, // per ambiguity, capped at 3
} as const;

const THRESHOLDS = {
  HIGH: 5,
  ELEVATED: 3,
  LOW: 1,
} as const;

export function assessConcern(signals: ConcernSignals): ConcernAssessment {
  const hits: string[] = [];
  let score = 0;

  if (signals.prior_relationship === "PRIOR_CONFLICTS_CURRENT") {
    score += WEIGHTS.PRIOR_CONFLICTS_CURRENT;
    hits.push("prior_conflicts_current");
  } else if (signals.prior_relationship === "PRIOR_UNRESOLVED_SAME_FILE") {
    score += WEIGHTS.PRIOR_UNRESOLVED_SAME_FILE;
    hits.push("prior_unresolved_same_file");
  } else if (signals.prior_relationship === "PRIOR_INFORMATIONAL_ONLY") {
    score += WEIGHTS.PRIOR_INFORMATIONAL_ONLY;
    hits.push("prior_informational_only");
  }

  if (
    signals.investigation_verdict === "INSUFFICIENT_EVIDENCE" ||
    signals.investigation_verdict === "INSUFFICIENT"
  ) {
    score += WEIGHTS.investigation_INSUFFICIENT;
    hits.push("insufficient_evidence");
  }
  if (
    signals.investigation_verdict === "TIE" ||
    signals.investigation_verdict === "UNRESOLVED"
  ) {
    score += WEIGHTS.investigation_TIE_or_UNRESOLVED;
    hits.push("investigation_unresolved");
  }
  if (signals.investigation_verdict === "REQUIRE_MORE_INVESTIGATION") {
    score += WEIGHTS.investigation_REQUIRE_MORE_INVESTIGATION;
    hits.push("require_more_investigation");
  }
  if (!signals.bridge_ok) {
    score += WEIGHTS.bridge_not_ok;
    hits.push("bridge_not_ok");
  }
  if (signals.adjacent_test_unparseable) {
    score += WEIGHTS.adjacent_test_unparseable;
    hits.push("adjacent_test_unparseable");
  }
  if (signals.target_discovery_low_confidence) {
    score += WEIGHTS.target_discovery_low_confidence;
    hits.push("target_discovery_low_confidence");
  }
  const capped_ambiguities = Math.min(signals.ambiguity_count ?? 0, 3);
  if (capped_ambiguities > 0) {
    score += capped_ambiguities * WEIGHTS.ambiguity_count_multiplier;
    hits.push(`ambiguity_count=${capped_ambiguities}`);
  }

  let level: ConcernLevel = "NONE";
  if (score >= THRESHOLDS.HIGH) level = "HIGH";
  else if (score >= THRESHOLDS.ELEVATED) level = "ELEVATED";
  else if (score >= THRESHOLDS.LOW) level = "LOW";

  const rationale_suffix =
    level === "NONE"
      ? ""
      : ` [Concern · ${level} · score=${score} · hits=${hits.join(",")}]`;

  return {
    level,
    score,
    hits,
    rationale_suffix,
    evidence_kind: "INFERRED",
    policy_id: "NEX1_CONCERN_POLICY",
    policy_version: "v1",
  };
}

export const CONCERN_VERSION = "concern.v1";
export const _CONCERN_INTERNAL = { WEIGHTS, THRESHOLDS };

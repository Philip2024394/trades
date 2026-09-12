// src/lib/nex-shadow/types.ts
//
// NEX1 · SHADOW MODE · type definitions.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Shadow Mode discipline (SH-1..SH-6):
//   · observation-only · never alters live response
//   · fire-and-forget · never throws into the live path
//   · four evaluation states · UNEVALUATED is honest
//   · no automatic learning · no automatic mutation
//   · attribution mandatory on every record

import type { PipelineDecision } from "@/lib/nex-integration/decision-types";

export type ShadowEvaluation =
  | "SHADOW_MATCH"
  | "SHADOW_VARIANCE"
  | "SHADOW_FAILURE"
  | "SHADOW_UNEVALUATED";

export interface ShadowAttribution {
  readonly external_llm_used: false;
  readonly test_only: false;
  readonly shadow_mode: true;
  readonly independent_authorship_percent: 0;
  readonly pipeline_version: string;
  readonly canon_version: string;
  readonly relevance_version: string;
  readonly stories_brain_version: string;
}

export interface ShadowRecord {
  readonly record_id: string;
  readonly at: string;
  readonly session_id: string;
  readonly input_fingerprint: string;       // sha-256 · 12-char prefix
  readonly utterance_preserved: string;     // founder-internal only · redact on public surface
  readonly pipeline_decision: PipelineDecision;
  readonly examiner: {
    readonly evaluation: ShadowEvaluation;
    readonly matched_expectation_id: string | null;
    readonly rationale: string;
    readonly variance_reason?: string;
    readonly failure_layer?: string;
    readonly failure_rule?: string;
  };
  readonly attribution: ShadowAttribution;
}

export interface ExamineExpectationMatch {
  readonly kind: "regex";
  readonly pattern: string;
}
export interface ExamineExpectation {
  readonly id: string;
  readonly match: ExamineExpectationMatch;
  readonly expected_final_disposition: string;
  readonly expected_refuses_at: string | null;
  readonly expected_rule_family?: string;
  readonly variance_tolerance: "none" | "layer" | "wording";
  readonly notes?: string;
  readonly expected_story_topic?: string;
}
export interface ExpectationsDoc {
  readonly version: string;
  readonly notes: string;
  readonly entries: readonly ExamineExpectation[];
}

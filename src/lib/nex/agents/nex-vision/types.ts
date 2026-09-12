// src/lib/nex/agents/nex-vision/types.ts
//
// WAVE-S-1 · Vision specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-1 · 2026-09-08
//
// Deterministic vision-request classifier + safety-gate. Real vision
// model integration is Phase 4 (deferred · requires gateway invariant
// per Self-Sustainment doctrine §8).
//
// Aligns with ADR-0028 (NEX Intelligence Constitution · IMMUTABLE):
//   · Every image = knowledge to preserve · geometry preservation Rule 13
//   · Confidence bands 99%/95%/85% · <85% flag for human review
//   · Never fabricate · never guess
//   · Family tree Rule 14 · children inherit parent intelligence

export type VisionRequestKind =
  | "understanding"     // "what is this image?"
  | "ocr"               // "extract text from this image"
  | "classification"    // "categorize this image"
  | "safety_check"      // "is this image safe to display?"
  | "modification"      // "change material from oak to walnut" · geometry preservation
  | "generation"        // "generate a hero banner for staircase X"
  | "provenance"        // "where did this image come from · has it been altered?"
  | "unknown";

export type VisionConfidenceBand =
  | "very_high"    // >= 0.99
  | "high"         // >= 0.95
  | "good"         // >= 0.85
  | "flag_human"   // < 0.85 · ADR-0028 mandatory human review
  | "unknown";

export type VisionSafetySignal =
  | { kind: "content_safety_concern"; category: "violence" | "sexual" | "minor" | "self_harm" | "hate"; severity: "low" | "medium" | "high" }
  | { kind: "geometry_violation_risk"; description: string }         // Rule 13
  | { kind: "provenance_missing"; description: string }              // Rule 14
  | { kind: "generation_beyond_permission"; description: string }    // Rule 11: image doesn't know what it can become
  | { kind: "no_safety_concern" };

export type VisionRequest = {
  request_id: string;
  request_text: string;                                              // user's ask
  image_reference?: string;                                          // path or URL · deterministic classifier doesn't fetch
  image_metadata?: {
    known_manifest_entry: boolean;                                   // per ADR-0024 image manifest
    collection?: string;
    image_type?: string;
  };
};

export type VisionResponse = {
  request_id: string;
  detected_kind: VisionRequestKind;
  confidence_band: VisionConfidenceBand;
  safety_signals: readonly VisionSafetySignal[];
  advisory_text: string;                                             // deterministic response (Phase 3)
  requires_human_review: boolean;                                    // <85% or safety flag
  deferred_to_phase_4: boolean;                                      // true when actual vision model needed
};

export type VisionRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "confidence_band_reasonable"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "no_fabrication_no_guess"; ok: boolean; detail?: string }
  | { check: "geometry_preservation_flagged_for_modifications"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type VisionCorpusCase = {
  case_id: string;
  request: VisionRequest;
  expected: {
    detected_kind: VisionRequestKind;
    confidence_band: VisionConfidenceBand;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly VisionSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type VisionCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly VisionCorpusCase[];
  content_hash: string;
};

export type VisionEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly VisionRubricCheck[];
  actual: VisionResponse;
};

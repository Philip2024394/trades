// src/lib/nex/agents/nex-vision/evaluator.ts
//
// WAVE-S-1 · Vision corpus evaluator
// Founder BEGIN WAVE-S-1 · 2026-09-08

import type { VisionCorpus, VisionCorpusCase, VisionEvaluation, VisionRubricCheck } from "./types";
import { respondVision } from "./vision-gate";

export function evaluateVisionCase(bc: VisionCorpusCase): VisionEvaluation {
  const actual = respondVision(bc.request);
  const checks: VisionRubricCheck[] = [];

  checks.push({
    check: "kind_classification_matches_expected",
    ok: actual.detected_kind === bc.expected.detected_kind,
    detail: `expected=${bc.expected.detected_kind} actual=${actual.detected_kind}`,
  });

  checks.push({
    check: "confidence_band_reasonable",
    ok: actual.confidence_band === bc.expected.confidence_band,
    detail: `expected=${bc.expected.confidence_band} actual=${actual.confidence_band}`,
  });

  const actual_safety_kinds = actual.safety_signals.filter((s) => s.kind !== "no_safety_concern").map((s) => s.kind);
  const expected_kinds = bc.expected.expected_safety_kinds;
  const all_expected_present = expected_kinds.every((k) => actual_safety_kinds.includes(k));
  checks.push({
    check: "safety_signals_present_when_expected",
    ok: all_expected_present,
    detail: `expected=[${expected_kinds.join(",")}] actual=[${actual_safety_kinds.join(",")}]`,
  });

  checks.push({
    check: "human_review_triggered_when_appropriate",
    ok: actual.requires_human_review === bc.expected.should_require_human_review,
    detail: `expected=${bc.expected.should_require_human_review} actual=${actual.requires_human_review}`,
  });

  checks.push({
    check: "no_fabrication_no_guess",
    ok: !actual.advisory_text.includes("[FABRICATED]") && actual.advisory_text.length > 0,
  });

  const geometryCase = bc.request.request_text.toLowerCase().includes("redesign") || bc.request.request_text.toLowerCase().includes("different layout");
  const geometryFlagged = actual.safety_signals.some((s) => s.kind === "geometry_violation_risk");
  checks.push({
    check: "geometry_preservation_flagged_for_modifications",
    ok: geometryCase ? geometryFlagged : true,
    detail: geometryCase ? `flagged=${geometryFlagged}` : "n/a",
  });

  checks.push({
    check: "advisory_text_non_empty_and_bounded",
    ok: actual.advisory_text.length > 0 && actual.advisory_text.length < 2000,
  });

  const passed = checks.every((c) => c.ok);
  return { case_id: bc.case_id, passed, checks, actual };
}

export function evaluateVisionCorpus(corpus: VisionCorpus): {
  total: number;
  passed: number;
  failed: number;
  results: readonly VisionEvaluation[];
} {
  const results = corpus.cases.map(evaluateVisionCase);
  const passed = results.filter((r) => r.passed).length;
  return { total: corpus.cases.length, passed, failed: corpus.cases.length - passed, results };
}

// src/lib/nex-shadow/examiner.ts
//
// NEX1 · SHADOW MODE · deterministic examiner.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Rules:
//   · Match utterance against expectations (regex).
//   · If matched · compare observed with expected · produce MATCH / VARIANCE / FAILURE.
//   · If NOT matched · produce UNEVALUATED. NEVER default to MATCH or FAILURE.
//   · variance_tolerance controls the strictness (SH-3).
//   · No LLM. Deterministic. Fail-safe.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ExpectationsDoc, ExamineExpectation, ShadowEvaluation } from "./types";
import type { PipelineDecision } from "@/lib/nex-integration/decision-types";

let EXPECT_CACHE: ExpectationsDoc | null = null;

export function loadExpectations(): ExpectationsDoc {
  if (EXPECT_CACHE) return EXPECT_CACHE;
  // Prefer the newest founder-authored version present. Additive-only:
  // never merges silently; loads exactly ONE file · newest first.
  const candidates = [
    "data/nex1-shadow/expectations-v0.2.0.json",
    "data/nex1-shadow/expectations-v0.1.0.json",
  ];
  for (const rel of candidates) {
    const p = resolve(process.cwd(), rel);
    if (existsSync(p)) {
      EXPECT_CACHE = JSON.parse(readFileSync(p, "utf8")) as ExpectationsDoc;
      return EXPECT_CACHE;
    }
  }
  // Missing expectations file fails-SAFE: everything becomes UNEVALUATED.
  EXPECT_CACHE = { version: "v0.0.0-missing", notes: "expectations file missing · everything is UNEVALUATED", entries: [] };
  return EXPECT_CACHE;
}
export function _resetExpectationsCache(): void { EXPECT_CACHE = null; }

export interface ExamineResult {
  readonly evaluation: ShadowEvaluation;
  readonly matched_expectation_id: string | null;
  readonly rationale: string;
  readonly variance_reason?: string;
  readonly failure_layer?: string;
  readonly failure_rule?: string;
}

/**
 * @summary Evaluate an observed PipelineDecision against founder-authored
 * expectations. Deterministic. Never fabricates a MATCH or FAILURE when no
 * expectation exists (SH-3).
 */
export function examine(utterance: string, decision: PipelineDecision): ExamineResult {
  let matched: ExamineExpectation | null = null;
  try {
    const doc = loadExpectations();
    for (const e of doc.entries) {
      if (e.match.kind !== "regex") continue;
      try {
        const re = new RegExp(e.match.pattern, "i");
        if (re.test(utterance)) { matched = e; break; }
      } catch { /* skip broken pattern · fail-safe */ }
    }
  } catch {
    // If loading itself throws, fail-safe into UNEVALUATED
    return {
      evaluation: "SHADOW_UNEVALUATED",
      matched_expectation_id: null,
      rationale: "examiner load failed · fail-safe · absence of expectation → UNEVALUATED",
    };
  }
  if (!matched) {
    return {
      evaluation: "SHADOW_UNEVALUATED",
      matched_expectation_id: null,
      rationale: "no examiner expectation matched · SH-3 · UNEVALUATED (not MATCH · not FAILURE)",
    };
  }

  // Compare observed vs expected
  const observedFinal = decision.final_disposition;
  const observedLayer = decision.refuses_at_layer ?? null;
  const expectedFinal = matched.expected_final_disposition;
  const expectedLayer = matched.expected_refuses_at ?? null;

  const finalOk = observedFinal === expectedFinal;
  const layerOk = observedLayer === expectedLayer;

  if (finalOk && layerOk) {
    return {
      evaluation: "SHADOW_MATCH",
      matched_expectation_id: matched.id,
      rationale: `matched expectation '${matched.id}' · observed final_disposition and refuses_at both agree with the examiner`,
    };
  }

  // Variance vs Failure decision:
  //   variance_tolerance === "none" → any mismatch is FAILURE
  //   variance_tolerance === "layer" → same final_disposition · different layer → VARIANCE
  //   variance_tolerance === "wording" → same disposition + layer semantically · never used yet
  if (matched.variance_tolerance === "layer" && finalOk && !layerOk) {
    return {
      evaluation: "SHADOW_VARIANCE",
      matched_expectation_id: matched.id,
      rationale: `expectation '${matched.id}' met on final_disposition but layer differs · variance_tolerance permits this`,
      variance_reason: `expected_refuses_at='${expectedLayer}' observed_refuses_at='${observedLayer}'`,
    };
  }

  return {
    evaluation: "SHADOW_FAILURE",
    matched_expectation_id: matched.id,
    rationale: `expectation '${matched.id}' not met · variance_tolerance='${matched.variance_tolerance}'`,
    failure_layer: observedLayer ?? undefined,
    failure_rule: matched.expected_rule_family,
    variance_reason: `expected_final='${expectedFinal}' observed_final='${observedFinal}' · expected_refuses_at='${expectedLayer}' observed_refuses_at='${observedLayer}'`,
  };
}

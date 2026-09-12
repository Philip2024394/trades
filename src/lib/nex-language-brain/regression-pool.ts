// src/lib/nex-language-brain/regression-pool.ts
//
// NEX1 · LANGUAGE BRAIN · REGRESSION POOL.
//
// taught_by = master_ai_engineer · 2026-09-12
//
// Founder doctrine (locked): every case that has EVER passed enters the
// regression pool. On every subsequent run, every regression case MUST
// still pass. If any regresses, the run fails regardless of new-case
// fluency. This makes the language brain's history a permanent
// specification that cannot silently be lost.
//
// Data shape on disk: JSON with per-case provenance
//   { id, utterance, expected, tags, first_passed_at, capability_learned }
//
// Examiner separation (constitutional):
//   · The regression pool is READ-ONLY at scoring time.
//   · Only a teacher-authored ADD path may extend it.
//   · A REMOVE from the pool requires explicit founder authorisation.
//     Do not implement remove until asked.

import type { Nex1LanguageInput } from "./language-types";
import type { Nex1RubricCase } from "./capability-rubric";

export interface Nex1RegressionEntry {
  readonly id: string;
  readonly utterance: string;
  readonly expected: Nex1RubricCase["expected"];
  readonly tags: readonly string[];
  readonly first_passed_at: string;
  readonly capability_learned: string;      // human-readable note
  readonly language_hint?: Nex1LanguageInput["language_hint"];
  readonly prior_context?: readonly string[];
  readonly hidden?: boolean;                 // if true · omit from stdout logs
}

export interface Nex1RegressionIndex {
  readonly version: string;
  readonly entries: readonly Nex1RegressionEntry[];
  readonly authored_by: "master_ai_engineer" | "examiner";
  readonly notes: string;
}

/**
 * @summary Convert a regression entry into a Nex1RubricCase for scoring.
 * Deterministic · read-only transformation.
 */
export function regressionToRubricCase(e: Nex1RegressionEntry): Nex1RubricCase {
  return {
    id: `regression.${e.id}`,
    utterance: e.utterance,
    language_hint: e.language_hint,
    prior_context: e.prior_context,
    expected: e.expected,
    tags: [...e.tags, "regression"],
  };
}

/**
 * @summary Enforce regression discipline · returns false if any regression
 * case did not pass. The scoring caller must halt-with-failure in that case.
 */
export function regressionPoolClean(scored: readonly { case_id: string; case_score: number }[]): { clean: boolean; failed_ids: readonly string[] } {
  const failedIds: string[] = [];
  for (const s of scored) {
    if (!s.case_id.startsWith("regression.")) continue;
    if (s.case_score < 5) failedIds.push(s.case_id);
  }
  return { clean: failedIds.length === 0, failed_ids: failedIds };
}

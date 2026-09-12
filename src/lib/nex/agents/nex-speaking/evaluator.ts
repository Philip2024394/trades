// src/lib/nex/agents/nex-speaking/evaluator.ts
//
// NEX Speaking Intelligence Engineer · Phase 3 · corpus evaluator
// Philip 2026-09-07 · AUTHORIZE Phase 3

import { randomUUID } from "node:crypto";
import type { SpeakingCorpus, SpeakingEvaluation, SpeakingRun } from "./types";
import { respond } from "./respond";
import { scoreCase } from "./rubric";

/** Evaluate every case in a frozen corpus. Deterministic. */
export function evaluateSpeakingCorpus(corpus: SpeakingCorpus): SpeakingRun {
  const run_id = `spk_run_${randomUUID()}`;
  const started_at = new Date().toISOString();
  const results: SpeakingEvaluation[] = [];
  for (const c of corpus.cases) {
    const resp = respond({
      request_id: `req_${c.case_id}`,
      user_context: c.user_context,
      timestamp: started_at,
    });
    const { rubric_results, passed } = scoreCase(c, resp);
    results.push({
      case_id: c.case_id,
      actual_response: resp,
      rubric_results,
      case_passed: passed,
      match_status: passed ? "CORRECT" : "WRONG",
      timestamp: new Date().toISOString(),
    });
  }
  const passed = results.filter((r) => r.match_status === "CORRECT").length;
  const failed = results.length - passed;
  return {
    run_id,
    corpus_version: corpus.version,
    started_at,
    completed_at: new Date().toISOString(),
    case_count: corpus.case_count,
    passed,
    failed,
    results,
  };
}

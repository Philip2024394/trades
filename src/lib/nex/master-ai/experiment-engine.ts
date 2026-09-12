// src/lib/nex/master-ai/experiment-engine.ts
//
// NEX Master AI Engineer · Experiment Engine · §16 §38.6
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Never assume an improvement is better. Compare candidate against
// current using historical replay against a frozen benchmark corpus.
// Only PROMOTE demonstrably superior candidates.
//
// Preserves M6's anti-adaptive-selection discipline: benchmark corpora
// stay frozen; the engine only reads them.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { experimentComparisonsPath } from "./paths";
import { readAllRuns } from "./benchmark-engine";
import type { ExperimentComparison } from "./types";
import type { BenchmarkRun } from "./types";

const MIN_CASES_FOR_CONFIDENCE = 20;
const SUPERIOR_MARGIN = 0.02;  // must exceed prior by 2pp for SUPERIOR verdict

/** Compare a candidate capability's benchmark run against the current
 *  capability's most recent run against the same corpus. */
export function compareCandidateAgainstCurrent(input: {
  candidate_run_id: string;
  current_capability_id: string | null;
}): ExperimentComparison {
  const runs = readAllRuns();
  const candidate = runs.find((r) => r.run_id === input.candidate_run_id);
  if (!candidate) throw new Error(`unknown_candidate_run:${input.candidate_run_id}`);
  const current = input.current_capability_id
    ? mostRecentRunFor(runs, input.current_capability_id, candidate.corpus_id)
    : null;
  return runComparison({
    candidate,
    current,
    candidate_capability_id: candidate.capability_id,
    current_capability_id: input.current_capability_id,
    corpus_id: candidate.corpus_id,
  });
}

function mostRecentRunFor(runs: BenchmarkRun[], capability_id: string, corpus_id: string): BenchmarkRun | null {
  let latest: BenchmarkRun | null = null;
  for (const r of runs) {
    if (r.capability_id !== capability_id || r.corpus_id !== corpus_id) continue;
    if (!latest || r.timestamp_iso > latest.timestamp_iso) latest = r;
  }
  return latest;
}

function runComparison(input: {
  candidate: BenchmarkRun;
  current: BenchmarkRun | null;
  candidate_capability_id: string;
  current_capability_id: string | null;
  corpus_id: string;
}): ExperimentComparison {
  const cand = input.candidate;
  const cur = input.current;
  const candPassRate = cand.case_count > 0 ? cand.pass_count / cand.case_count : 0;

  let verdict: ExperimentComparison["verdict"];
  let reasoning: string;

  if (cand.case_count < MIN_CASES_FOR_CONFIDENCE) {
    verdict = "INSUFFICIENT_EVIDENCE";
    reasoning = `candidate_ran_${cand.case_count}_cases_below_min_${MIN_CASES_FOR_CONFIDENCE}`;
  } else if (!cur) {
    verdict = candPassRate >= 0.5 ? "SUPERIOR" : "INFERIOR";
    reasoning = `no_current_baseline_candidate_pass_rate=${candPassRate.toFixed(3)}`;
  } else {
    const curPassRate = cur.case_count > 0 ? cur.pass_count / cur.case_count : 0;
    const delta = candPassRate - curPassRate;
    if (delta > SUPERIOR_MARGIN) {
      verdict = "SUPERIOR";
      reasoning = `candidate_pass_rate=${candPassRate.toFixed(3)}_gt_current=${curPassRate.toFixed(3)}_by_${delta.toFixed(3)}`;
    } else if (delta < -SUPERIOR_MARGIN) {
      verdict = "INFERIOR";
      reasoning = `candidate_pass_rate=${candPassRate.toFixed(3)}_lt_current=${curPassRate.toFixed(3)}_by_${(-delta).toFixed(3)}`;
    } else if (Math.abs(delta) < 0.001) {
      verdict = "EQUIVALENT";
      reasoning = `identical_pass_rates=${candPassRate.toFixed(3)}`;
    } else {
      verdict = "UNEXPLAINED";
      reasoning = `within_noise_margin:candidate=${candPassRate.toFixed(3)}_current=${curPassRate.toFixed(3)}`;
    }
  }

  const record: ExperimentComparison = {
    comparison_id: randomUUID(),
    candidate_capability_id: input.candidate_capability_id,
    current_capability_id: input.current_capability_id,
    corpus_id: input.corpus_id,
    candidate_metrics: {
      pass: cand.pass_count, fail: cand.fail_count, per_class: cand.per_class_metrics,
    },
    current_metrics: cur
      ? { pass: cur.pass_count, fail: cur.fail_count, per_class: cur.per_class_metrics }
      : null,
    verdict,
    reasoning,
    performed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(experimentComparisonsPath(), record);
  return record;
}

export function readAllComparisons(): ExperimentComparison[] {
  return readJsonlAll<ExperimentComparison>(experimentComparisonsPath());
}

export function _resetExperimentEngineForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(experimentComparisonsPath())) fs.unlinkSync(experimentComparisonsPath()); } catch { /* ignore */ }
}

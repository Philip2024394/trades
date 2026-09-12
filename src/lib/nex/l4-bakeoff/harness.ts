// src/lib/nex/l4-bakeoff/harness.ts
//
// V.5.2 · L4 bakeoff · orchestration harness
// Founder BEGIN V.5.2 · 2026-09-08
//
// Composes: adapter → benchmark → scoring → provenance → anti-gaming.
// Deterministic sequential execution. Every case attempted is either
// scored (pass/fail/unknown) or explicitly excluded with a reason.

import type {
  AdapterRequest,
  AdapterResponse,
  BenchmarkCase,
  BenchmarkCorpus,
  CandidateAdapter,
  CaseScore,
  RunProvenance,
  AntiGamingSentinel,
} from "./types";
import { scoreCase, SCORING_VERSION, SCORING_VERSION_HASH } from "./scoring";
import { captureSentinel, verifySentinelUnchanged, validateExclusions, validateAggregateCompleteness } from "./anti-gaming";
import { captureRunProvenance, generateRunId } from "./reproducibility";
import type { LatencySample } from "./latency";

export type BakeoffRunInput = {
  corpus: BenchmarkCorpus;
  adapter: CandidateAdapter;
  system_prompt_slot: string;
  system_prompt_text: string;
  sampling?: RunProvenance["sampling"];
  hardware_identifier: string;
  runtime_identifier: string;
  /** Whether the provider guarantees deterministic reproduction with
   *  fixed seeds. null when unknown · false when explicitly non-det. */
  deterministic: boolean | null;
  /** Cases we deliberately exclude before the run (with explicit reasons). */
  pre_excluded_cases?: readonly { case_id: string; reason: string }[];
  /** V.5.4.3-002 · optional per-case hook · fires AFTER adapter.invoke +
   *  scoring · never before. Errors thrown by the hook are caught and
   *  reported as errors on the run (they never abort other cases). Used
   *  by runControlledInstrument to preserve full response text into the
   *  transcript sink AND to emit per-case progress. Called synchronously
   *  in the case loop (does not fire in parallel). */
  on_case_complete?: (info: {
    bcase: BenchmarkCase;
    request: AdapterRequest;
    response: AdapterResponse;
    score: CaseScore;
    /** 1-indexed case position for progress reporting. */
    case_index: number;
    /** Total cases attempted (post pre-exclusion). */
    case_total: number;
    /** Wall-clock ms since the run started. */
    elapsed_ms: number;
  }) => void | Promise<void>;
};

export type BakeoffRunResult = {
  run_id: string;
  provenance: RunProvenance;
  case_scores: readonly CaseScore[];
  latency_samples: readonly LatencySample[];
  sentinel_start: AntiGamingSentinel;
  sentinel_end: AntiGamingSentinel;
};

/** Execute one candidate against one frozen corpus.
 *  Never throws · every failure captured in provenance.errors[]
 *  or as a per-case failure_kind. */
export async function runBakeoff(input: BakeoffRunInput): Promise<BakeoffRunResult> {
  const startedAt = new Date().toISOString();
  const run_id = generateRunId();

  // Sentinel BEFORE any work
  const sentinelStart = captureSentinel({
    corpus: input.corpus,
    scoring_version: SCORING_VERSION,
    scoring_hash: SCORING_VERSION_HASH,
    system_prompt_slot: input.system_prompt_slot,
    system_prompt_text: input.system_prompt_text,
  });

  // Validate any pre-exclusions
  const preExcluded = input.pre_excluded_cases ?? [];
  validateExclusions(preExcluded);
  const preExcludedIds = new Set(preExcluded.map((e) => e.case_id));

  // Filter cases · dropping pre-excluded
  const casesToRun = input.corpus.cases.filter((c) => !preExcludedIds.has(c.case_id));

  const case_scores: CaseScore[] = [];
  const latency_samples: LatencySample[] = [];
  const errors: { case_id: string; kind: string; reason: string }[] = [];
  const runStartMs = Date.now();

  let caseIndex = 0;
  for (const bcase of casesToRun) {
    caseIndex += 1;
    const supported = input.adapter.supportedDimensions();
    if (supported.length > 0 && !supported.includes(bcase.dimension)) {
      // Candidate declares no support · record as adapter_failure with reason
      const skipScore: CaseScore = {
        case_id: bcase.case_id,
        candidate_id: input.adapter.identity.candidate_id,
        dimension: bcase.dimension,
        passed: "unknown",
        automated_signals: { must_contain_hits: 0, must_contain_total: 0, must_not_contain_violations: 0 },
        failure_kind: "adapter_failure",
        scored_at_iso: new Date().toISOString(),
      };
      case_scores.push(skipScore);
      errors.push({ case_id: bcase.case_id, kind: "adapter_failure", reason: `candidate does not support dimension ${bcase.dimension}` });
      if (input.on_case_complete) {
        const skipReq: AdapterRequest = {
          prompt: bcase.prompt,
          system_prompt: input.system_prompt_text,
          conversation_history: bcase.conversation_history,
          request_id: `${run_id}_${bcase.case_id}`,
        };
        const skipResponse: AdapterResponse = {
          kind: "adapter_failure",
          reason: `candidate does not support dimension ${bcase.dimension}`,
          latency_ms: 0,
        };
        try {
          await Promise.resolve(input.on_case_complete({
            bcase, request: skipReq, response: skipResponse, score: skipScore,
            case_index: caseIndex, case_total: casesToRun.length, elapsed_ms: Date.now() - runStartMs,
          }));
        } catch (hookErr) {
          errors.push({ case_id: bcase.case_id, kind: "on_case_complete_hook_error", reason: hookErr instanceof Error ? hookErr.message : String(hookErr) });
        }
      }
      continue;
    }

    const req: AdapterRequest = {
      prompt: bcase.prompt,
      system_prompt: input.system_prompt_text,
      conversation_history: bcase.conversation_history,
      temperature: input.sampling?.temperature,
      max_tokens: input.sampling?.max_tokens,
      request_id: `${run_id}_${bcase.case_id}`,
    };

    let response: AdapterResponse;
    try {
      response = await input.adapter.invoke(req);
    } catch (err) {
      // Contract violation · adapter must never throw · treat as adapter_failure
      response = {
        kind: "adapter_failure",
        reason: `adapter threw: ${err instanceof Error ? err.message : String(err)}`,
        latency_ms: 0,
      };
      errors.push({ case_id: bcase.case_id, kind: "adapter_failure", reason: "adapter threw (contract violation)" });
    }

    const score = scoreCase({
      bcase,
      candidate_id: input.adapter.identity.candidate_id,
      response,
    });
    case_scores.push(score);

    if (response.kind === "ok") {
      latency_samples.push({
        total_ms: response.latency_ms,
        ttft_ms: response.ttft_ms,
        output_tokens: typeof response.output_tokens === "number" ? response.output_tokens : undefined,
        cold_start: latency_samples.length === 0,     // first sample = cold-ish · rough
        request_id: req.request_id,
      });
    } else {
      errors.push({ case_id: bcase.case_id, kind: response.kind, reason: response.reason });
    }

    if (input.on_case_complete) {
      try {
        await Promise.resolve(input.on_case_complete({
          bcase, request: req, response, score,
          case_index: caseIndex, case_total: casesToRun.length, elapsed_ms: Date.now() - runStartMs,
        }));
      } catch (hookErr) {
        errors.push({ case_id: bcase.case_id, kind: "on_case_complete_hook_error", reason: hookErr instanceof Error ? hookErr.message : String(hookErr) });
      }
    }
  }

  // Sentinel AFTER · verify nothing drifted
  const sentinelEnd = captureSentinel({
    corpus: input.corpus,
    scoring_version: SCORING_VERSION,
    scoring_hash: SCORING_VERSION_HASH,
    system_prompt_slot: input.system_prompt_slot,
    system_prompt_text: input.system_prompt_text,
  });
  verifySentinelUnchanged(sentinelStart, sentinelEnd);

  const completedAt = new Date().toISOString();
  const scored = case_scores.filter((s) => s.passed !== "unknown").length;
  const unknown = case_scores.filter((s) => s.passed === "unknown").length;
  const excluded = preExcluded.length;

  validateAggregateCompleteness({
    case_count_attempted: input.corpus.case_count,
    case_count_scored: scored,
    case_count_unknown: unknown,
    case_count_excluded: excluded,
  });

  const provenance = captureRunProvenance({
    candidate_identity: input.adapter.identity,
    benchmark_version: input.corpus.version,
    benchmark_hash: input.corpus.content_hash,
    scoring_version: SCORING_VERSION,
    system_prompt_slot: input.system_prompt_slot,
    system_prompt_text: input.system_prompt_text,
    sampling: input.sampling ?? {},
    hardware_identifier: input.hardware_identifier,
    runtime_identifier: input.runtime_identifier,
    started_at_iso: startedAt,
    completed_at_iso: completedAt,
    case_count_attempted: input.corpus.case_count,
    case_count_scored: scored,
    case_count_unknown: unknown,
    case_count_excluded: excluded,
    excluded_reasons: preExcluded,
    errors,
    deterministic: input.deterministic,
    run_id,
  });

  return {
    run_id,
    provenance,
    case_scores,
    latency_samples,
    sentinel_start: sentinelStart,
    sentinel_end: sentinelEnd,
  };
}

// src/lib/nex/l4-bakeoff/anti-gaming.ts
//
// V.5.2 · L4 bakeoff · anti-gaming enforcement primitives
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Section 16):
//   · Benchmark-specific prompt tuning REFUSED
//   · Candidate-specific hidden advantages REFUSED
//   · Selective case removal REFUSED
//   · Cherry-picked outputs REFUSED
//   · Adaptive benchmark modification REFUSED
//   · Post-hoc scoring change REFUSED
//   · Different system instructions per candidate REFUSED
//   · Hidden failed cases REFUSED
//   · Averages-only reporting REFUSED
//   · Missing data ≠ success
//
// This module provides the sentinel + validators that the harness calls
// before every run. Any violation throws an AntiGamingError.

import type { AntiGamingSentinel, BenchmarkCorpus } from "./types";
import { verifyCorpusIntegrity } from "./benchmark-schema";
import { hashSystemPrompt } from "./reproducibility";

export class AntiGamingError extends Error {
  constructor(reason: string) { super(`anti_gaming: ${reason}`); }
}

/** Capture the sentinel BEFORE a run begins. If the same sentinel is
 *  captured again later and any field differs, the harness detects
 *  that the benchmark, scoring, or system prompt changed mid-run. */
export function captureSentinel(input: {
  corpus: BenchmarkCorpus;
  scoring_version: string;
  scoring_hash: string;
  system_prompt_slot: string;
  system_prompt_text: string;
}): AntiGamingSentinel {
  const integrity = verifyCorpusIntegrity(input.corpus);
  if (!integrity.ok) throw new AntiGamingError(`sentinel refused · corpus integrity broken: ${integrity.reason}`);

  return {
    sentinel_id: `sent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    benchmark_version: input.corpus.version,
    benchmark_hash_frozen_at: input.corpus.content_hash,
    scoring_version: input.scoring_version,
    scoring_hash_frozen_at: input.scoring_hash,
    system_prompt_slot: input.system_prompt_slot,
    system_prompt_hash_frozen_at: hashSystemPrompt(input.system_prompt_text),
    captured_at_iso: new Date().toISOString(),
  };
}

/** Compare a fresh sentinel against an earlier one · any field diff
 *  means the run's assumptions were tampered with mid-flight. */
export function verifySentinelUnchanged(earlier: AntiGamingSentinel, later: AntiGamingSentinel): void {
  const checks: [string, string, string][] = [
    ["benchmark_version", earlier.benchmark_version, later.benchmark_version],
    ["benchmark_hash", earlier.benchmark_hash_frozen_at, later.benchmark_hash_frozen_at],
    ["scoring_version", earlier.scoring_version, later.scoring_version],
    ["scoring_hash", earlier.scoring_hash_frozen_at, later.scoring_hash_frozen_at],
    ["system_prompt_slot", earlier.system_prompt_slot, later.system_prompt_slot],
    ["system_prompt_hash", earlier.system_prompt_hash_frozen_at, later.system_prompt_hash_frozen_at],
  ];
  for (const [field, a, b] of checks) {
    if (a !== b) {
      throw new AntiGamingError(`sentinel_drift: ${field} changed mid-run · earlier=${a} later=${b}`);
    }
  }
}

/** Require every excluded case to carry an explicit non-empty reason. */
export function validateExclusions(exclusions: readonly { case_id: string; reason: string }[]): void {
  for (const e of exclusions) {
    if (!e.reason || e.reason.trim().length === 0) {
      throw new AntiGamingError(`case ${e.case_id} excluded without reason · REFUSED`);
    }
    if (e.reason.trim().length < 12) {
      throw new AntiGamingError(`case ${e.case_id} excluded with vague reason (${e.reason.length} chars) · REFUSED`);
    }
  }
}

/** Enforce: the SAME system prompt must be used for every candidate in a
 *  single run. Different system prompts per candidate is unfair and refused. */
export function validateSystemPromptUniformity(promptsPerCandidate: readonly { candidate_id: string; system_prompt_hash: string }[]): void {
  if (promptsPerCandidate.length <= 1) return;
  const firstHash = promptsPerCandidate[0].system_prompt_hash;
  for (const p of promptsPerCandidate) {
    if (p.system_prompt_hash !== firstHash) {
      throw new AntiGamingError(
        `system_prompt_hash mismatch: candidate ${p.candidate_id} uses hash ${p.system_prompt_hash} · run baseline is ${firstHash} · REFUSED`,
      );
    }
  }
}

/** Verify the aggregate reporting includes every attempted case ·
 *  refuses averages-only reporting. */
export function validateAggregateCompleteness(input: {
  case_count_attempted: number;
  case_count_scored: number;
  case_count_unknown: number;
  case_count_excluded: number;
}): void {
  const total = input.case_count_scored + input.case_count_unknown + input.case_count_excluded;
  if (total !== input.case_count_attempted) {
    throw new AntiGamingError(
      `aggregate incomplete: attempted=${input.case_count_attempted} scored=${input.case_count_scored} unknown=${input.case_count_unknown} excluded=${input.case_count_excluded} · sum=${total} does not match attempted`,
    );
  }
}

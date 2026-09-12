// src/lib/nex/l4-bakeoff/reproducibility.ts
//
// V.5.2 · L4 bakeoff · reproducibility + provenance capture
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Sections 15, 17):
//   · Every run captures full context so a fresh process can reproduce
//   · Non-deterministic providers explicitly labelled (deterministic: null)
//   · Op-Truth §OP.5 preserved (final_status: null in persisted record)
//   · Never fabricate any field · UNKNOWN when unverifiable

import { createHash, randomUUID } from "node:crypto";
import type { CandidateIdentity, RunProvenance } from "./types";

export function generateRunId(): string {
  return `l4run_${randomUUID()}`;
}

export function hashSystemPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex").slice(0, 24);
}

export function captureRunProvenance(input: {
  candidate_identity: CandidateIdentity;
  benchmark_version: string;
  benchmark_hash: string;
  scoring_version: string;
  system_prompt_slot: string;
  system_prompt_text: string;
  sampling: RunProvenance["sampling"];
  hardware_identifier: string;
  runtime_identifier: string;
  started_at_iso: string;
  completed_at_iso: string;
  case_count_attempted: number;
  case_count_scored: number;
  case_count_unknown: number;
  case_count_excluded: number;
  excluded_reasons: readonly { case_id: string; reason: string }[];
  errors: readonly { case_id: string; kind: string; reason: string }[];
  deterministic: boolean | null;
  reproducibility_notes?: string;
  run_id?: string;
}): RunProvenance {
  const notes: string[] = [];
  if (input.deterministic === null) {
    notes.push("provider does not guarantee determinism · exact re-run may produce different results");
  } else if (input.deterministic === false) {
    notes.push("run was observed non-deterministic (seeds ignored by provider) · UNKNOWN discipline applies");
  }
  if (input.errors.length > 0) {
    notes.push(`${input.errors.length} case-level error(s) captured · see errors[]`);
  }
  if (input.excluded_reasons.length > 0) {
    notes.push(`${input.excluded_reasons.length} case(s) excluded with explicit reason · see excluded_reasons[]`);
  }
  if (input.reproducibility_notes) notes.push(input.reproducibility_notes);

  return {
    run_id: input.run_id ?? generateRunId(),
    candidate_identity: input.candidate_identity,
    benchmark_version: input.benchmark_version,
    benchmark_hash: input.benchmark_hash,
    scoring_version: input.scoring_version,
    system_prompt_slot: input.system_prompt_slot,
    system_prompt_hash: hashSystemPrompt(input.system_prompt_text),
    sampling: input.sampling,
    hardware_identifier: input.hardware_identifier,
    runtime_identifier: input.runtime_identifier,
    node_version: process.version,
    started_at_iso: input.started_at_iso,
    completed_at_iso: input.completed_at_iso,
    case_count_attempted: input.case_count_attempted,
    case_count_scored: input.case_count_scored,
    case_count_unknown: input.case_count_unknown,
    case_count_excluded: input.case_count_excluded,
    excluded_reasons: input.excluded_reasons,
    errors: input.errors,
    reproducibility_notes: notes.join(" · "),
    deterministic: input.deterministic,
    final_status: null,               // Op-Truth §OP.5 · never set by producer
  };
}

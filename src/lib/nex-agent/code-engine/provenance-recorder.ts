// src/lib/nex-agent/code-engine/provenance-recorder.ts
//
// Records the provenance envelope for every attempt · including NEX1's
// decision trail (which distinguishes it from adapter output).

import type { Nex1DecisionTrail, Nex1ReasoningResult } from "./types";
import { sha256 } from "./context-builder";

export interface Nex1AttemptProvenance {
  readonly task_id: string;
  readonly attempt_id: string;
  readonly at: string;
  readonly adapter_id: string;
  readonly adapter_scope: "code_proposal_only";
  readonly model_id: string | null;
  readonly model_version: string | null;
  readonly prompt_hash: string;
  readonly context_hash: string;
  readonly diff_hash: string;
  readonly diff_size_lines: number;
  readonly latency_ms: number;
  readonly deterministic: boolean;
  readonly nex1_decisions: Nex1DecisionTrail;
  readonly attempted_by: "nex1";
}

/**
 * @summary Compose an attempt provenance envelope for NEX1's records.
 */
export function recordProvenance(input: {
  taskId: string;
  attemptId: string;
  promptHash: string;
  contextHash: string;
  result: Nex1ReasoningResult;
  trail: Nex1DecisionTrail;
}): Nex1AttemptProvenance {
  const diffHash = input.result.proposed_diff.length > 0 ? sha256(input.result.proposed_diff) : "empty";
  const diffLines = input.result.proposed_diff.length > 0 ? input.result.proposed_diff.split(/\r?\n/).length : 0;
  return {
    task_id: input.taskId,
    attempt_id: input.attemptId,
    at: new Date().toISOString(),
    adapter_id: input.result.adapter_id,
    adapter_scope: input.result.adapter_scope,
    model_id: input.result.model_id,
    model_version: input.result.model_version,
    prompt_hash: input.promptHash,
    context_hash: input.contextHash,
    diff_hash: diffHash,
    diff_size_lines: diffLines,
    latency_ms: input.result.latency_ms,
    deterministic: input.result.deterministic,
    nex1_decisions: input.trail,
    attempted_by: "nex1",
  };
}

// src/lib/nex-code-health/provenance.ts
//
// NEX1 · PROVENANCE RESOLVER · walks a chain backwards from any measurement.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Read-only. Deterministic. Never fabricates a chain step.

import { createHash } from "node:crypto";
import type { ProvenanceChain, ChainStep, HealthMeasurement, HealthAttribution } from "./types";
import { attribution } from "./metrics";

function sha256Prefix(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16); }

export interface ResolverInput {
  readonly claim_text?: string;                     // optional claim being backed
  readonly evidence_id: string;                     // the id being resolved
  readonly measurements?: readonly HealthMeasurement[];  // pool to search
}

/**
 * @summary Resolve a provenance chain from any evidence identifier. If the
 * identifier is a CodeHealth metric_id present in the supplied measurements,
 * unfold the full chain: claim → evidence_pointer → measurement → source →
 * source_hash → tool → methodology → reproducibility. If the identifier is
 * NOT found · fully_resolvable=false and broken_links names the missing step.
 */
export function resolveProvenance(input: ResolverInput): ProvenanceChain {
  const steps: ChainStep[] = [];
  const broken: string[] = [];
  const measurements = input.measurements ?? [];
  const target = measurements.find((m) => m.metric_id === input.evidence_id);

  // Step: claim
  const claimId = "claim:" + sha256Prefix(input.claim_text ?? "(no claim text supplied · pure provenance walk)");
  steps.push({
    step_kind: "claim",
    step_id: claimId,
    detail: { text: input.claim_text ?? "(no claim text supplied)" },
    next_step_id: "evidence:" + input.evidence_id,
  });

  // Step: evidence_pointer
  steps.push({
    step_kind: "evidence_pointer",
    step_id: "evidence:" + input.evidence_id,
    detail: { requested_evidence_id: input.evidence_id },
    next_step_id: target ? "measurement:" + target.metric_id : null,
  });
  if (!target) {
    broken.push("evidence_pointer → measurement · evidence_id not found in supplied pool");
    return finalize(input.evidence_id, steps, broken);
  }

  // Step: measurement
  steps.push({
    step_kind: "measurement",
    step_id: "measurement:" + target.metric_id,
    detail: {
      metric_id: target.metric_id, kind: target.kind, scope: target.scope,
      scope_target: target.scope_target, state: target.state, value: target.value,
      // reason and delegated_from surfaced so downstream consumers can see WHY a
      // measurement is NOT_MEASURED / INCONCLUSIVE and where a delegated value came from.
      reason: target.reason,
      delegated_from: target.delegated_from,
    },
    next_step_id: "source:" + target.source_path,
  });

  // Step: source
  steps.push({
    step_kind: "source",
    step_id: "source:" + target.source_path,
    detail: { source_path: target.source_path },
    next_step_id: "source_hash:" + target.source_hash,
  });

  // Step: source_hash
  steps.push({
    step_kind: "source_hash",
    step_id: "source_hash:" + target.source_hash,
    detail: { sha256_prefix: target.source_hash },
    next_step_id: "tool:" + target.tool + "@" + target.tool_version,
  });

  // Step: tool
  steps.push({
    step_kind: "tool",
    step_id: "tool:" + target.tool + "@" + target.tool_version,
    detail: { tool: target.tool, tool_version: target.tool_version },
    next_step_id: "methodology:" + sha256Prefix(target.methodology),
  });

  // Step: methodology
  steps.push({
    step_kind: "methodology",
    step_id: "methodology:" + sha256Prefix(target.methodology),
    detail: { methodology: target.methodology },
    next_step_id: "reproducibility:" + sha256Prefix(target.reproducibility_information.command),
  });

  // Step: reproducibility
  steps.push({
    step_kind: "reproducibility",
    step_id: "reproducibility:" + sha256Prefix(target.reproducibility_information.command),
    detail: {
      command: target.reproducibility_information.command,
      cwd: target.reproducibility_information.cwd,
      env_fingerprint: target.reproducibility_information.env_fingerprint,
      node_version: target.reproducibility_information.node_version,
      platform: target.reproducibility_information.platform,
    },
    next_step_id: null,
  });

  return finalize(input.evidence_id, steps, broken);
}

function finalize(requested_id: string, steps: readonly ChainStep[], broken: readonly string[]): ProvenanceChain {
  const integrity = sha256Prefix(steps.map((s) => s.step_kind + "|" + s.step_id).join("→"));
  return {
    record_type: "PROVENANCE_CHAIN",
    requested_id,
    steps,
    fully_resolvable: broken.length === 0,
    broken_links: broken,
    chain_integrity_hash: integrity,
    attribution: attribution(),
  };
}

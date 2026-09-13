// WO-ACADEMY-02 · deterministic verdict function.
//
// Pure. Same inputs → same verdict, always.
//
// This is the enforcement point for the founder's causal-chain
// modification (Doctrine §11.4 · TRAINING ACTIVITY ≠ ACTUAL IMPROVEMENT):
//
//   · Rule 1  REGRESSION_INTRODUCED dominates all others
//   · Rule 2  causal chain integrity — post benchmark MUST equal baseline benchmark
//   · Rule 3  evidence sufficiency
//   · Rule 4  held-out generalisation
//   · Rule 5  weakness-targeted improvement (must be measurable on the SPECIFIC weakness)
//   · Rule 6  same-benchmark improvement
//   · Rule 7  adversarial resilience
//   · Rule 8  IMPROVED (only if all above passed)

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { verifyBaselineFrozenHash } from "./baseline-freeze";
import type {
  BaselineSnapshot,
  TaskOutcome,
  TrainingRun,
  TrainingVerdict,
  TrainingVerdictKind,
} from "./types";

// ── Thresholds (frozen constants · spec §6) ────────────────────────────

export const VERDICT_THRESHOLDS = Object.freeze({
  MIN_BASELINE_EVIDENCE:       5,
  MIN_TRAINING_EVIDENCE:       5,
  GENERALISATION_MIN:          0.65,
  WEAKNESS_IMPROVEMENT_MIN:    0.10,
  IMPROVEMENT_MIN:             0.05,
  ADVERSARIAL_MIN:             0.60,
});

// ── Verdict computation ────────────────────────────────────────────────

export interface VerdictInput {
  readonly baseline: BaselineSnapshot;
  readonly run: TrainingRun;
}

export function decideTrainingVerdict(input: VerdictInput): {
  kind: TrainingVerdictKind;
  rationale: string;
  baseline_frozen_hash_verified: boolean;
  baseline_benchmark_matched: boolean;
  deltas: TrainingVerdict["deltas"];
  held_out_success_ratio: number;
  adversarial_success_ratio: number;
  regression_failures: number;
} {
  const { baseline, run } = input;
  const t = VERDICT_THRESHOLDS;

  const baseline_frozen_hash_verified = verifyBaselineFrozenHash(baseline);
  const baseline_benchmark_matched = sameSet(baseline.baseline_task_ids, run.post_baseline_outcomes.map((o) => o.task_id));

  const held_out_success_ratio = successRatio(run.generalisation_outcomes);
  const adversarial_success_ratio = successRatio(run.adversarial_outcomes);
  const regression_failures = run.regression_outcomes.filter((o) => o.outcome === "FAILURE").length;

  const deltas: TrainingVerdict["deltas"] = {
    task_completion_ratio: run.post_metrics.task_completion_ratio - baseline.baseline_metrics.task_completion_ratio,
    accuracy: run.post_metrics.accuracy - baseline.baseline_metrics.accuracy,
    reliability: run.post_metrics.reliability - baseline.baseline_metrics.reliability,
    targeted_weakness_score: run.post_metrics.targeted_weakness_score - baseline.baseline_metrics.targeted_weakness_score,
  };

  // Rule 1 · REGRESSION_INTRODUCED (dominant)
  if (regression_failures > 0) {
    return {
      kind: "REGRESSION_INTRODUCED",
      rationale: `${regression_failures} regression failure(s) — pre-training baseline remains recoverable evidence`,
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 2 · causal-chain integrity
  if (!baseline_benchmark_matched) {
    return {
      kind: "INSUFFICIENT_EVIDENCE",
      rationale: "post-training benchmark task ids did not match the frozen baseline — the causal claim cannot be evaluated (§11.4)",
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 2b · frozen-hash integrity
  if (!baseline_frozen_hash_verified) {
    return {
      kind: "INSUFFICIENT_EVIDENCE",
      rationale: "baseline frozen_hash does not verify — the baseline record may have been tampered with; verdict refused",
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 3 · evidence sufficiency
  if (baseline.baseline_task_ids.length < t.MIN_BASELINE_EVIDENCE
      || run.training_outcomes.length < t.MIN_TRAINING_EVIDENCE) {
    return {
      kind: "INSUFFICIENT_EVIDENCE",
      rationale: `baseline_tasks=${baseline.baseline_task_ids.length} training_tasks=${run.training_outcomes.length} · below thresholds (${t.MIN_BASELINE_EVIDENCE}/${t.MIN_TRAINING_EVIDENCE})`,
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 4 · held-out generalisation
  if (held_out_success_ratio < t.GENERALISATION_MIN) {
    return {
      kind: "GENERALISATION_FAILED",
      rationale: `held-out success_ratio ${held_out_success_ratio.toFixed(2)} < ${t.GENERALISATION_MIN}`,
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 5 · weakness-targeted improvement
  if (deltas.targeted_weakness_score < t.WEAKNESS_IMPROVEMENT_MIN) {
    return {
      kind: "NO_IMPROVEMENT",
      rationale: `targeted weakness delta ${deltas.targeted_weakness_score.toFixed(2)} below ${t.WEAKNESS_IMPROVEMENT_MIN} — training did not measurably improve the specific weakness it targeted (§11.4)`,
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 6 · same-benchmark improvement
  if (deltas.task_completion_ratio < t.IMPROVEMENT_MIN) {
    return {
      kind: "NO_IMPROVEMENT",
      rationale: `same-benchmark task_completion_ratio delta ${deltas.task_completion_ratio.toFixed(2)} below ${t.IMPROVEMENT_MIN}`,
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 7 · adversarial resilience
  if (adversarial_success_ratio < t.ADVERSARIAL_MIN) {
    return {
      kind: "NO_IMPROVEMENT",
      rationale: `adversarial success_ratio ${adversarial_success_ratio.toFixed(2)} < ${t.ADVERSARIAL_MIN} — candidate rules improved training set but broke under adversarial input`,
      baseline_frozen_hash_verified,
      baseline_benchmark_matched,
      deltas,
      held_out_success_ratio,
      adversarial_success_ratio,
      regression_failures,
    };
  }

  // Rule 8 · IMPROVED
  return {
    kind: "IMPROVED",
    rationale: `measurable improvement against frozen baseline: same-benchmark +${deltas.task_completion_ratio.toFixed(2)} · weakness +${deltas.targeted_weakness_score.toFixed(2)} · held-out ${held_out_success_ratio.toFixed(2)} · adversarial ${adversarial_success_ratio.toFixed(2)} · zero regression`,
    baseline_frozen_hash_verified,
    baseline_benchmark_matched,
    deltas,
    held_out_success_ratio,
    adversarial_success_ratio,
    regression_failures,
  };
}

// ── Build + persist ────────────────────────────────────────────────────

export function buildTrainingVerdict(input: {
  readonly baseline: BaselineSnapshot;
  readonly run: TrainingRun;
  readonly rule_addition_proposal_id: string | null;
  readonly antecedent_provenance_hashes: readonly string[];
}): TrainingVerdict {
  const d = decideTrainingVerdict({ baseline: input.baseline, run: input.run });
  const verdict_id = `academy-verdict-${sha256Hex(input.run.run_id + d.kind).slice(0, 16)}`;
  const base = {
    record_type: "NEX_ACADEMY_TRAINING_VERDICT" as const,
    verdict_id,
    run_id: input.run.run_id,
    baseline_id: input.baseline.baseline_id,
    kind: d.kind,
    baseline_metrics_snapshot: input.baseline.baseline_metrics,
    post_metrics_snapshot: input.run.post_metrics,
    deltas: d.deltas,
    held_out_success_ratio: d.held_out_success_ratio,
    adversarial_success_ratio: d.adversarial_success_ratio,
    regression_failures: d.regression_failures,
    baseline_frozen_hash_verified: d.baseline_frozen_hash_verified,
    baseline_benchmark_matched: d.baseline_benchmark_matched,
    rationale: d.rationale,
    // Only IMPROVED verdicts may carry a proposal id.
    rule_addition_proposal_id: d.kind === "IMPROVED" ? input.rule_addition_proposal_id : null,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

export async function persistVerdict(v: TrainingVerdict): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_training_verdicts, v);
}

// ── Helpers ────────────────────────────────────────────────────────────

function successRatio(outs: readonly TaskOutcome[]): number {
  if (outs.length === 0) return 0;
  return outs.filter((o) => o.outcome === "SUCCESS").length / outs.length;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}

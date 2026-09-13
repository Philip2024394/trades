// WO-ACADEMY-02 · frozen baseline capture.
//
// The baseline is IMMUTABLE. Once persisted, its bytes never change.
// The founder's reversibility requirement (§11.4) is realised via:
//   1. content_hash over the frozen fields (`frozen_hash`)
//   2. provenance chain hash covering the whole record
//   3. verification helper that recomputes the hash and refuses to
//      trust a baseline whose bytes have drifted from its frozen_hash
//
// Training NEVER modifies the baseline record. Verdicts reference the
// baseline by id + frozen_hash. If REGRESSION_INTRODUCED, the pre-
// training baseline remains the recoverable source of truth.

import { randomUUID, createHash } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type { BaselineMetrics, BaselineSnapshot, TrainingProgram } from "./types";

// ── Freeze ──────────────────────────────────────────────────────────────

/**
 * Compute the frozen_hash over the fields that MUST NOT change after
 * capture. Deterministic; same inputs → same hash.
 */
export function computeBaselineFrozenHash(input: {
  readonly program_id: string;
  readonly agent_id: string;
  readonly baseline_task_ids: readonly string[];
  readonly baseline_metrics: BaselineMetrics;
  readonly evidence_pointers: readonly string[];
}): string {
  const canonical = canonicalJson({
    program_id: input.program_id,
    agent_id: input.agent_id,
    baseline_task_ids: [...input.baseline_task_ids].sort(),
    baseline_metrics: input.baseline_metrics,
    evidence_pointers: [...input.evidence_pointers].sort(),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Build a BaselineSnapshot from a fresh measurement. The `captured_at`
 * timestamp is embedded in the record but excluded from `frozen_hash`
 * (which is over the substantive content — task ids, metrics, evidence).
 */
export function buildBaselineSnapshot(input: {
  readonly program: TrainingProgram;
  readonly baseline_metrics: BaselineMetrics;
  readonly evidence_pointers: readonly string[];
  readonly antecedent_provenance_hashes: readonly string[];
}): BaselineSnapshot {
  const baseline_id = `academy-baseline-${randomUUID()}`;
  const frozen_hash = computeBaselineFrozenHash({
    program_id: input.program.program_id,
    agent_id: input.program.target_agent_id,
    baseline_task_ids: input.program.baseline_task_ids,
    baseline_metrics: input.baseline_metrics,
    evidence_pointers: input.evidence_pointers,
  });
  const base = {
    record_type: "NEX_ACADEMY_BASELINE" as const,
    baseline_id,
    program_id: input.program.program_id,
    agent_id: input.program.target_agent_id,
    captured_at: new Date().toISOString(),
    baseline_task_ids: Object.freeze([...input.program.baseline_task_ids]) as readonly string[],
    baseline_metrics: input.baseline_metrics,
    evidence_pointers: Object.freeze([...input.evidence_pointers]) as readonly string[],
    frozen_hash,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

/**
 * Verify that a baseline's on-disk bytes match its self-declared
 * frozen_hash. Returns true iff bytes are unchanged since capture.
 */
export function verifyBaselineFrozenHash(b: BaselineSnapshot): boolean {
  const recomputed = computeBaselineFrozenHash({
    program_id: b.program_id,
    agent_id: b.agent_id,
    baseline_task_ids: b.baseline_task_ids,
    baseline_metrics: b.baseline_metrics,
    evidence_pointers: b.evidence_pointers,
  });
  return recomputed === b.frozen_hash;
}

// ── Persistence ─────────────────────────────────────────────────────────

export async function persistBaseline(b: BaselineSnapshot): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_baselines, b);
}

export async function loadBaseline(baseline_id: string): Promise<BaselineSnapshot | null> {
  const rows = await getStorage().query<BaselineSnapshot>(COLLECTIONS.nex_academy_baselines, {
    where: { baseline_id },
    limit: 1,
  });
  return rows[0] ?? null;
}

// WO-INTELLIGENCE-02 · deterministic training / held-out corpus split.
//
// The Hypothesis Engine must NEVER see the held-out cases. This module
// splits a test-case list deterministically by a seed the caller supplies,
// records the split as a GeneralisationSet, and returns the training list.
// The held-out list is retained in the GeneralisationSet for later use by
// the Experiment Engine.
//
// Same seed + same input → identical split (property-tested).

import { createHash } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "./provenance";
import type { GeneralisationSet } from "./types";

export interface SplitInput {
  readonly case_ids: readonly string[];
  readonly hypothesis_id: string;
  readonly seed: string;
  /** Fraction reserved as held-out (0..1). Default 0.4 → 40% held-out. */
  readonly held_out_fraction?: number;
}

export interface SplitResult {
  readonly training_case_ids: readonly string[];
  readonly held_out_case_ids: readonly string[];
  readonly generalisation_set: GeneralisationSet;
}

/**
 * Deterministic split. For every case_id, compute SHA-256(seed + case_id)
 * and interpret its first 4 bytes as a uint32; use that value modulo a
 * large prime to bucket into training vs held-out. Same seed + same
 * case_ids always produce identical assignment.
 */
export function splitCorpus(input: SplitInput): SplitResult {
  const heldOutFraction = clamp(input.held_out_fraction ?? 0.4, 0.1, 0.9);
  const training: string[] = [];
  const heldOut: string[] = [];

  // Deterministic: order caseIds by their hash before assignment
  const scored = input.case_ids.map((cid) => {
    const h = createHash("sha256").update(input.seed).update(cid).digest();
    const u32 = h.readUInt32BE(0);
    return { cid, score: u32 };
  });
  // Sort by score to enable deterministic quantile-based split
  scored.sort((a, b) => a.score - b.score);
  const holdCutoff = Math.floor(scored.length * heldOutFraction);
  for (let i = 0; i < scored.length; i++) {
    if (i < holdCutoff) heldOut.push(scored[i].cid);
    else training.push(scored[i].cid);
  }
  // Return both lists sorted deterministically
  training.sort();
  heldOut.sort();

  const set_id = `intel-genset-${sha256Hex(input.seed + input.hypothesis_id).slice(0, 16)}`;
  const base = {
    record_type: "NEX_INTELLIGENCE_GENERALISATION_SET" as const,
    set_id,
    hypothesis_id: input.hypothesis_id,
    seed: input.seed,
    training_case_ids: Object.freeze([...training]) as readonly string[],
    held_out_case_ids: Object.freeze([...heldOut]) as readonly string[],
    created_at: new Date().toISOString(),
  };
  const generalisation_set: GeneralisationSet = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  return {
    training_case_ids: generalisation_set.training_case_ids,
    held_out_case_ids: generalisation_set.held_out_case_ids,
    generalisation_set,
  };
}

/**
 * Compare training-set vs held-out-set outcomes. Promotion to Intelligence
 * tier requires BOTH thresholds met. Returns a pass/fail summary.
 */
export interface GeneralisationCheckInput {
  readonly training_success: number;
  readonly training_total: number;
  readonly held_out_success: number;
  readonly held_out_total: number;
  readonly min_ratio_training?: number;
  readonly min_ratio_held_out?: number;
}
export interface GeneralisationCheckResult {
  readonly passed: boolean;
  readonly training_ratio: number;
  readonly held_out_ratio: number;
  readonly generalises: boolean;
  readonly reason: string;
}

export function checkGeneralisation(input: GeneralisationCheckInput): GeneralisationCheckResult {
  const minTrain = input.min_ratio_training ?? 0.80;
  const minHeld = input.min_ratio_held_out ?? 0.75;
  const trainingRatio = input.training_total > 0 ? input.training_success / input.training_total : 0;
  const heldOutRatio = input.held_out_total > 0 ? input.held_out_success / input.held_out_total : 0;
  const trainingPass = trainingRatio >= minTrain;
  const heldOutPass = heldOutRatio >= minHeld;
  const generalises = heldOutPass;   // "generalisation" specifically means passing held-out
  if (trainingPass && heldOutPass) {
    return {
      passed: true, training_ratio: trainingRatio, held_out_ratio: heldOutRatio,
      generalises: true,
      reason: `training ${trainingRatio.toFixed(2)} ≥ ${minTrain} AND held-out ${heldOutRatio.toFixed(2)} ≥ ${minHeld}`,
    };
  }
  if (trainingPass && !heldOutPass) {
    return {
      passed: false, training_ratio: trainingRatio, held_out_ratio: heldOutRatio,
      generalises: false,
      reason: `training passed (${trainingRatio.toFixed(2)}) but held-out ${heldOutRatio.toFixed(2)} < ${minHeld} — does NOT generalise`,
    };
  }
  return {
    passed: false, training_ratio: trainingRatio, held_out_ratio: heldOutRatio,
    generalises,
    reason: `training ratio ${trainingRatio.toFixed(2)} < ${minTrain}`,
  };
}

export async function persistGeneralisationSet(g: GeneralisationSet): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intelligence_generalisation_sets, g);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

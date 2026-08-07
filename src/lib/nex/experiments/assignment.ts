// NEX A/B Testing · deterministic sticky assignment
//
// Invariant #13: A contact receives exactly one variant assignment
// per experiment, and that assignment is reproducible from the
// immutable experiment/contact inputs.
//
// FNV-1a 32-bit hash → mod 10000 → walk allocation percentages.
// Pure function · no randomness · no I/O.

import { withClient } from "@/lib/nex/delivery/db";
import type { Experiment, ExperimentVariant } from "./types";

/** FNV-1a 32-bit · deterministic · same input → same output across environments. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;                          // uint32 wrap
  }
  return h;
}

/**
 * Pure assignment function · zero I/O · testable in isolation.
 * Given the experiment + variant list + contact_id, always returns the same variant.
 * Variants must be sorted deterministically by caller (we sort by variant_id).
 */
export function computeVariant(experiment_id: string, seed: number, contact_id: string, variants: ExperimentVariant[]): { variant_id: string; computed_hash: number; bucket: number } {
  const sorted = [...variants].sort((a, b) => a.variant_id.localeCompare(b.variant_id));
  const hash = fnv1a(`${experiment_id}:${contact_id}:${seed}`);
  const bucket = hash % 10000;
  let cum = 0;
  for (const v of sorted) {
    cum += Math.round(v.allocation_pct * 100);            // e.g. 50% → 5000
    if (bucket < cum) return { variant_id: v.variant_id, computed_hash: hash, bucket };
  }
  // Fallback · allocation sums to <100 · put the residual in the last variant
  return { variant_id: sorted[sorted.length - 1].variant_id, computed_hash: hash, bucket };
}

/**
 * Sticky lookup or create.
 * INSERT ON CONFLICT DO NOTHING → if the row already exists, we read it back
 * → duplicate ticks cannot reassign (invariant #13).
 */
export async function getOrAssign(experiment: Experiment, variants: ExperimentVariant[], contact_id: string): Promise<{ variant_id: string; was_new: boolean; computed_hash: number }> {
  const { variant_id, computed_hash } = computeVariant(experiment.experiment_id, experiment.seed, contact_id, variants);
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.experiment_assignments (experiment_id, contact_id, variant_id, computed_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (experiment_id, contact_id) DO NOTHING
       RETURNING variant_id`,
      [experiment.experiment_id, contact_id, variant_id, computed_hash],
    );
    if (res.rows[0]) return { variant_id: String(res.rows[0].variant_id), was_new: true, computed_hash };
    // Existing assignment · read back (may differ from computed if allocation changed post-assignment · sticky wins)
    const back = await c.query(`SELECT variant_id, computed_hash FROM nex.experiment_assignments WHERE experiment_id = $1 AND contact_id = $2`, [experiment.experiment_id, contact_id]);
    if (!back.rows[0]) return { variant_id, was_new: false, computed_hash };            // shouldn't happen
    return { variant_id: String(back.rows[0].variant_id), was_new: false, computed_hash: Number(back.rows[0].computed_hash) };
  });
  return r ?? { variant_id, was_new: false, computed_hash };
}

/** Read-only assignment lookup · returns null when not assigned. */
export async function getAssignment(experiment_id: string, contact_id: string): Promise<{ variant_id: string; assigned_at: string; computed_hash: number } | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT variant_id, assigned_at, computed_hash FROM nex.experiment_assignments WHERE experiment_id = $1 AND contact_id = $2`, [experiment_id, contact_id]);
    if (!res.rows[0]) return null;
    return { variant_id: String(res.rows[0].variant_id), assigned_at: String(res.rows[0].assigned_at), computed_hash: Number(res.rows[0].computed_hash) };
  });
  return r ?? null;
}

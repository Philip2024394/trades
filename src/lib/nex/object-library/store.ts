// Object Library · in-memory store + versioning + similarity.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

import type { ObjectDNA, ObjectFamily, ObjectShapeSignature, ObjectVersionEntry } from "./types";

const STORE = new Map<string, ObjectDNA>();
let idCounters = new Map<ObjectFamily, number>();

/** Register a new ObjectDNA. Rejects if id already exists · use upsert for edits. */
export function register(obj: ObjectDNA): ObjectDNA {
  if (STORE.has(obj.object_id)) throw new Error(`ObjectDNA already registered: ${obj.object_id}`);
  STORE.set(obj.object_id, obj);
  return obj;
}

/** Reserve the next auto-id for a given family · e.g. "STAIR_HANDRAIL_000001". */
export function nextId(family: ObjectFamily): string {
  const n = (idCounters.get(family) ?? 0) + 1;
  idCounters.set(family, n);
  return `${family}_${String(n).padStart(6, "0")}`;
}

export function get(object_id: string): ObjectDNA | undefined { return STORE.get(object_id); }
export function count(): number { return STORE.size; }
export function all(): readonly ObjectDNA[] { return Array.from(STORE.values()); }
export function byFamily(family: ObjectFamily): readonly ObjectDNA[] { return all().filter((o) => o.family === family); }
export function clear(): void { STORE.clear(); idCounters = new Map(); }

/** Update an existing object · returns the new version. Appends a version entry
 *  to history · never rewrites prior versions · never mutates the input. */
export function upsertVersion(object_id: string, changes: readonly string[], changed_by: string, patch: Partial<Omit<ObjectDNA, "object_id" | "family" | "history" | "created_at">>, new_confidence?: number): ObjectDNA {
  const existing = STORE.get(object_id);
  if (!existing) throw new Error(`Cannot upsertVersion · unknown object_id: ${object_id}`);
  const nextVersionNumber = (existing.history[existing.history.length - 1]?.version ?? 0) + 1;
  const at = new Date().toISOString();
  const versionEntry: ObjectVersionEntry = {
    version: nextVersionNumber,
    captured_at: at,
    changes: [...changes],
    changed_by,
    confidence: new_confidence ?? existing.aggregate_confidence,
  };
  const next: ObjectDNA = {
    ...existing,
    ...patch,
    history: [...existing.history, versionEntry],
    aggregate_confidence: new_confidence ?? existing.aggregate_confidence,
    updated_at: at,
  };
  STORE.set(object_id, next);
  return next;
}

/** Boost an object's aggregate_confidence and observation_count. Used by
 *  Visual Learning when a new upload matches an existing object. Delta capped
 *  so a single upload never lifts confidence above the theoretical maximum. */
export function reinforce(object_id: string, delta: number, changed_by: string, evidence_asset_id?: string): ObjectDNA {
  const existing = STORE.get(object_id);
  if (!existing) throw new Error(`Cannot reinforce · unknown object_id: ${object_id}`);
  const cappedDelta = Math.max(0, Math.min(delta, 1 - existing.aggregate_confidence));
  const changes: string[] = [`observation_count ${existing.observation_count} → ${existing.observation_count + 1}`];
  if (cappedDelta > 0) changes.push(`aggregate_confidence +${cappedDelta.toFixed(3)}`);
  if (evidence_asset_id) changes.push(`evidence added: ${evidence_asset_id}`);
  const image_example_asset_ids = evidence_asset_id && !existing.image_example_asset_ids.includes(evidence_asset_id)
    ? [...existing.image_example_asset_ids, evidence_asset_id]
    : existing.image_example_asset_ids;
  return upsertVersion(object_id, changes, changed_by, {
    image_example_asset_ids,
    observation_count: existing.observation_count + 1,
  }, existing.aggregate_confidence + cappedDelta);
}

/** Shape + family + style-based similarity (0..1). Higher = more likely the same object. */
export function similarity(a: Pick<ObjectDNA, "family" | "shape" | "style" | "dimensions">, b: Pick<ObjectDNA, "family" | "shape" | "style" | "dimensions">): number {
  if (a.family !== b.family) return 0;
  let score = 0.3;                                       // same family baseline
  if (a.shape.primary_shape === b.shape.primary_shape) score += 0.2;
  if (a.shape.edge_treatment && a.shape.edge_treatment === b.shape.edge_treatment) score += 0.1;
  if (a.shape.style_class && a.shape.style_class === b.shape.style_class) score += 0.1;
  if (a.shape.proportions && a.shape.proportions === b.shape.proportions) score += 0.05;
  if (a.style && a.style === b.style) score += 0.1;
  const da = a.dimensions ?? {};
  const db = b.dimensions ?? {};
  for (const k of ["length_mm", "width_mm", "height_mm", "depth_mm", "diameter_mm", "thickness_mm"] as const) {
    const va = da[k];
    const vb = db[k];
    if (va !== undefined && vb !== undefined) {
      const rel = Math.abs(va - vb) / Math.max(va, vb, 1);
      if (rel < 0.05) score += 0.03;
    }
  }
  return Math.min(1, Math.round(score * 100) / 100);
}

/** Find candidates that potentially match a proposed new object · sorted by similarity descending. */
export function findMatches(candidate: Pick<ObjectDNA, "family" | "shape" | "style" | "dimensions">, min_similarity: number = 0.6): readonly { object: ObjectDNA; similarity: number }[] {
  const results = all()
    .map((o) => ({ object: o, similarity: similarity(o, candidate) }))
    .filter((r) => r.similarity >= min_similarity)
    .sort((a, b) => b.similarity - a.similarity);
  return results;
}

/** Merge two objects: keep `keep_id`, absorb `merge_id` (append its variants + evidence + observations · redirect future references). */
export function merge(keep_id: string, merge_id: string, reason: string, changed_by: string): { kept: ObjectDNA; merged: ObjectDNA } {
  if (keep_id === merge_id) throw new Error("Cannot merge an object with itself");
  const kept = STORE.get(keep_id);
  const merged = STORE.get(merge_id);
  if (!kept || !merged) throw new Error(`Cannot merge · missing object(s): ${keep_id} / ${merge_id}`);
  const evidence = Array.from(new Set([...kept.image_example_asset_ids, ...merged.image_example_asset_ids]));
  const variants = [...(kept.variants ?? []), ...(merged.variants ?? [])];
  const compatible = Array.from(new Set([...kept.compatible_objects, ...merged.compatible_objects]));
  const observation_count = kept.observation_count + merged.observation_count;
  const newConfidence = Math.min(1, Math.max(kept.aggregate_confidence, merged.aggregate_confidence) + 0.02);
  const changes = [`merged ${merge_id} into ${keep_id}: ${reason}`, `variants +${(merged.variants ?? []).length}`, `evidence +${merged.image_example_asset_ids.length}`, `observation_count +${merged.observation_count}`];
  const nextKept = upsertVersion(keep_id, changes, changed_by, {
    image_example_asset_ids: evidence,
    variants,
    compatible_objects: compatible,
    observation_count,
  }, newConfidence);
  STORE.delete(merge_id);
  return { kept: nextKept, merged };
}

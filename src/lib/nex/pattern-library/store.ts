// Visual Pattern Library · in-memory store + versioning + similarity.
//
// Doctrine: docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md

import type { PatternDNA, PatternFamily, PatternVersionEntry, PatternApplication } from "./types";

const STORE = new Map<string, PatternDNA>();

export function register(pattern: PatternDNA): PatternDNA {
  if (STORE.has(pattern.pattern_id)) throw new Error(`PatternDNA already registered: ${pattern.pattern_id}`);
  STORE.set(pattern.pattern_id, pattern);
  return pattern;
}

export function get(pattern_id: string): PatternDNA | undefined { return STORE.get(pattern_id); }
export function count(): number { return STORE.size; }
export function all(): readonly PatternDNA[] { return Array.from(STORE.values()); }
export function byFamily(family: PatternFamily): readonly PatternDNA[] { return all().filter((p) => p.family === family); }
export function clear(): void { STORE.clear(); }

export function upsertVersion(pattern_id: string, changes: readonly string[], changed_by: string, patch: Partial<Omit<PatternDNA, "pattern_id" | "family" | "history" | "created_at">>, new_confidence?: number): PatternDNA {
  const existing = STORE.get(pattern_id);
  if (!existing) throw new Error(`Cannot upsertVersion · unknown pattern_id: ${pattern_id}`);
  const nextVersionNumber = (existing.history[existing.history.length - 1]?.version ?? 0) + 1;
  const at = new Date().toISOString();
  const versionEntry: PatternVersionEntry = {
    version: nextVersionNumber,
    captured_at: at,
    changes: [...changes],
    changed_by,
    confidence: new_confidence ?? existing.aggregate_confidence,
  };
  const next: PatternDNA = {
    ...existing,
    ...patch,
    history: [...existing.history, versionEntry],
    aggregate_confidence: new_confidence ?? existing.aggregate_confidence,
    updated_at: at,
  };
  STORE.set(pattern_id, next);
  return next;
}

/** Add evidence + bump observation_count and confidence (capped). */
export function reinforce(pattern_id: string, delta: number, changed_by: string, evidence_asset_id?: string): PatternDNA {
  const existing = STORE.get(pattern_id);
  if (!existing) throw new Error(`Cannot reinforce · unknown pattern_id: ${pattern_id}`);
  const cappedDelta = Math.max(0, Math.min(delta, 1 - existing.aggregate_confidence));
  const changes: string[] = [`observation_count ${existing.observation_count} → ${existing.observation_count + 1}`];
  if (cappedDelta > 0) changes.push(`aggregate_confidence +${cappedDelta.toFixed(3)}`);
  if (evidence_asset_id) changes.push(`evidence added: ${evidence_asset_id}`);
  const banner_example_asset_ids = evidence_asset_id && !existing.banner_example_asset_ids.includes(evidence_asset_id)
    ? [...existing.banner_example_asset_ids, evidence_asset_id]
    : existing.banner_example_asset_ids;
  return upsertVersion(pattern_id, changes, changed_by, {
    banner_example_asset_ids,
    observation_count: existing.observation_count + 1,
  }, existing.aggregate_confidence + cappedDelta);
}

/** Similarity between a candidate pattern signature and a stored PatternDNA (0..1). */
export function similarity(a: Pick<PatternDNA, "family" | "layout" | "cta_placement">, b: Pick<PatternDNA, "family" | "layout" | "cta_placement">): number {
  if (a.family !== b.family) return 0;
  let score = 0.3;
  if (a.layout.hero_position === b.layout.hero_position) score += 0.2;
  if (a.layout.columns === b.layout.columns) score += 0.1;
  if (a.cta_placement === b.cta_placement) score += 0.2;
  const sharedRatios = a.layout.aspect_ratios.filter((r) => b.layout.aspect_ratios.includes(r)).length;
  if (sharedRatios > 0) score += Math.min(0.2, sharedRatios * 0.07);
  return Math.min(1, Math.round(score * 100) / 100);
}

export function findMatches(candidate: Pick<PatternDNA, "family" | "layout" | "cta_placement">, min_similarity: number = 0.6): readonly { pattern: PatternDNA; similarity: number }[] {
  return all()
    .map((p) => ({ pattern: p, similarity: similarity(p, candidate) }))
    .filter((r) => r.similarity >= min_similarity)
    .sort((a, b) => b.similarity - a.similarity);
}

/** Apply a pattern to a set of object bindings · returns a PatternApplication.
 *  Validates that every REQUIRED slot has a binding. */
export function applyPattern(pattern_id: string, object_bindings: Record<string, string>, opts?: { overrides?: Record<string, unknown>; provenance?: string }): PatternApplication {
  const pattern = STORE.get(pattern_id);
  if (!pattern) throw new Error(`Cannot apply · unknown pattern_id: ${pattern_id}`);
  const missing: string[] = [];
  for (const slot of pattern.object_slot_bindings) {
    if (slot.required && !object_bindings[slot.slot_id]) missing.push(slot.slot_id);
  }
  if (missing.length > 0) throw new Error(`applyPattern missing required slot bindings: ${missing.join(", ")}`);
  return {
    pattern_id,
    applied_at: new Date().toISOString(),
    object_bindings,
    overrides: opts?.overrides,
    provenance: opts?.provenance ?? `applied ${pattern.display_name}`,
  };
}

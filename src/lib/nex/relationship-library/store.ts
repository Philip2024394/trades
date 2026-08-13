// Object Relationship Library · in-memory typed-edge store.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import type { ObjectRelationship, RelationshipKind, RelationshipQuery } from "./types";

const EDGES = new Map<string, ObjectRelationship>();

function keyFor(from_object_id: string, kind: RelationshipKind, to_object_id: string): string {
  return `${from_object_id}::${kind}::${to_object_id}`;
}

/** Assert a typed edge · idempotent · reinforces if already present. */
export function assertRelationship(edge: Omit<ObjectRelationship, "observed_count" | "evidence_asset_ids" | "provenance"> & { evidence_asset_id?: string; provenance?: { named_expert: string; authored: string } }): ObjectRelationship {
  const key = keyFor(edge.from_object_id, edge.kind, edge.to_object_id);
  const existing = EDGES.get(key);
  const provenance = edge.provenance ?? { named_expert: "Philip O'Farrell", authored: "2026-08-04" };
  if (existing) {
    const evidence = edge.evidence_asset_id && !existing.evidence_asset_ids.includes(edge.evidence_asset_id)
      ? [...existing.evidence_asset_ids, edge.evidence_asset_id]
      : existing.evidence_asset_ids;
    const cappedDelta = Math.max(0, Math.min(0.05, 1 - existing.confidence));
    const next: ObjectRelationship = {
      ...existing,
      observed_count: existing.observed_count + 1,
      confidence: Math.min(1, existing.confidence + cappedDelta),
      evidence_asset_ids: evidence,
      reason: edge.reason ?? existing.reason,
    };
    EDGES.set(key, next);
    return next;
  }
  const initial: ObjectRelationship = {
    from_object_id: edge.from_object_id,
    to_object_id: edge.to_object_id,
    kind: edge.kind,
    confidence: edge.confidence,
    reason: edge.reason,
    evidence_asset_ids: edge.evidence_asset_id ? [edge.evidence_asset_id] : [],
    observed_count: 1,
    provenance,
  };
  EDGES.set(key, initial);
  return initial;
}

export function get(from_object_id: string, kind: RelationshipKind, to_object_id: string): ObjectRelationship | undefined {
  return EDGES.get(keyFor(from_object_id, kind, to_object_id));
}

export function count(): number { return EDGES.size; }

export function all(): readonly ObjectRelationship[] { return Array.from(EDGES.values()); }

export function clear(): void { EDGES.clear(); }

export function query(q: RelationshipQuery): readonly ObjectRelationship[] {
  return all().filter((e) => {
    if (q.from_object_id && e.from_object_id !== q.from_object_id) return false;
    if (q.to_object_id && e.to_object_id !== q.to_object_id) return false;
    if (q.kind && e.kind !== q.kind) return false;
    if (q.min_confidence !== undefined && e.confidence < q.min_confidence) return false;
    return true;
  });
}

/** Build a text summary of everything Nex knows about an object · used by Voice. */
export function describeObject(object_id: string): string {
  const outgoing = query({ from_object_id: object_id });
  if (outgoing.length === 0) return `${object_id}: no relationships recorded.`;
  const lines = outgoing.map((e) => `  ${e.kind} → ${e.to_object_id} (confidence ${e.confidence.toFixed(2)} · observed ${e.observed_count}×)`);
  return `${object_id}:\n${lines.join("\n")}`;
}

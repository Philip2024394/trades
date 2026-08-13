// Interior Relationship Engine · in-memory design graph.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import type { RelationshipEdge, RelationshipKind, PropagationRule, PropagationEvent } from "./types";

const EDGES: RelationshipEdge[] = [];

export function addRelationship(edge: Omit<RelationshipEdge, "edge_id"> & { edge_id?: string }): RelationshipEdge {
  const full: RelationshipEdge = {
    edge_id: edge.edge_id ?? `edge_${EDGES.length + 1}`,
    ...edge,
  };
  EDGES.push(full);
  return full;
}

export function listEdges(): readonly RelationshipEdge[] { return [...EDGES]; }

export function count(): number { return EDGES.length; }

export function clear(): void { EDGES.length = 0; }

export function edgesFrom(from_id: string): readonly RelationshipEdge[] {
  return EDGES.filter((e) => e.from_id === from_id);
}

export function edgesTo(to_id: string): readonly RelationshipEdge[] {
  return EDGES.filter((e) => e.to_id === to_id);
}

export function edgesBetween(from_id: string, to_id: string): readonly RelationshipEdge[] {
  return EDGES.filter((e) => (e.from_id === from_id && e.to_id === to_id) || (e.from_id === to_id && e.to_id === from_id));
}

export function edgesOfKind(kind: RelationshipKind): readonly RelationshipEdge[] {
  return EDGES.filter((e) => e.kind === kind);
}

/** Walk related objects up to `depth` hops · deduplicating cycles. Returns the
 *  set of object ids reachable from the source. */
export function walkRelated(from_id: string, depth: number = 2): readonly string[] {
  const visited = new Set<string>([from_id]);
  const frontier = [from_id];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of EDGES) {
        const neighbour = e.from_id === id ? e.to_id : e.to_id === id ? e.from_id : undefined;
        if (neighbour && !visited.has(neighbour)) {
          visited.add(neighbour);
          next.push(neighbour);
        }
      }
    }
    frontier.length = 0;
    frontier.push(...next);
    if (frontier.length === 0) break;
  }
  visited.delete(from_id);
  return Array.from(visited);
}

/** Given a property change on `from_id`, compute which related objects should
 *  receive a propagation event. Never mutates anything · returns a plan. */
export function planPropagation(from_id: string, property: string, before: unknown, after: unknown): PropagationEvent {
  const RULE_MATCHES: Record<string, PropagationRule> = {
    material: "propagate_material",
    style: "propagate_style",
    finish: "propagate_finish",
    theme_pack: "propagate_theme_pack",
  };
  const requiredRule = RULE_MATCHES[property];
  const affected: PropagationEvent["affected"] = [];
  for (const e of EDGES) {
    if (e.from_id !== from_id) continue;
    if (!requiredRule || e.propagation === requiredRule) {
      affected.push({ to_id: e.to_id, edge_id: e.edge_id, via: e.propagation });
    }
  }
  return { from_id, property, before, after, affected };
}

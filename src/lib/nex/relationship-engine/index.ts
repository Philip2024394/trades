// Interior Relationship Engine · public exports.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export {
  addRelationship, listEdges, count, clear,
  edgesFrom, edgesTo, edgesBetween, edgesOfKind,
  walkRelated, planPropagation,
} from "./graph";
export type { RelationshipEdge, RelationshipKind, PropagationRule, PropagationEvent } from "./types";

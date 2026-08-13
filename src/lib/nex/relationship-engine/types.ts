// Interior Relationship Engine · types.
//
// Objects never exist alone. Every relationship becomes a first-class edge in
// the design graph with a kind + propagation rule.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export type RelationshipKind =
  | "matches_material"                   // oak staircase ↔ oak flooring
  | "coordinates_with"                   // shaker kitchen ↔ shaker doors
  | "adjacent_to"                        // staircase ↔ landing
  | "supports"                           // stringer supports treads
  | "contains"                           // kitchen contains island
  | "reflects"                           // glass reflects window
  | "shadows"                            // wall shadows floor
  | "opposes";                           // luxury_burgundy opposes sales_event

export type PropagationRule =
  | "propagate_material"                 // if source material changes → propagate to related
  | "propagate_style"                    // if style changes → propagate
  | "propagate_finish"                   // if finish changes → propagate
  | "propagate_theme_pack"               // if theme changes → propagate
  | "propagate_none";                    // relationship only · no propagation

export type RelationshipEdge = {
  edge_id: string;
  from_id: string;                       // DesignObject id or Vision object_id
  to_id: string;
  kind: RelationshipKind;
  propagation: PropagationRule;
  reason?: string;
  strength: number;                      // 0..1 · how tight the coupling
};

export type PropagationEvent = {
  from_id: string;
  property: string;                      // e.g. "material" · "style" · "finish" · "theme_pack"
  before: unknown;
  after: unknown;
  affected: readonly { to_id: string; edge_id: string; via: PropagationRule }[];
};

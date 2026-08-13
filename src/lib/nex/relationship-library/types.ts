// Object Relationship Library · types (Philip 2026-08-04).
//
// DISTINCT from `relationship-engine` (which is a per-scene composition graph).
// This is the TAXONOMY of typed object relationships that lets Nex reason like
// a designer:
//
//   Loft Ladder
//     → requires → Loft Hatch
//     → mounted_in → Ceiling
//     → inside → Room
//     → used_for → Loft Access
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

export type RelationshipKind =
  | "requires"                             // A requires B to function
  | "mounted_in"                           // A is fitted into B
  | "mounted_on"                           // A is fixed to the surface of B
  | "inside"                               // A is contained within B (spatial)
  | "connects_to"                          // A physically joins to B
  | "supports"                             // A carries load from B (structural)
  | "used_for"                             // A serves the purpose B
  | "compatible_with"                      // A pairs with B aesthetically
  | "incompatible_with"                    // A does not pair with B
  | "replaces"                             // A can substitute for B
  | "produced_by"                          // A comes off machine/process B
  | "sold_by";                             // A supplied by manufacturer B

export type ObjectRelationship = {
  from_object_id: string;                  // ObjectDNA id (or Object Library family reference)
  kind: RelationshipKind;
  to_object_id: string;                    // ObjectDNA id (or free-text noun for external entities)
  confidence: number;                      // 0..1 · reinforced with evidence
  evidence_asset_ids: readonly string[];   // UniversalAsset ids
  reason?: string;
  observed_count: number;
  provenance: { named_expert: string; authored: string };
};

export type RelationshipQuery = {
  from_object_id?: string;
  to_object_id?: string;
  kind?: RelationshipKind;
  min_confidence?: number;
};

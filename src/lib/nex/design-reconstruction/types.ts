// Design Reconstruction Engine · types.
//
// Turns a VisionAnalysis (or SketchInterpretation) into an EDITABLE Design
// Document. Users then edit design OBJECTS · not pixels.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

export type EditableObject = {
  id: string;
  kind: string;                          // "staircase" · "kitchen_island" · "table_lamp" · etc.
  material?: string;
  finish?: string;
  confidence: number;                    // 0..1
  editable_properties: readonly string[]; // paths the user can change
  source_evidence: readonly string[];    // vision object_ids or sketch component_ids
};

export type EditableRelationship = {
  from_id: string;
  to_id: string;
  kind: string;                          // "matches_material" · "adjacent_to" · etc.
};

export type EditableDesignDocument = {
  document_id: string;
  source_kind: "vision" | "sketch" | "reality_reconstruction" | "multi_modal";
  source_evidence_asset_id?: string;
  objects: readonly EditableObject[];
  relationships: readonly EditableRelationship[];
  scene_summary: string;
  style_snapshot?: {
    palette?: readonly string[];
    warmth_score?: number;
    style_label?: string;
  };
  provenance: {
    reconstructor_version: string;
    generated_at: string;
    confidence_overall: number;
  };
};

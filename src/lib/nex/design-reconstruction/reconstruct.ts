// Design Reconstruction Engine · reconstruct() function.
//
// Composes a VisionAnalysis (from Vision Intelligence Platform) into an
// EditableDesignDocument. Never invents objects · every entry traces to a
// vision or sketch source id.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { EditableDesignDocument, EditableObject, EditableRelationship } from "./types";
import type { VisionAnalysis } from "../vision-intelligence";
import type { SketchInterpretation } from "../sketch-intelligence";

const RECONSTRUCTOR_VERSION = "e10_reconstructor_mvp_1.0";

export function reconstructFromVision(analysis: VisionAnalysis, opts?: { document_id?: string }): EditableDesignDocument {
  const objects: EditableObject[] = analysis.objects.map((o) => ({
    id: `edit_${o.object_id}`,
    kind: o.type,
    material: o.material,
    finish: o.finish,
    confidence: o.confidence,
    editable_properties: ["material", "finish", "position"],
    source_evidence: [o.object_id],
  }));
  const relationships: EditableRelationship[] = analysis.relationships.map((r) => ({
    from_id: `edit_${r.from_id}`,
    to_id: `edit_${r.to_id}`,
    kind: r.kind,
  }));
  const confidence_overall = objects.length ? objects.reduce((s, o) => s + o.confidence, 0) / objects.length : 0.5;
  return {
    document_id: opts?.document_id ?? `doc_${analysis.source_asset_id}`,
    source_kind: "vision",
    source_evidence_asset_id: analysis.source_asset_id,
    objects,
    relationships,
    scene_summary: `${analysis.scene.room_type ?? "unspecified room"} · style=${analysis.scene.style ?? "unspecified"} · warmth=${analysis.mood.overall_warmth_score}`,
    style_snapshot: {
      palette: analysis.mood.dominant_palette,
      warmth_score: analysis.mood.overall_warmth_score,
      style_label: analysis.mood.style_label,
    },
    provenance: {
      reconstructor_version: RECONSTRUCTOR_VERSION,
      generated_at: new Date().toISOString(),
      confidence_overall: Math.round(confidence_overall * 100) / 100,
    },
  };
}

export function reconstructFromSketch(interpretation: SketchInterpretation, opts?: { document_id?: string }): EditableDesignDocument {
  const objects: EditableObject[] = interpretation.components.map((c) => ({
    id: `edit_${c.component_id}`,
    kind: `${interpretation.object_match.object_kind}.${c.role}`,
    material: c.material,
    confidence: c.confidence,
    editable_properties: ["material", "finish", "position"],
    source_evidence: [c.component_id],
  }));
  return {
    document_id: opts?.document_id ?? `doc_${interpretation.sketch_id}`,
    source_kind: "sketch",
    source_evidence_asset_id: interpretation.sketch_id,
    objects,
    relationships: [],
    scene_summary: `${interpretation.object_match.object_kind} · style=${interpretation.style.style}`,
    provenance: {
      reconstructor_version: RECONSTRUCTOR_VERSION,
      generated_at: new Date().toISOString(),
      confidence_overall: interpretation.confidence.overall_confidence,
    },
  };
}

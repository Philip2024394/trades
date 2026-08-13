// Multi-Modal Design Intelligence · ingest() orchestrator.
//
// Dispatches every input through UDL · fuses the resulting Design Documents
// into ONE editable document. Records per-modality provenance so consumers
// can trace which modality contributed which knowledge.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { MultiModalRequest, MultiModalResult, ModalityProvenance } from "./types";
import type { EditableDesignDocument, EditableObject, EditableRelationship } from "../design-reconstruction";
import type { UDLResult } from "../udl";
import { convert } from "../udl";

const VERSION = "e15_multimodal_mvp_1.0";

function fuseDocuments(request_id: string, results: readonly UDLResult[]): EditableDesignDocument {
  const objects: EditableObject[] = [];
  const relationships: EditableRelationship[] = [];
  const seen = new Set<string>();
  const paletteUnion = new Set<string>();
  let warmthSum = 0, warmthCount = 0;
  let styleLabel: string | undefined;

  for (const r of results) {
    for (const o of r.design_document.objects) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      objects.push(o);
    }
    for (const rel of r.design_document.relationships) {
      relationships.push(rel);
    }
    if (r.design_document.style_snapshot?.palette) {
      for (const c of r.design_document.style_snapshot.palette) paletteUnion.add(c);
    }
    if (r.design_document.style_snapshot?.warmth_score !== undefined) {
      warmthSum += r.design_document.style_snapshot.warmth_score;
      warmthCount += 1;
    }
    if (!styleLabel && r.design_document.style_snapshot?.style_label) {
      styleLabel = r.design_document.style_snapshot.style_label;
    }
  }

  const confidence_overall = results.length ? results.reduce((s, r) => s + r.provenance.confidence, 0) / results.length : 0.5;
  return {
    document_id: `doc_${request_id}`,
    source_kind: "multi_modal",
    objects,
    relationships,
    scene_summary: `fused ${results.length} modalities · objects=${objects.length}`,
    style_snapshot: {
      palette: Array.from(paletteUnion),
      warmth_score: warmthCount ? Math.round(warmthSum / warmthCount) : undefined,
      style_label: styleLabel,
    },
    provenance: {
      reconstructor_version: VERSION,
      generated_at: new Date().toISOString(),
      confidence_overall: Math.round(confidence_overall * 100) / 100,
    },
  };
}

function inputId(input: import("../udl").UDLInput): string {
  switch (input.modality) {
    case "sketch": return input.sketch_id;
    case "photo": case "cad": case "pdf": case "scan_3d": case "video": return input.asset_id;
    case "voice": case "text": return input.utterance_id;
  }
}

export function ingest(request: MultiModalRequest): MultiModalResult {
  const per_modality: UDLResult[] = [];
  const provenance_by_modality: ModalityProvenance[] = [];
  for (const input of request.inputs) {
    try {
      const r = convert(input);
      per_modality.push(r);
      provenance_by_modality.push({
        modality: input.modality,
        input_id: inputId(input),
        confidence: r.provenance.confidence,
        contribution: `${r.design_document.objects.length} objects · ${r.design_document.relationships.length} relationships`,
      });
    } catch (err) {
      provenance_by_modality.push({
        modality: input.modality,
        input_id: inputId(input),
        confidence: 0,
        contribution: `skipped: ${(err as Error).message}`,
      });
    }
  }
  const fused = fuseDocuments(request.request_id, per_modality);
  const fused_confidence = per_modality.length ? per_modality.reduce((s, r) => s + r.provenance.confidence, 0) / per_modality.length : 0;
  return {
    request_id: request.request_id,
    design_document: fused,
    per_modality,
    provenance_by_modality,
    fused_confidence: Math.round(fused_confidence * 100) / 100,
    orchestrator_version: VERSION,
    generated_at: new Date().toISOString(),
  };
}

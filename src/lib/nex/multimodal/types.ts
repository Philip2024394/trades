// Multi-Modal Design Intelligence · types.
//
// Final ingestion orchestrator. Multiple UDL inputs → single Design Document
// with fusion + provenance per modality.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { UDLInput, UDLResult } from "../udl";
import type { EditableDesignDocument } from "../design-reconstruction";

export type MultiModalRequest = {
  request_id: string;
  inputs: readonly UDLInput[];
};

export type ModalityProvenance = {
  modality: string;
  input_id: string;                      // e.g. sketch_id · asset_id · utterance_id
  confidence: number;
  contribution: string;                  // "object list" · "material" · "measurements" · etc.
};

export type MultiModalResult = {
  request_id: string;
  design_document: EditableDesignDocument;
  per_modality: readonly UDLResult[];
  provenance_by_modality: readonly ModalityProvenance[];
  fused_confidence: number;
  orchestrator_version: string;
  generated_at: string;
};

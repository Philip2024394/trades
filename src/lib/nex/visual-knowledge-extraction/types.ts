// Visual Knowledge Extraction Platform (VKEP) · types.
//
// Philip 2026-08-04 refinement: "Design Memory never stores 'images' as its
// primary knowledge. It stores understood design knowledge, with the original
// image attached as evidence." VKEP is the dedicated ingestion pipeline that
// runs Vision Intelligence + Sketch Intelligence + Reality Reconstruction +
// Design Reconstruction · then writes STRUCTURED KNOWLEDGE to Design Memory
// with the raw image referenced only as evidence.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { EditableDesignDocument } from "../design-reconstruction";
import type { VisionAnalysis } from "../vision-intelligence";
import type { SketchInterpretation } from "../sketch-intelligence";
import type { RoomReconstruction } from "../reality-reconstruction";

export type VKEPInputKind = "photo" | "sketch" | "room_photos";

export type VKEPRequest =
  | { kind: "photo"; asset_id: string; project_id: string; hints?: Record<string, unknown> }
  | { kind: "sketch"; sketch_id: string; project_id: string; source: string; user_intent?: string; requested_material?: string; requested_style?: string; detected_primitives?: readonly unknown[] }
  | { kind: "room_photos"; reconstruction_id: string; project_id: string; photos: readonly { photo_id: string; url?: string; hint_room_type?: string; known_reference?: { object_kind: string; real_length_mm: number; pixel_length: number } }[]; room_type_hint?: string };

export type VKEPExtraction = {
  extraction_id: string;
  project_id: string;
  input_kind: VKEPInputKind;
  design_document: EditableDesignDocument;
  vision_analysis?: VisionAnalysis;
  sketch_interpretation?: SketchInterpretation;
  room_reconstruction?: RoomReconstruction;

  // Evidence chain · original bytes referenced only, NEVER a design decision source.
  evidence_asset_ids: readonly string[];

  // Where the structured knowledge lands
  design_memory_entry_id?: string;

  extractor_version: string;
  generated_at: string;
};

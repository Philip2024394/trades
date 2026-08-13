// Universal Design Language (UDL) · types.
//
// Sketch · Photo · CAD · PDF · 3D Scan · Video · Voice · Text all converge
// into ONE representation: the DesignDocument (canonical shape defined by
// Design Reconstruction Engine).
//
// New input modalities extend UDL · never invent a new document format.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { EditableDesignDocument } from "../design-reconstruction";

export type UDLModality = "sketch" | "photo" | "cad" | "pdf" | "scan_3d" | "video" | "voice" | "text";

export type UDLInput =
  | { modality: "sketch"; sketch_id: string; source: string; user_intent?: string; requested_material?: string; requested_style?: string; detected_primitives?: readonly unknown[] }
  | { modality: "photo"; asset_id: string; known_object_types?: readonly string[]; known_materials?: readonly string[]; known_room_type?: string; known_style?: string; known_palette?: readonly string[]; known_lighting?: string }
  | { modality: "cad"; asset_id: string; file_format: "dwg" | "dxf" | "step" | "iges"; hint_object_types?: readonly string[] }
  | { modality: "pdf"; asset_id: string; page_count?: number; hint_kind?: "construction_detail" | "brochure" | "specification" | "proposal" }
  | { modality: "scan_3d"; asset_id: string; file_format: "ply" | "obj" | "usdz" | "gltf"; point_count?: number }
  | { modality: "video"; asset_id: string; duration_s?: number; hint_kind?: "walkthrough" | "installation" | "product_reveal" }
  | { modality: "voice"; utterance_id: string; transcript: string; language?: string }
  | { modality: "text"; utterance_id: string; text: string };

export type UDLResult = {
  input_modality: UDLModality;
  design_document: EditableDesignDocument;
  provenance: {
    converter_version: string;
    generated_at: string;
    confidence: number;
  };
};

export type UDLConverter = (input: UDLInput) => UDLResult;

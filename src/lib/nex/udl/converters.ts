// Universal Design Language · MVP converters (sketch · photo · text shipped ·
// CAD · PDF · 3D scan · video · voice stubbed for future phases).
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { UDLInput, UDLResult } from "./types";
import { reconstructFromVision, reconstructFromSketch } from "../design-reconstruction";
import { analyze } from "../vision-intelligence";
import { interpret } from "../sketch-intelligence";
import type { SketchPrimitive } from "../sketch-intelligence";

const VERSION = "e14_udl_mvp_1.0";

function stampResult(input: UDLInput, doc: import("../design-reconstruction").EditableDesignDocument): UDLResult {
  return {
    input_modality: input.modality,
    design_document: doc,
    provenance: { converter_version: VERSION, generated_at: new Date().toISOString(), confidence: doc.provenance.confidence_overall },
  };
}

export function fromSketch(input: Extract<UDLInput, { modality: "sketch" }>): UDLResult {
  const interpretation = interpret({
    sketch_id: input.sketch_id,
    source: input.source as "hand_paper",
    user_intent: input.user_intent,
    requested_material: input.requested_material,
    requested_style: input.requested_style,
    detected_primitives: input.detected_primitives as readonly SketchPrimitive[] | undefined,
  });
  return stampResult(input, reconstructFromSketch(interpretation));
}

export function fromPhoto(input: Extract<UDLInput, { modality: "photo" }>): UDLResult {
  const analysis = analyze({
    source_asset_id: input.asset_id,
    known_object_types: input.known_object_types,
    known_materials: input.known_materials,
    known_room_type: input.known_room_type as import("../vision-intelligence").VisionHint["known_room_type"],
    known_style: input.known_style,
    known_palette: input.known_palette,
    known_lighting: input.known_lighting,
  });
  return stampResult(input, reconstructFromVision(analysis));
}

export function fromText(input: Extract<UDLInput, { modality: "text" }>): UDLResult {
  // Simple text intent inference · used when no other modality is present. Real
  // NL understanding lands with the Editing Platform's vision-language phase.
  const text = input.text.toLowerCase();
  const objectTypes: string[] = [];
  if (text.includes("staircase") || text.includes("stair")) objectTypes.push("staircase");
  if (text.includes("kitchen")) objectTypes.push("kitchen");
  if (text.includes("island")) objectTypes.push("kitchen_island");
  if (text.includes("wardrobe")) objectTypes.push("wardrobe");
  if (text.includes("door")) objectTypes.push("door");
  const material = ["oak", "walnut", "pine", "mahogany", "steel", "brass", "glass"].find((m) => text.includes(m));
  const analysis = analyze({
    source_asset_id: input.utterance_id,
    known_object_types: objectTypes.length ? objectTypes : ["unspecified_object"],
    known_materials: material ? [material] : undefined,
  });
  return stampResult(input, reconstructFromVision(analysis));
}

function unsupported(kind: string): UDLResult {
  throw new Error(`UDL converter for ${kind} is a stub · shipped in a later phase (E.14.x)`);
}

export function fromCAD(input: Extract<UDLInput, { modality: "cad" }>): UDLResult { void input; return unsupported("cad"); }
export function fromPDF(input: Extract<UDLInput, { modality: "pdf" }>): UDLResult { void input; return unsupported("pdf"); }
export function fromScan3D(input: Extract<UDLInput, { modality: "scan_3d" }>): UDLResult { void input; return unsupported("scan_3d"); }
export function fromVideo(input: Extract<UDLInput, { modality: "video" }>): UDLResult { void input; return unsupported("video"); }
export function fromVoice(input: Extract<UDLInput, { modality: "voice" }>): UDLResult {
  // Voice reuses the text pipeline via the transcript · but reports "voice" modality.
  const textResult = fromText({ modality: "text", utterance_id: input.utterance_id, text: input.transcript });
  return { ...textResult, input_modality: "voice" };
}

export function convert(input: UDLInput): UDLResult {
  switch (input.modality) {
    case "sketch": return fromSketch(input);
    case "photo": return fromPhoto(input);
    case "text": return fromText(input);
    case "voice": return fromVoice(input);
    case "cad": return fromCAD(input);
    case "pdf": return fromPDF(input);
    case "scan_3d": return fromScan3D(input);
    case "video": return fromVideo(input);
  }
}

// Visual Knowledge Extraction Platform · extract() orchestrator.
//
// Runs the correct upstream analyser (Vision Intelligence · Sketch Intelligence ·
// Reality Reconstruction) · reconstructs an EditableDesignDocument ·
// writes a DesignMemoryEntry that stores KNOWLEDGE (not pixels) · returns the
// evidence-linked extraction record.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { VKEPRequest, VKEPExtraction } from "./types";
import { analyze } from "../vision-intelligence";
import { interpret } from "../sketch-intelligence";
import type { SketchPrimitive } from "../sketch-intelligence";
import { reconstructRoom } from "../reality-reconstruction";
import { reconstructFromVision, reconstructFromSketch } from "../design-reconstruction";
import { save as saveDesignMemory } from "../design-memory";
import type { DesignMemoryEntry } from "../design-memory";

const VERSION = "vkep_mvp_1.0";

function nowExtractionId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function extract(req: VKEPRequest): VKEPExtraction {
  const now = new Date().toISOString();

  if (req.kind === "photo") {
    const hints = (req.hints ?? {}) as { known_object_types?: readonly string[]; known_materials?: readonly string[]; known_room_type?: string; known_style?: string; known_palette?: readonly string[]; known_lighting?: string };
    const vision = analyze({
      source_asset_id: req.asset_id,
      known_object_types: hints.known_object_types,
      known_materials: hints.known_materials,
      known_room_type: hints.known_room_type as import("../vision-intelligence").VisionHint["known_room_type"],
      known_style: hints.known_style,
      known_palette: hints.known_palette,
      known_lighting: hints.known_lighting,
    });
    const doc = reconstructFromVision(vision);
    const memoryEntry: DesignMemoryEntry = {
      memory_id: nowExtractionId("mem"),
      project_id: req.project_id,
      captured_at: now,
      original_brief: `photo ingestion · asset=${req.asset_id}`,
      final_rendered_asset_id: req.asset_id,     // raw image kept ONLY as evidence
      design_document: doc,
      style_tags: [vision.mood.style_label, ...(vision.style_dna.timber ? [vision.style_dna.timber] : [])].filter(Boolean),
      design_decisions: [`vision.mood=${vision.mood.mood_label}`, `vision.style_label=${vision.mood.style_label}`, `warmth=${vision.mood.overall_warmth_score}`],
      provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    };
    saveDesignMemory(memoryEntry);
    return {
      extraction_id: nowExtractionId("vkep"),
      project_id: req.project_id,
      input_kind: "photo",
      design_document: doc,
      vision_analysis: vision,
      evidence_asset_ids: [req.asset_id],
      design_memory_entry_id: memoryEntry.memory_id,
      extractor_version: VERSION,
      generated_at: now,
    };
  }

  if (req.kind === "sketch") {
    const interpretation = interpret({
      sketch_id: req.sketch_id,
      source: req.source as "hand_paper",
      user_intent: req.user_intent,
      requested_material: req.requested_material,
      requested_style: req.requested_style,
      detected_primitives: req.detected_primitives as readonly SketchPrimitive[] | undefined,
    });
    const doc = reconstructFromSketch(interpretation);
    const memoryEntry: DesignMemoryEntry = {
      memory_id: nowExtractionId("mem"),
      project_id: req.project_id,
      captured_at: now,
      original_brief: `sketch ingestion · sketch=${req.sketch_id} · intent="${req.user_intent ?? ""}"`,
      final_rendered_asset_id: req.sketch_id,
      design_document: doc,
      style_tags: [interpretation.style.style, interpretation.object_match.object_kind].filter(Boolean),
      design_decisions: [`sketch.object_kind=${interpretation.object_match.object_kind}`, `sketch.similarity=${interpretation.object_match.similarity}`],
      provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    };
    saveDesignMemory(memoryEntry);
    return {
      extraction_id: nowExtractionId("vkep"),
      project_id: req.project_id,
      input_kind: "sketch",
      design_document: doc,
      sketch_interpretation: interpretation,
      evidence_asset_ids: [req.sketch_id],
      design_memory_entry_id: memoryEntry.memory_id,
      extractor_version: VERSION,
      generated_at: now,
    };
  }

  // room_photos
  const reconstruction = reconstructRoom(req.photos.map((p) => ({ photo_id: p.photo_id, url: p.url, hint_room_type: p.hint_room_type, known_reference: p.known_reference })), {
    reconstruction_id: req.reconstruction_id,
    room_type_hint: req.room_type_hint,
  });
  // Reconstruction produces its own knowledge · we wrap the summary as an editable document.
  const stub_analysis = analyze({
    source_asset_id: req.reconstruction_id,
    known_object_types: reconstruction.cabinets.map((c) => `cabinet_${c.kind ?? "generic"}`),
    known_room_type: reconstruction.room_type_guess as import("../vision-intelligence").VisionHint["known_room_type"],
  });
  const doc = reconstructFromVision(stub_analysis, { document_id: `doc_${req.reconstruction_id}` });
  const memoryEntry: DesignMemoryEntry = {
    memory_id: nowExtractionId("mem"),
    project_id: req.project_id,
    captured_at: now,
    original_brief: `room reconstruction · ${req.photos.length} photos · ${req.room_type_hint ?? "unspecified room"}`,
    design_document: { ...doc, source_kind: "reality_reconstruction" },
    style_tags: [reconstruction.room_type_guess],
    design_decisions: [`walls=${reconstruction.walls.length}`, `openings=${reconstruction.openings.length}`, `overall_confidence=${reconstruction.overall_confidence.percent}%`],
    measurements: reconstruction.walls.map((w) => ({ path: `/walls/${w.wall_id}/length_mm`, value: w.approx_length_mm, unit: "mm", confidence: w.length_confidence.level })),
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
  };
  saveDesignMemory(memoryEntry);
  return {
    extraction_id: nowExtractionId("vkep"),
    project_id: req.project_id,
    input_kind: "room_photos",
    design_document: { ...doc, source_kind: "reality_reconstruction" },
    room_reconstruction: reconstruction,
    evidence_asset_ids: req.photos.map((p) => p.photo_id),
    design_memory_entry_id: memoryEntry.memory_id,
    extractor_version: VERSION,
    generated_at: now,
  };
}

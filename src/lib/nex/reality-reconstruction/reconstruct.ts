// Reality Reconstruction Platform · reconstructRoom() MVP.
//
// Given N photos + calibration hints · returns a RoomReconstruction with every
// measurement carrying its confidence band. Vision-model integration replaces
// the internals · contract stays stable.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { PhotoInput, RoomReconstruction, ReconstructedWall, ReconstructedOpening, ReconstructedFloor, ReconstructedCeiling, ReconstructedCabinet, ReconstructedLightingFixture } from "./types";
import { withConfidence, combineConfidence, type Confidence } from "../spatial";

const VERSION = "e13_reality_reconstruction_mvp_1.0";

function calibrationConfidence(photo: PhotoInput): Confidence {
  if (photo.known_reference) return withConfidence("calibrated", `${photo.known_reference.object_kind} = ${photo.known_reference.real_length_mm}mm reference`);
  return withConfidence("estimated", "no in-image scale reference");
}

/** MVP builds a rectangular starter room from calibration + hints. Domain packs
 *  replace this with a real photogrammetry stage. */
export function reconstructRoom(photos: readonly PhotoInput[], opts: { reconstruction_id: string; room_type_hint?: string; expected_walls?: number }): RoomReconstruction {
  if (photos.length === 0) throw new Error("reconstructRoom requires at least one photo");

  const wallCount = opts.expected_walls ?? 4;
  const baselineConfidence = photos.reduce<Confidence>((acc, p) => combineConfidence(acc, calibrationConfidence(p)), withConfidence("verified"));

  // Estimated dimensions · derived from calibration only when a reference exists · otherwise a domestic default.
  const referenced = photos.find((p) => p.known_reference);
  const referenceWidthMm = referenced?.known_reference ? Math.round(referenced.known_reference.real_length_mm * 4) : 4200;

  const walls: ReconstructedWall[] = Array.from({ length: wallCount }, (_, i) => ({
    wall_id: `wall_${i + 1}`,
    approx_length_mm: i % 2 === 0 ? referenceWidthMm : Math.round(referenceWidthMm * 0.75),
    length_confidence: baselineConfidence,
    facing: (["N", "E", "S", "W"] as const)[i % 4],
    has_window: i === 0,
    has_door: i === 2,
  }));

  const openings: ReconstructedOpening[] = [];
  const withWindow = walls.find((w) => w.has_window);
  if (withWindow) openings.push({ opening_id: "op_window_1", kind: "window", wall_id: withWindow.wall_id, approx_width_mm: 1500, approx_height_mm: 1200, measurement_confidence: baselineConfidence });
  const withDoor = walls.find((w) => w.has_door);
  if (withDoor) openings.push({ opening_id: "op_door_1", kind: "door", wall_id: withDoor.wall_id, approx_width_mm: 762, approx_height_mm: 1981, measurement_confidence: baselineConfidence });

  const floor: ReconstructedFloor = {
    approx_area_m2: (walls[0].approx_length_mm * walls[1].approx_length_mm) / 1_000_000,
    area_confidence: baselineConfidence,
  };

  const ceiling: ReconstructedCeiling = {
    approx_height_mm: 2400,
    height_confidence: baselineConfidence,
  };

  const lighting: ReconstructedLightingFixture[] = (opts.room_type_hint ?? photos[0].hint_room_type) === "kitchen"
    ? [
        { fixture_id: "lf_pendant_1", kind: "pendant", approx_position_hint: "over island" },
        { fixture_id: "lf_downlight_ring", kind: "downlight", approx_position_hint: "perimeter" },
        { fixture_id: "lf_under_cab", kind: "under_cabinet", approx_position_hint: "under wall units" },
      ]
    : [{ fixture_id: "lf_pendant_1", kind: "pendant" }];

  const cabinets: ReconstructedCabinet[] = (opts.room_type_hint ?? photos[0].hint_room_type) === "kitchen"
    ? [
        { cabinet_id: "cab_base_1", approx_length_mm: 3000, approx_depth_mm: 600, approx_height_mm: 720, measurement_confidence: baselineConfidence, kind: "base" },
        { cabinet_id: "cab_wall_1", approx_length_mm: 3000, approx_depth_mm: 300, approx_height_mm: 720, measurement_confidence: baselineConfidence, kind: "wall" },
      ]
    : [];

  return {
    reconstruction_id: opts.reconstruction_id,
    room_type_guess: opts.room_type_hint ?? photos[0].hint_room_type ?? "other",
    photos_used: photos.map((p) => p.photo_id),
    walls,
    openings,
    floor,
    ceiling,
    lighting,
    cabinets,
    overall_confidence: baselineConfidence,
    reconstructor_version: VERSION,
    generated_at: new Date().toISOString(),
  };
}

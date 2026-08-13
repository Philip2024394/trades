// Reality Reconstruction Platform · types.
//
// User uploads N photos of a room · Nex reconstructs Room + Walls + Windows +
// Doors + Floor + Ceiling + Lighting + Cabinets + Measurements + Confidence.
// Then Nex can GENUINELY REDESIGN the space · not paint over a photograph.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { Confidence } from "../spatial";

export type PhotoInput = {
  photo_id: string;
  url?: string;
  camera_hint?: "wide" | "close_up" | "elevation" | "corner" | "unknown";
  known_reference?: {                    // one known real-world measurement for calibration
    object_kind: string;                 // "standard_uk_door" · "kitchen_worktop_depth" · etc.
    real_length_mm: number;
    pixel_length: number;
  };
  hint_room_type?: string;
  hint_objects?: readonly string[];
};

export type ReconstructedWall = {
  wall_id: string;
  approx_length_mm: number;
  length_confidence: Confidence;
  facing?: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  has_window?: boolean;
  has_door?: boolean;
};

export type ReconstructedOpening = {
  opening_id: string;
  kind: "window" | "door";
  wall_id: string;
  approx_width_mm: number;
  approx_height_mm: number;
  measurement_confidence: Confidence;
};

export type ReconstructedFloor = {
  approx_area_m2: number;
  area_confidence: Confidence;
  material_guess?: string;
};

export type ReconstructedCeiling = {
  approx_height_mm: number;
  height_confidence: Confidence;
  features?: readonly string[];
};

export type ReconstructedLightingFixture = {
  fixture_id: string;
  kind: "pendant" | "downlight" | "spotlight" | "wall_light" | "strip_led" | "chandelier" | "under_cabinet";
  approx_position_hint?: string;         // free-text · e.g. "over island"
};

export type ReconstructedCabinet = {
  cabinet_id: string;
  approx_length_mm: number;
  approx_depth_mm: number;
  approx_height_mm: number;
  measurement_confidence: Confidence;
  kind?: "base" | "wall" | "tall" | "island";
};

export type RoomReconstruction = {
  reconstruction_id: string;
  room_type_guess: string;
  photos_used: readonly string[];
  walls: readonly ReconstructedWall[];
  openings: readonly ReconstructedOpening[];
  floor: ReconstructedFloor;
  ceiling: ReconstructedCeiling;
  lighting: readonly ReconstructedLightingFixture[];
  cabinets: readonly ReconstructedCabinet[];
  overall_confidence: Confidence;
  reconstructor_version: string;
  generated_at: string;
};

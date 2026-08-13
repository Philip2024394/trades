// Geometry Platform · CameraObject + 10 camera profiles (Philip 2026-08-04).
//
// The renderer never guesses cameras · always resolves from this catalog.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import type { Vec3 } from "./geometry-object";

export type CameraProfileId =
  | "marketing" | "website" | "instagram" | "flyer"
  | "technical" | "construction" | "exploded" | "isometric"
  | "floorplan" | "section";

export type CameraObject = {
  id: CameraProfileId;
  display_name: string;
  projection: "perspective" | "orthographic";
  position: Vec3;                        // world space · authoritative units = mm
  target: Vec3;
  fov_deg?: number;                      // perspective only
  ortho_size_mm?: number;                // orthographic only
  aspect: number;                        // width / height
  aperture_f?: number;                   // depth-of-field
  focal_length_mm?: number;
  clip_near_mm?: number;
  clip_far_mm?: number;
};

const CAMERA_PROFILES: Record<CameraProfileId, CameraObject> = {
  marketing: { id: "marketing", display_name: "Marketing Hero (35mm classic)", projection: "perspective", position: [3500, 1600, 5000], target: [0, 1200, 0], fov_deg: 42, focal_length_mm: 35, aspect: 16 / 9, aperture_f: 4.0, clip_near_mm: 100, clip_far_mm: 50000 },
  website: { id: "website", display_name: "Website Landscape Hero", projection: "perspective", position: [4200, 1500, 6000], target: [0, 1200, 0], fov_deg: 38, focal_length_mm: 50, aspect: 2.4, clip_near_mm: 100, clip_far_mm: 50000 },
  instagram: { id: "instagram", display_name: "Instagram Square", projection: "perspective", position: [3200, 1600, 4200], target: [0, 1200, 0], fov_deg: 45, focal_length_mm: 35, aspect: 1, clip_near_mm: 100, clip_far_mm: 50000 },
  flyer: { id: "flyer", display_name: "Flyer Portrait", projection: "perspective", position: [3000, 1500, 4200], target: [0, 1200, 0], fov_deg: 40, focal_length_mm: 50, aspect: 0.707, clip_near_mm: 100, clip_far_mm: 50000 },
  technical: { id: "technical", display_name: "Technical 3-Quarter", projection: "perspective", position: [2800, 2200, 3500], target: [0, 800, 0], fov_deg: 30, focal_length_mm: 85, aspect: 4 / 3, clip_near_mm: 50, clip_far_mm: 30000 },
  construction: { id: "construction", display_name: "Construction Detail (long lens)", projection: "perspective", position: [1200, 800, 2200], target: [0, 400, 0], fov_deg: 20, focal_length_mm: 100, aspect: 4 / 3, clip_near_mm: 20, clip_far_mm: 8000 },
  exploded: { id: "exploded", display_name: "Exploded View Isometric", projection: "orthographic", position: [5000, 5000, 5000], target: [0, 0, 0], ortho_size_mm: 4000, aspect: 4 / 3, clip_near_mm: 10, clip_far_mm: 30000 },
  isometric: { id: "isometric", display_name: "Isometric 30° / 30°", projection: "orthographic", position: [4000, 4000, 4000], target: [0, 0, 0], ortho_size_mm: 4000, aspect: 4 / 3, clip_near_mm: 10, clip_far_mm: 30000 },
  floorplan: { id: "floorplan", display_name: "Floor Plan (top-down)", projection: "orthographic", position: [0, 10000, 0], target: [0, 0, 0], ortho_size_mm: 10000, aspect: 1, clip_near_mm: 10, clip_far_mm: 30000 },
  section: { id: "section", display_name: "Section (side elevation)", projection: "orthographic", position: [10000, 1500, 0], target: [0, 1500, 0], ortho_size_mm: 5000, aspect: 16 / 9, clip_near_mm: 10, clip_far_mm: 30000 },
};

export function resolveCamera(id: CameraProfileId): CameraObject { return CAMERA_PROFILES[id]; }
export function listCameraProfiles(): readonly CameraProfileId[] { return Object.keys(CAMERA_PROFILES) as CameraProfileId[]; }

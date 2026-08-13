// Scene Intelligence Platform · Room composition types.
//
// Complete rooms · not isolated objects. Every room composable · every element
// addressable · every relationship known.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export type RoomKind = "kitchen" | "hallway" | "landing" | "living_room" | "bedroom" | "bathroom" | "utility" | "study" | "dining" | "loft" | "cellar" | "garage" | "commercial" | "other";

export type Vec3 = [number, number, number];

export type WallKind = "structural" | "partition" | "party";

export type Wall = {
  id: string;
  kind: WallKind;
  start: Vec3;                           // mm world-space
  end: Vec3;
  height_mm: number;
  thickness_mm: number;
  material_ref?: string;                 // MaterialIntelligence id
  finish_ref?: string;
};

export type Floor = {
  id: string;
  polygon: readonly Vec3[];              // ordered vertices (CCW)
  build_up_layers_mm?: readonly { name: string; material_ref: string; thickness_mm: number }[];
  finish_ref?: string;                   // material id for visible finish
};

export type Ceiling = {
  id: string;
  height_mm: number;                     // FFL to FCL
  features?: readonly string[];         // e.g. ["coving", "spotlights_recess"]
  finish_ref?: string;
};

export type Window = {
  id: string;
  wall_id: string;
  position_mm: { x: number; y_from_ffl: number };
  width_mm: number;
  height_mm: number;
  glazing?: string;                      // e.g. "double_glazed_low_e"
};

export type Door = {
  id: string;
  wall_id: string;
  position_mm: { x: number; y_from_ffl: number };
  width_mm: number;
  height_mm: number;
  swing?: "inward_left" | "inward_right" | "outward_left" | "outward_right" | "sliding" | "pocket";
  frame_material_ref?: string;
  leaf_material_ref?: string;
};

export type LightingFixture = {
  id: string;
  position: Vec3;
  fixture_kind: "pendant" | "downlight" | "spotlight" | "wall_light" | "strip_led" | "chandelier" | "under_cabinet";
  lighting_profile_ref?: string;         // LightingProfileId
};

export type FurnitureItem = {
  id: string;
  geometry_ref: string;                  // GeometryObject id
  position: Vec3;
  rotation_deg?: Vec3;
};

export type ProductInstance = {
  id: string;
  geometry_ref: string;                  // GeometryObject id · e.g. staircase · kitchen island · wardrobe
  position: Vec3;
  rotation_deg?: Vec3;
  metadata?: Record<string, unknown>;
};

export type Room = {
  id: string;
  kind: RoomKind;
  name?: string;
  floor: Floor;
  ceiling: Ceiling;
  walls: readonly Wall[];
  windows?: readonly Window[];
  doors?: readonly Door[];
  lighting?: readonly LightingFixture[];
  furniture?: readonly FurnitureItem[];
  products?: readonly ProductInstance[];
  provenance: { named_expert: string; authored: string };
};

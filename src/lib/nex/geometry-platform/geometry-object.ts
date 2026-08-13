// Geometry Platform · GeometryObject (Philip 2026-08-04).
//
// Every product in Nex has a Geometry Object that renderers (2D · 3D · print ·
// AR · VR · BIM) all consume. The object exists ONCE · never duplicated per
// output format.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import type { LengthUnit } from "../spatial/units";

export type Vec3 = [number, number, number];

export type BoundingBox = {
  min: Vec3;                             // world-space
  max: Vec3;
};

export type LODLevel = "high" | "medium" | "low" | "impostor";

export type ConnectorKind = "handrail_to_newel" | "tread_to_string" | "cabinet_to_wall" | "cabinet_to_cabinet" | "door_to_frame" | "worktop_to_carcass" | "custom";

export type GeometryConnector = {
  id: string;
  kind: ConnectorKind;
  attach_point: Vec3;                    // local space
  accepts: readonly string[];            // ids of geometry object kinds that may attach
};

export type CollisionShape =
  | { kind: "aabb"; box: BoundingBox }
  | { kind: "sphere"; center: Vec3; radius: number }
  | { kind: "convex_hull"; points: readonly Vec3[] }
  | { kind: "none" };

export type AnimationPoint = {
  id: string;
  kind: "hinge" | "slide" | "unfold" | "led_transition" | "camera_target";
  origin: Vec3;
  axis?: Vec3;
  range_deg?: [number, number];
  range_mm?: [number, number];
};

export type GeometryObject = {
  id: string;
  kind: string;                          // e.g. "staircase.tread" · "kitchen.cabinet_door"
  units: LengthUnit;                     // authoritative units for this object · never mixed
  bounding_box: BoundingBox;
  origin: Vec3;
  rotation_deg: Vec3;                    // roll · pitch · yaw
  scale: Vec3;
  material_ref?: string;                 // MaterialObject id
  texture_refs?: readonly string[];
  connectors?: readonly GeometryConnector[];
  collision: CollisionShape;
  animation_points?: readonly AnimationPoint[];
  lod: LODLevel;
  child_ids?: readonly string[];         // composition tree · e.g. staircase→[tread, riser, string, ...]
  metadata?: Record<string, unknown>;
};

export function boundingBoxSize(bb: BoundingBox): Vec3 {
  return [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
}

export function boundingBoxVolume(bb: BoundingBox): number {
  const [w, h, d] = boundingBoxSize(bb);
  return Math.max(0, w) * Math.max(0, h) * Math.max(0, d);
}

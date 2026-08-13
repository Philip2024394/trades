// Geometry Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export { boundingBoxSize, boundingBoxVolume } from "./geometry-object";
export type {
  GeometryObject, GeometryConnector, ConnectorKind, CollisionShape, AnimationPoint,
  BoundingBox, LODLevel, Vec3,
} from "./geometry-object";

export type { MaterialObject, MaterialKind } from "./material-object";

export { resolveCamera, listCameraProfiles } from "./camera-object";
export type { CameraObject, CameraProfileId } from "./camera-object";

export { resolveLighting, listLightingProfiles } from "./lighting-object";
export type { LightingObject, LightingProfileId } from "./lighting-object";

export { resolveRenderTarget, listRenderTargets, shippedRenderTargets } from "./render-targets";
export type { RenderTarget, RenderTargetId, RenderTargetKind } from "./render-targets";

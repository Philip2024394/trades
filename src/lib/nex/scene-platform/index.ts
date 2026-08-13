// Scene Intelligence Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export { floorAreaMm2, floorAreaM2, roomVolumeM3, wallLengthMm, totalWallLengthMm, rectangularRoom } from "./room-composition";
export type {
  Room, RoomKind, Wall, WallKind, Floor, Ceiling, Window, Door,
  LightingFixture, FurnitureItem, ProductInstance, Vec3,
} from "./types";

// Scene Intelligence · Room composition helpers.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import type { Room, Wall, Floor, Ceiling, Vec3 } from "./types";

/** Polygon area (mm²) via the shoelace formula · assumes floor polygon is planar and CCW. */
export function floorAreaMm2(floor: Floor): number {
  const p = floor.polygon;
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, , z1] = p[i];
    const [x2, , z2] = p[(i + 1) % p.length];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

export function floorAreaM2(floor: Floor): number {
  return floorAreaMm2(floor) / 1_000_000;
}

/** Room internal volume (mm³) · floor area × ceiling height. */
export function roomVolumeM3(room: Room): number {
  return (floorAreaMm2(room.floor) * room.ceiling.height_mm) / 1_000_000_000;
}

/** Wall length (mm) via straight-line distance start→end. */
export function wallLengthMm(wall: Wall): number {
  const [x1, y1, z1] = wall.start;
  const [x2, y2, z2] = wall.end;
  return Math.hypot(x2 - x1, y2 - y1, z2 - z1);
}

/** Total wall length in a room (mm). */
export function totalWallLengthMm(room: Room): number {
  return room.walls.reduce((s, w) => s + wallLengthMm(w), 0);
}

/** Compose a simple rectangular room from width/depth/height (all mm). */
export function rectangularRoom(params: {
  id: string; kind: Room["kind"];
  width_mm: number; depth_mm: number; ceiling_height_mm: number;
  wall_thickness_mm?: number;
  named_expert: string;
}): Room {
  const t = params.wall_thickness_mm ?? 100;
  const w = params.width_mm;
  const d = params.depth_mm;
  const p1: Vec3 = [0, 0, 0];
  const p2: Vec3 = [w, 0, 0];
  const p3: Vec3 = [w, 0, d];
  const p4: Vec3 = [0, 0, d];
  const floor: Floor = { id: `${params.id}.floor`, polygon: [p1, p2, p3, p4] };
  const ceiling: Ceiling = { id: `${params.id}.ceiling`, height_mm: params.ceiling_height_mm };
  const walls: Wall[] = [
    { id: `${params.id}.wall.n`, kind: "partition", start: p1, end: p2, height_mm: params.ceiling_height_mm, thickness_mm: t },
    { id: `${params.id}.wall.e`, kind: "partition", start: p2, end: p3, height_mm: params.ceiling_height_mm, thickness_mm: t },
    { id: `${params.id}.wall.s`, kind: "partition", start: p3, end: p4, height_mm: params.ceiling_height_mm, thickness_mm: t },
    { id: `${params.id}.wall.w`, kind: "partition", start: p4, end: p1, height_mm: params.ceiling_height_mm, thickness_mm: t },
  ];
  return { id: params.id, kind: params.kind, floor, ceiling, walls, provenance: { named_expert: params.named_expert, authored: new Date().toISOString().slice(0, 10) } };
}

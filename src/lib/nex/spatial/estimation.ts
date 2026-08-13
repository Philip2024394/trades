// Spatial Intelligence · derived construction estimations.
//
// Concrete · water · timber · paint · tiles. Every estimation returns a
// Measurement with propagated confidence.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { convertVolume, convertArea, convertWeight, convertLength, type LengthUnit } from "./units";
import { combineConfidence, withConfidence, type Confidence } from "./confidence";
import type { Measurement } from "./measurement";
import { measurement } from "./measurement";
import { boxVolume, rectangleArea } from "./geometry";

// ─── Material densities · kg per m³ ──────────────────────────────────────
// Authored constants · Rule c: sourced from standard construction references.

export const MATERIAL_DENSITY_KG_PER_M3: Record<string, number> = {
  concrete: 2400,
  water: 1000,
  oak: 720,
  pine: 500,
  walnut: 640,
  mahogany: 700,
  ash: 700,
  beech: 720,
  quartz: 2650,
  granite: 2700,
  marble: 2700,
  steel: 7850,
  aluminium: 2700,
  glass: 2500,
};

// ─── Concrete ────────────────────────────────────────────────────────────

/** Concrete volume + estimated tonnes from a box slab (length × width × depth). */
export function concreteFromSlab(length: Measurement, width: Measurement, depth: Measurement): { volume: Measurement; weight_kg: Measurement } {
  const vol = boxVolume(length, width, depth, "m3");
  const kg = vol.value * MATERIAL_DENSITY_KG_PER_M3.concrete;
  return {
    volume: vol,
    weight_kg: measurement(kg, "kg", "weight", vol.confidence, "derived: concreteFromSlab"),
  };
}

// ─── Water tank ──────────────────────────────────────────────────────────

/** Litres + weight-when-full from a rectangular tank. */
export function waterTank(length: Measurement, width: Measurement, depth: Measurement): { litres: Measurement; weight_full_kg: Measurement } {
  const vol_m3 = boxVolume(length, width, depth, "m3");
  const litres = convertVolume(vol_m3.value, "m3", "l");
  return {
    litres: measurement(litres, "l", "liquid", vol_m3.confidence, "derived: waterTank"),
    weight_full_kg: measurement(litres * (MATERIAL_DENSITY_KG_PER_M3.water / 1000), "kg", "weight", vol_m3.confidence, "derived: waterTankWeight"),
  };
}

// ─── Timber weight ───────────────────────────────────────────────────────

export function timberWeight(volume: Measurement, species: keyof typeof MATERIAL_DENSITY_KG_PER_M3): Measurement {
  const vol_m3 = convertVolume(volume.value, volume.unit as any, "m3");
  const density = MATERIAL_DENSITY_KG_PER_M3[species];
  if (density === undefined) throw new Error(`Unknown timber species: ${species}`);
  return measurement(vol_m3 * density, "kg", "weight", volume.confidence, `derived: timberWeight (${species})`);
}

// ─── Paint coverage ──────────────────────────────────────────────────────

/** Litres of paint required · wallArea − openings ÷ coverage m²/L × coats. */
export function paintRequired(params: {
  wall_area: Measurement;
  openings_area?: Measurement;
  coverage_m2_per_l?: number;
  coats?: number;
}): Measurement {
  const coverage = params.coverage_m2_per_l ?? 12;
  const coats = params.coats ?? 2;
  const wall_m2 = convertArea(params.wall_area.value, params.wall_area.unit as any, "m2");
  const openings_m2 = params.openings_area ? convertArea(params.openings_area.value, params.openings_area.unit as any, "m2") : 0;
  const paintable = Math.max(0, wall_m2 - openings_m2);
  const litres = (paintable / coverage) * coats;
  const conf: Confidence = params.openings_area ? combineConfidence(params.wall_area.confidence, params.openings_area.confidence) : params.wall_area.confidence;
  return measurement(litres, "l", "liquid", conf, `derived: paintRequired (coverage=${coverage} m²/L × ${coats} coats)`);
}

// ─── Tiles required ──────────────────────────────────────────────────────

export function tilesRequired(params: {
  floor_area: Measurement;
  tile_width_mm: number;
  tile_height_mm: number;
  cut_allowance_pct?: number;
  tiles_per_box?: number;
}): { tiles: number; boxes: number; confidence: Confidence } {
  const allowance = params.cut_allowance_pct ?? 10;
  const per_box = params.tiles_per_box ?? 12;
  const floor_mm2 = convertArea(params.floor_area.value, params.floor_area.unit as any, "mm2");
  const tile_mm2 = params.tile_width_mm * params.tile_height_mm;
  const raw_tiles = floor_mm2 / tile_mm2;
  const with_allowance = raw_tiles * (1 + allowance / 100);
  const tiles = Math.ceil(with_allowance);
  const boxes = Math.ceil(tiles / per_box);
  return { tiles, boxes, confidence: params.floor_area.confidence };
}

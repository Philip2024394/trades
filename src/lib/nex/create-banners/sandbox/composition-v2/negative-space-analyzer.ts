// src/lib/nex/create-banners/sandbox/composition-v2/negative-space-analyzer.ts
//
// NEX Composition Engineering Wave · deterministic negative-space analysis
// ========================================================================
// Uses Sharp (already an approved local dependency) to build a grid-based
// busy/empty map for the raw generated image. Zero AI. No external calls.

import sharp from "sharp";
import type { NegativeSpaceCell, NegativeSpaceMap } from "./types";

export interface NegativeSpaceOptions {
  readonly grid_cols: number; // default 32
  readonly grid_rows: number; // default 32
  /** Busy-score threshold above which a cell is NOT text-safe. */
  readonly busy_threshold: number; // default 0.15
}

export const DEFAULT_NEG_SPACE_OPTIONS: NegativeSpaceOptions = {
  grid_cols: 32,
  grid_rows: 32,
  busy_threshold: 0.18,
};

/**
 * Analyse the source image into a busy/empty/luminance grid map.
 * Deterministic. No AI. No external service. Sharp is the only dependency.
 */
export async function analyseNegativeSpace(
  raw_generated_asset_absolute_path: string,
  opts: NegativeSpaceOptions = DEFAULT_NEG_SPACE_OPTIONS
): Promise<NegativeSpaceMap> {
  const image = sharp(raw_generated_asset_absolute_path);
  const metadata = await image.metadata();
  const src_w = metadata.width ?? 1024;
  const src_h = metadata.height ?? 1024;

  const analysis_w = 256;
  const analysis_h = Math.round((analysis_w / src_w) * src_h);

  const grayscale = await image
    .clone()
    .resize(analysis_w, analysis_h, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = grayscale.data;
  const gw = grayscale.info.width;
  const gh = grayscale.info.height;

  const cell_gw = gw / opts.grid_cols;
  const cell_gh = gh / opts.grid_rows;

  const cells: NegativeSpaceCell[] = [];
  let global_busy_sum = 0;
  let global_busy_max = 0.001;

  for (let gy = 0; gy < opts.grid_rows; gy++) {
    for (let gx = 0; gx < opts.grid_cols; gx++) {
      const x0 = Math.round(gx * cell_gw);
      const x1 = Math.round((gx + 1) * cell_gw);
      const y0 = Math.round(gy * cell_gh);
      const y1 = Math.round((gy + 1) * cell_gh);

      let sum = 0;
      let sum_sq = 0;
      let count = 0;
      let edge_energy = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * gw + x;
          const v = gray[i] ?? 0;
          sum += v;
          sum_sq += v * v;
          count += 1;
          if (x + 1 < x1) {
            const next_h = gray[i + 1] ?? v;
            edge_energy += Math.abs(v - next_h);
          }
          if (y + 1 < y1) {
            const next_v = gray[i + gw] ?? v;
            edge_energy += Math.abs(v - next_v);
          }
        }
      }
      const mean = count > 0 ? sum / count : 0;
      const variance =
        count > 0 ? Math.max(0, sum_sq / count - mean * mean) : 0;
      const std = Math.sqrt(variance);
      const raw_busy = (std / 128) * 0.6 + (edge_energy / (count * 255)) * 0.4;
      global_busy_sum += raw_busy;
      if (raw_busy > global_busy_max) global_busy_max = raw_busy;

      const cell_x = Math.round((gx / opts.grid_cols) * src_w);
      const cell_y = Math.round((gy / opts.grid_rows) * src_h);
      const cell_w = Math.round(src_w / opts.grid_cols);
      const cell_h = Math.round(src_h / opts.grid_rows);
      const luminance = mean / 255;
      const tendency: NegativeSpaceCell["tendency"] =
        luminance < 0.33 ? "dark" : luminance > 0.66 ? "light" : "mid";

      cells.push({
        gx,
        gy,
        x: cell_x,
        y: cell_y,
        w: cell_w,
        h: cell_h,
        busy_score: raw_busy,
        luminance,
        is_text_safe: raw_busy <= opts.busy_threshold,
        tendency,
      });
    }
  }

  // Normalise busy scores to 0..1 and re-flag is_text_safe
  const normalised: NegativeSpaceCell[] = cells.map((c) => {
    const ns = Math.min(1, c.busy_score / (global_busy_max || 1));
    return {
      ...c,
      busy_score: ns,
      is_text_safe: ns <= opts.busy_threshold,
    };
  });

  // Primary subject bbox: bounding box of the busiest 20% of cells
  const busy_cells = [...normalised].sort(
    (a, b) => b.busy_score - a.busy_score
  );
  const top_slice = busy_cells.slice(
    0,
    Math.max(1, Math.round(busy_cells.length * 0.2))
  );
  let sx0 = Infinity,
    sy0 = Infinity,
    sx1 = -Infinity,
    sy1 = -Infinity;
  for (const c of top_slice) {
    if (c.x < sx0) sx0 = c.x;
    if (c.y < sy0) sy0 = c.y;
    if (c.x + c.w > sx1) sx1 = c.x + c.w;
    if (c.y + c.h > sy1) sy1 = c.y + c.h;
  }
  const primary_subject_bbox =
    sx0 !== Infinity
      ? {
          x: sx0,
          y: sy0,
          w: Math.max(1, sx1 - sx0),
          h: Math.max(1, sy1 - sy0),
        }
      : null;

  return {
    grid_cols: opts.grid_cols,
    grid_rows: opts.grid_rows,
    cell_w: Math.round(src_w / opts.grid_cols),
    cell_h: Math.round(src_h / opts.grid_rows),
    cells: normalised,
    source_width: src_w,
    source_height: src_h,
    primary_subject_bbox,
  };
}

/**
 * Given a NegativeSpaceMap and a candidate rectangular Region (in absolute
 * source-image pixels), return the aggregate "busy" score for the region
 * (0..1). Lower = better for text placement.
 */
export function regionBusyScore(
  map: NegativeSpaceMap,
  region: { x: number; y: number; w: number; h: number }
): number {
  let sum = 0;
  let count = 0;
  for (const cell of map.cells) {
    const cx1 = cell.x + cell.w;
    const cy1 = cell.y + cell.h;
    const overlap_w = Math.max(
      0,
      Math.min(cx1, region.x + region.w) - Math.max(cell.x, region.x)
    );
    const overlap_h = Math.max(
      0,
      Math.min(cy1, region.y + region.h) - Math.max(cell.y, region.y)
    );
    const overlap_area = overlap_w * overlap_h;
    if (overlap_area > 0) {
      sum += cell.busy_score * overlap_area;
      count += overlap_area;
    }
  }
  return count > 0 ? sum / count : 1;
}

/**
 * Mean luminance in a region (0..1). Used to pick text colour.
 */
export function regionLuminance(
  map: NegativeSpaceMap,
  region: { x: number; y: number; w: number; h: number }
): number {
  let sum = 0;
  let count = 0;
  for (const cell of map.cells) {
    const cx1 = cell.x + cell.w;
    const cy1 = cell.y + cell.h;
    const overlap_w = Math.max(
      0,
      Math.min(cx1, region.x + region.w) - Math.max(cell.x, region.x)
    );
    const overlap_h = Math.max(
      0,
      Math.min(cy1, region.y + region.h) - Math.max(cell.y, region.y)
    );
    const overlap_area = overlap_w * overlap_h;
    if (overlap_area > 0) {
      sum += cell.luminance * overlap_area;
      count += overlap_area;
    }
  }
  return count > 0 ? sum / count : 0.5;
}

export function globalBusyFraction(map: NegativeSpaceMap): number {
  const total = map.cells.length || 1;
  const busy = map.cells.filter((c) => !c.is_text_safe).length;
  return busy / total;
}

// src/lib/nex/create-banners/sandbox/composition-v2/crop-engine.ts
//
// NEX Composition Engineering Wave · smart crop
// =============================================
// Given a source image + target-format aspect ratio, pick the crop
// window that keeps the primary subject inside the frame · never
// blindly resize + squash. Deterministic. Uses the negative-space
// map's primary_subject_bbox.

import type { NegativeSpaceMap } from "./types";

export interface CropWindow {
  readonly source_x: number;
  readonly source_y: number;
  readonly source_w: number;
  readonly source_h: number;
}

export function planCrop(input: {
  readonly negative_space: NegativeSpaceMap;
  readonly target_width: number;
  readonly target_height: number;
}): CropWindow {
  const {
    negative_space: ns,
    target_width: tw,
    target_height: th,
  } = input;
  const source_w = ns.source_width;
  const source_h = ns.source_height;
  const source_aspect = source_w / source_h;
  const target_aspect = tw / th;

  // Compute the largest crop window that matches target aspect
  let crop_w: number;
  let crop_h: number;
  if (target_aspect > source_aspect) {
    // Target is wider · use full width, shorter height
    crop_w = source_w;
    crop_h = Math.round(source_w / target_aspect);
  } else {
    // Target is taller · use full height, narrower width
    crop_h = source_h;
    crop_w = Math.round(source_h * target_aspect);
  }

  // Position the crop window so the primary subject bbox stays centred
  // within it. Fall back to centre if no subject bbox is available.
  const subject = ns.primary_subject_bbox ?? {
    x: source_w / 2 - source_w * 0.15,
    y: source_h / 2 - source_h * 0.15,
    w: source_w * 0.3,
    h: source_h * 0.3,
  };
  const subject_cx = subject.x + subject.w / 2;
  const subject_cy = subject.y + subject.h / 2;

  let sx = Math.round(subject_cx - crop_w / 2);
  let sy = Math.round(subject_cy - crop_h / 2);
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + crop_w > source_w) sx = source_w - crop_w;
  if (sy + crop_h > source_h) sy = source_h - crop_h;
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;

  return {
    source_x: sx,
    source_y: sy,
    source_w: Math.min(crop_w, source_w),
    source_h: Math.min(crop_h, source_h),
  };
}

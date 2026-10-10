// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: FacialStateValidator
// Deterministic byte-stable output. Do not edit by hand.
//
// C1 · deterministic facial-state validator.
// Authored by NEX1 via typed_data_contract primitive.
// Uses Route 2b runtime_imports for range constants + Viseme literal_union · Route 2c runtime_import literals for cross-file refusal-union.

import type { FacialState } from "./facial-state";
import { HEAD_TRANSFORM_PITCH_BOUNDS } from "./ranges";
import { HEAD_TRANSFORM_YAW_BOUNDS } from "./ranges";
import { HEAD_TRANSFORM_ROLL_BOUNDS } from "./ranges";
import { EYE_APERTURE_BOUNDS } from "./ranges";
import { EYEBROW_HEIGHT_BOUNDS } from "./ranges";
import { MOUTH_OPENNESS_BOUNDS } from "./ranges";
import { JAW_ROTATION_BOUNDS } from "./ranges";
import { BLINK_PROGRESS_BOUNDS } from "./ranges";
import { GAZE_CONE_BOUNDS } from "./ranges";
import { Viseme, Viseme_MEMBERS } from "./facial-state";
import { FacialStateRefusalReason, FacialStateRefusalReason_MEMBERS } from "./refusal";

export function validate_facial_state(input: FacialState): { readonly ok: true } | { readonly ok: false; readonly reason: FacialStateRefusalReason } {
  if ((input as unknown as Record<string, unknown>)["head_transform"] === undefined || (input as unknown as Record<string, unknown>)["head_transform"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["left_eye"] === undefined || (input as unknown as Record<string, unknown>)["left_eye"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["right_eye"] === undefined || (input as unknown as Record<string, unknown>)["right_eye"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["left_eyebrow"] === undefined || (input as unknown as Record<string, unknown>)["left_eyebrow"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["right_eyebrow"] === undefined || (input as unknown as Record<string, unknown>)["right_eyebrow"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["mouth"] === undefined || (input as unknown as Record<string, unknown>)["mouth"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["jaw"] === undefined || (input as unknown as Record<string, unknown>)["jaw"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["blink"] === undefined || (input as unknown as Record<string, unknown>)["blink"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if ((input as unknown as Record<string, unknown>)["temporal"] === undefined || (input as unknown as Record<string, unknown>)["temporal"] === null) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["head_transform"]) as Record<string, unknown>)["pitch"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < HEAD_TRANSFORM_PITCH_BOUNDS.min || v > HEAD_TRANSFORM_PITCH_BOUNDS.max) {
      return { ok: false, reason: "HEAD_TRANSFORM_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["head_transform"]) as Record<string, unknown>)["yaw"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < HEAD_TRANSFORM_YAW_BOUNDS.min || v > HEAD_TRANSFORM_YAW_BOUNDS.max) {
      return { ok: false, reason: "HEAD_TRANSFORM_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["head_transform"]) as Record<string, unknown>)["roll"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < HEAD_TRANSFORM_ROLL_BOUNDS.min || v > HEAD_TRANSFORM_ROLL_BOUNDS.max) {
      return { ok: false, reason: "HEAD_TRANSFORM_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["left_eye"]) as Record<string, unknown>)["aperture"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < EYE_APERTURE_BOUNDS.min || v > EYE_APERTURE_BOUNDS.max) {
      return { ok: false, reason: "EYE_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["right_eye"]) as Record<string, unknown>)["aperture"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < EYE_APERTURE_BOUNDS.min || v > EYE_APERTURE_BOUNDS.max) {
      return { ok: false, reason: "EYE_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((((input as unknown as Record<string, unknown>)["left_eye"]) as Record<string, unknown>)["gaze"]) as Record<string, unknown>)["x"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < GAZE_CONE_BOUNDS.min || v > GAZE_CONE_BOUNDS.max) {
      return { ok: false, reason: "GAZE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((((input as unknown as Record<string, unknown>)["left_eye"]) as Record<string, unknown>)["gaze"]) as Record<string, unknown>)["y"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < GAZE_CONE_BOUNDS.min || v > GAZE_CONE_BOUNDS.max) {
      return { ok: false, reason: "GAZE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((((input as unknown as Record<string, unknown>)["left_eye"]) as Record<string, unknown>)["gaze"]) as Record<string, unknown>)["z"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < GAZE_CONE_BOUNDS.min || v > GAZE_CONE_BOUNDS.max) {
      return { ok: false, reason: "GAZE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((((input as unknown as Record<string, unknown>)["right_eye"]) as Record<string, unknown>)["gaze"]) as Record<string, unknown>)["x"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < GAZE_CONE_BOUNDS.min || v > GAZE_CONE_BOUNDS.max) {
      return { ok: false, reason: "GAZE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((((input as unknown as Record<string, unknown>)["right_eye"]) as Record<string, unknown>)["gaze"]) as Record<string, unknown>)["y"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < GAZE_CONE_BOUNDS.min || v > GAZE_CONE_BOUNDS.max) {
      return { ok: false, reason: "GAZE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((((input as unknown as Record<string, unknown>)["right_eye"]) as Record<string, unknown>)["gaze"]) as Record<string, unknown>)["z"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < GAZE_CONE_BOUNDS.min || v > GAZE_CONE_BOUNDS.max) {
      return { ok: false, reason: "GAZE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["left_eyebrow"]) as Record<string, unknown>)["height"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < EYEBROW_HEIGHT_BOUNDS.min || v > EYEBROW_HEIGHT_BOUNDS.max) {
      return { ok: false, reason: "EYEBROW_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["right_eyebrow"]) as Record<string, unknown>)["height"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < EYEBROW_HEIGHT_BOUNDS.min || v > EYEBROW_HEIGHT_BOUNDS.max) {
      return { ok: false, reason: "EYEBROW_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["mouth"]) as Record<string, unknown>)["openness"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < MOUTH_OPENNESS_BOUNDS.min || v > MOUTH_OPENNESS_BOUNDS.max) {
      return { ok: false, reason: "MOUTH_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["jaw"]) as Record<string, unknown>)["rotation"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < JAW_ROTATION_BOUNDS.min || v > JAW_ROTATION_BOUNDS.max) {
      return { ok: false, reason: "JAW_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["blink"]) as Record<string, unknown>)["progress"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < BLINK_PROGRESS_BOUNDS.min || v > BLINK_PROGRESS_BOUNDS.max) {
      return { ok: false, reason: "BLINK_STATE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (((input as unknown as Record<string, unknown>)["mouth"]) as Record<string, unknown>)["viseme"];
    const allowed: readonly string[] = Viseme_MEMBERS;
    if (typeof v !== "string" || !allowed.includes(v)) {
      return { ok: false, reason: "UNKNOWN_VISEME" };
    }
  }
  return { ok: true };
}

// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: FacialStateSerialiser
// Deterministic byte-stable output. Do not edit by hand.
//
// C1 · byte-stable JSON serialiser for FacialState.
// Authored by NEX1 via typed_data_contract primitive.
// Property order locked at spec time · deterministic output.

import type { FacialState } from "./facial-state";

export function serialise_facial_state(input: FacialState): string {
  const src = input as unknown as Record<string, unknown>;
  const parts: string[] = [];
  if (Object.prototype.hasOwnProperty.call(src, "head_transform")) {
    parts.push(JSON.stringify("head_transform") + ":" + JSON.stringify(src["head_transform"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "left_eye")) {
    parts.push(JSON.stringify("left_eye") + ":" + JSON.stringify(src["left_eye"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "right_eye")) {
    parts.push(JSON.stringify("right_eye") + ":" + JSON.stringify(src["right_eye"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "left_eyebrow")) {
    parts.push(JSON.stringify("left_eyebrow") + ":" + JSON.stringify(src["left_eyebrow"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "right_eyebrow")) {
    parts.push(JSON.stringify("right_eyebrow") + ":" + JSON.stringify(src["right_eyebrow"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "mouth")) {
    parts.push(JSON.stringify("mouth") + ":" + JSON.stringify(src["mouth"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "jaw")) {
    parts.push(JSON.stringify("jaw") + ":" + JSON.stringify(src["jaw"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "blink")) {
    parts.push(JSON.stringify("blink") + ":" + JSON.stringify(src["blink"]));
  }
  if (Object.prototype.hasOwnProperty.call(src, "temporal")) {
    parts.push(JSON.stringify("temporal") + ":" + JSON.stringify(src["temporal"]));
  }
  return "{" + parts.join(",") + "}";
}

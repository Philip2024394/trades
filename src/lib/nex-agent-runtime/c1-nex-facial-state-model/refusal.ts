// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: FacialStateRefusal
// Deterministic byte-stable output. Do not edit by hand.
//
// C1 · refusal reason vocabulary for facial-state validation.
// Authored by NEX1 via typed_data_contract primitive.
// Exactly the 11 reasons locked by Build Gate v1.2 · validator.ts references this union via Route 2c runtime_import.

export type FacialStateRefusalReason =
  | "HEAD_TRANSFORM_OUT_OF_RANGE"
  | "EYE_STATE_OUT_OF_RANGE"
  | "EYEBROW_STATE_OUT_OF_RANGE"
  | "MOUTH_STATE_OUT_OF_RANGE"
  | "JAW_STATE_OUT_OF_RANGE"
  | "BLINK_STATE_OUT_OF_RANGE"
  | "GAZE_OUT_OF_RANGE"
  | "UNKNOWN_VISEME"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_TEMPORAL_METADATA"
  | "SERIALISATION_NON_DETERMINISTIC";

export const FacialStateRefusalReason_MEMBERS: readonly FacialStateRefusalReason[] = Object.freeze(["HEAD_TRANSFORM_OUT_OF_RANGE", "EYE_STATE_OUT_OF_RANGE", "EYEBROW_STATE_OUT_OF_RANGE", "MOUTH_STATE_OUT_OF_RANGE", "JAW_STATE_OUT_OF_RANGE", "BLINK_STATE_OUT_OF_RANGE", "GAZE_OUT_OF_RANGE", "UNKNOWN_VISEME", "MISSING_REQUIRED_FIELD", "INVALID_TEMPORAL_METADATA", "SERIALISATION_NON_DETERMINISTIC"]);

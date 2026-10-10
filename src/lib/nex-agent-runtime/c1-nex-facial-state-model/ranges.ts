// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: FacialStateBounds
// Deterministic byte-stable output. Do not edit by hand.
//
// C1 · numeric range constants for facial-state validation.
// Authored by NEX1 via typed_data_contract primitive.
// Ranges locked by Build Gate v1.2 · not modified per capability instance.

export const HEAD_TRANSFORM_PITCH_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: -1.5708, max: 1.5708 });

export const HEAD_TRANSFORM_YAW_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: -1.5708, max: 1.5708 });

export const HEAD_TRANSFORM_ROLL_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: -0.7854, max: 0.7854 });

export const EYE_APERTURE_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 1 });

export const EYEBROW_HEIGHT_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: -1, max: 1 });

export const MOUTH_OPENNESS_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 1 });

export const JAW_ROTATION_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 0.7854 });

export const BLINK_PROGRESS_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 1 });

export const GAZE_CONE_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: -1, max: 1 });

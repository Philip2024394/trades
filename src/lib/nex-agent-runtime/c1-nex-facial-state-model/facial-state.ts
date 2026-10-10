// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: FacialState
// Deterministic byte-stable output. Do not edit by hand.
//
// C1 · deterministic facial-state data contract.
// Authored by NEX1 via typed_data_contract primitive.
// Blind to visual assets · NEX-owned viseme vocabulary · Build Gate v1.2 shape.

export type Viseme =
  | "neutral"
  | "closed"
  | "open"
  | "wide"
  | "narrow"
  | "rounded"
  | "teeth"
  | "bilabial"
  | "labiodental"
  | "alveolar"
  | "fricative";

export const Viseme_MEMBERS: readonly Viseme[] = Object.freeze(["neutral", "closed", "open", "wide", "narrow", "rounded", "teeth", "bilabial", "labiodental", "alveolar", "fricative"]);

export interface Gaze {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HeadTransform {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
}

export interface EyeState {
  readonly aperture: number;
  readonly gaze: Gaze;
}

export interface EyebrowState {
  readonly height: number;
}

export interface MouthState {
  readonly openness: number;
  readonly viseme: Viseme;
}

export interface JawState {
  readonly rotation: number;
}

export interface BlinkState {
  readonly progress: number;
}

export interface TemporalMetadata {
  readonly timestamp_ms: number;
  readonly sequence_index: number;
}

export interface FacialState {
  readonly head_transform: HeadTransform;
  readonly left_eye: EyeState;
  readonly right_eye: EyeState;
  readonly left_eyebrow: EyebrowState;
  readonly right_eyebrow: EyebrowState;
  readonly mouth: MouthState;
  readonly jaw: JawState;
  readonly blink: BlinkState;
  readonly temporal: TemporalMetadata;
}

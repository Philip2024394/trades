// §36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1 · engine types
// NEX bounded infrastructure · engine runtime types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.

import type { Buffer } from "node:buffer";
import type { PCE_ExtractionRefusalReason } from "./perceptual-extraction-ranges";
import type { PerceptualExtractionResult } from "./perceptual-extraction";

export const PCE_GREP_MARKER = "§36-PCE1 · WAVE-PCE-V1 · 2026-09-15 · nex-perceptual-contract-extraction-v1" as const;
export const PCE_ALGORITHM_VERSION = "1.0.0" as const;
export const PCE_ALGORITHM_SLUG = "nex-pce-v1-deterministic-header" as const;
export type PCEGrepMarker = typeof PCE_GREP_MARKER;

export interface RunPerceptualExtractionRequest {
  readonly request_id: string;
  readonly image_bytes: Uint8Array | Buffer;
  readonly extraction_timestamp?: string;
  readonly run_id?: string;
  readonly result_id?: string;
}

export interface PCESuccess {
  readonly kind: "SUCCESS";
  readonly result: PerceptualExtractionResult;
  readonly grep_marker: PCEGrepMarker;
  readonly algorithm_version: typeof PCE_ALGORITHM_VERSION;
}

export interface PCEFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: PCE_ExtractionRefusalReason;
  readonly reason: string;
  readonly grep_marker: PCEGrepMarker;
  readonly algorithm_version: typeof PCE_ALGORITHM_VERSION;
}

export type PCEResult = PCESuccess | PCEFailure;

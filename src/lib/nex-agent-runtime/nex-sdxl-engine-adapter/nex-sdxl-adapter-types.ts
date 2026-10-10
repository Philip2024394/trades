// §36-V3-SDXL · WAVE-P1-CAMPAIGN · 2026-09-15 · nex-sdxl-engine-adapter · types
// NEX bounded infrastructure · SDXL adapter runtime types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// The adapter is a Node → Python subprocess bridge. External model name
// "SDXL" appears here only in the licence-manifest reference · the NEX-
// native slug the rest of NEX interacts with is `nex-visual-engine-primary`.

import type { V3GenerationRequest, V3GenerationOutcome } from "../nex-visual-intelligence-v3/visual-generation-contract";

export const NEX_SDXL_ADAPTER_GREP_MARKER = "§36-V3-SDXL · WAVE-P1-CAMPAIGN · 2026-09-15 · nex-sdxl-engine-adapter" as const;
export const NEX_SDXL_ADAPTER_VERSION = "0.1.0" as const;
export const NEX_SDXL_NATIVE_SLUG = "nex-visual-engine-primary" as const;

export type NexSdxlAdapterRefusalCode =
  | "NEX_SDXL_INVALID_REQUEST"
  | "NEX_SDXL_PROHIBITED_STRING_CONTENT"
  | "NEX_SDXL_PYTHON_NOT_AVAILABLE"
  | "NEX_SDXL_SCRIPT_MISSING"
  | "NEX_SDXL_PROCESS_TIMEOUT"
  | "NEX_SDXL_PROCESS_NON_ZERO_EXIT"
  | "NEX_SDXL_OUTPUT_UNPARSEABLE"
  | "NEX_SDXL_OUTPUT_FILE_MISSING"
  | "NEX_SDXL_INTERNAL";

export interface NexSdxlInvocationOptions {
  readonly seed?: number;
  readonly height?: number;
  readonly width?: number;
  readonly num_inference_steps?: number;
  readonly guidance_scale?: number;
  /** Absolute path to `python.exe`. Required · adapter refuses to spawn without an explicit path. */
  readonly python_exe: string;
  /** Absolute path to `scripts/nex-sdxl-generate.py`. Required. */
  readonly script_path: string;
  /** Absolute path to the output directory. Required. */
  readonly output_dir: string;
  /** Absolute path to the temp request-json file the adapter writes. Required. */
  readonly request_json_path: string;
  /** Maximum inference time (milliseconds). Default 30 minutes. */
  readonly timeout_ms?: number;
}

export interface RunNexSdxlAdapterRequest {
  readonly request: V3GenerationRequest;
  readonly options: NexSdxlInvocationOptions;
}

export interface NexSdxlAdapterSuccess {
  readonly kind: "SUCCESS";
  readonly outcome: V3GenerationOutcome;
  readonly output_image_path_relative: string;
  readonly output_bytes: number;
  readonly output_sha256: string;
  readonly python_stdout_last_line_json: string;
  readonly grep_marker: typeof NEX_SDXL_ADAPTER_GREP_MARKER;
  readonly adapter_version: typeof NEX_SDXL_ADAPTER_VERSION;
}

export interface NexSdxlAdapterFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: NexSdxlAdapterRefusalCode;
  readonly reason: string;
  readonly stdout_tail: string | null;
  readonly stderr_tail: string | null;
  readonly grep_marker: typeof NEX_SDXL_ADAPTER_GREP_MARKER;
  readonly adapter_version: typeof NEX_SDXL_ADAPTER_VERSION;
}

export type NexSdxlAdapterResult = NexSdxlAdapterSuccess | NexSdxlAdapterFailure;

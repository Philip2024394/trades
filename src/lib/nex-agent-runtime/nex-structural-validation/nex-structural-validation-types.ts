// §36-VISUAL-STRUCTURAL-LOCK · M-3 · structural validation types · 2026-09-15
// NEX bounded infrastructure · same discipline as structural extraction:
// no fabricated values · component-by-component detection status · overall
// status NOT_IMPLEMENTED whenever any required component is untested.

export const NEX_STRUCTURAL_VALIDATOR_GREP_MARKER = "§36-VISUAL-STRUCTURAL-LOCK · M-3 · nex-structural-validation" as const;
export const NEX_STRUCTURAL_VALIDATOR_VERSION = "0.1.0" as const;
export const NEX_STRUCTURAL_VALIDATOR_NAME = "nex-structural-validator" as const;

export type NexStructuralValidationRefusalCode =
  | "NEX_VAL_INVALID_REQUEST"
  | "NEX_VAL_REFERENCE_PROFILE_MISSING"
  | "NEX_VAL_GENERATED_ASSET_MISSING"
  | "NEX_VAL_PYTHON_NOT_AVAILABLE"
  | "NEX_VAL_SCRIPT_MISSING"
  | "NEX_VAL_PROCESS_TIMEOUT"
  | "NEX_VAL_PROCESS_NON_ZERO_EXIT"
  | "NEX_VAL_OUTPUT_UNPARSEABLE"
  | "NEX_VAL_RECEIPT_MISSING"
  | "NEX_VAL_INTERNAL";

// Founder-locked overall_status enum · matches the DB CHECK constraint.
export type NexValidationOverallStatus =
  | "PENDING"
  | "RUNNING"
  | "PASS"
  | "FAIL"
  | "NOT_IMPLEMENTED"
  | "ERROR";

export type NexComponentDetectionStatus =
  | "verified_deterministic"
  | "not_implemented"
  | "failed"
  | "pending";

export interface NexComponentResult {
  readonly component: string;
  readonly detection_status: NexComponentDetectionStatus;
  readonly value: number | null;
  readonly confidence: number | null;
  readonly threshold: number | null;
  readonly passed: boolean | null;
  readonly reason: string | null;
  readonly runtime_seconds: number | null;
  readonly extractor?: string;
}

export interface NexValidationReceipt {
  readonly kind: "SUCCESS";
  readonly validator_name: string;
  readonly validator_version: string;
  readonly reference_profile_json_path: string;
  readonly reference_asset_id: string | null;
  readonly reference_asset_input_sha256: string;
  readonly generated_asset_id: string | null;
  readonly generated_asset_path: string;
  readonly generated_asset_sha256: string;
  readonly generated_asset_width: number;
  readonly generated_asset_height: number;
  readonly component_results: Readonly<Record<string, NexComponentResult>>;
  readonly overall_status: NexValidationOverallStatus;
  readonly overall_score: number | null;
  readonly overall_reason: string;
  readonly failure_reasons: readonly string[];
  readonly environment: {
    readonly python_version: string;
    readonly platform: string;
  };
  readonly validated_at: string;
}

export interface RunNexStructuralValidationRequest {
  readonly reference_asset_id: string | null;
  readonly generated_asset_id: string | null;
  readonly reference_profile_json_path: string;
  readonly generated_image_path: string;
  readonly output_dir: string;
  readonly threshold_depth_correlation?: number;
  readonly threshold_edge_ssim?: number;
  readonly threshold_foreground_iou?: number;
  readonly python_exe: string;
  readonly script_path: string;
  readonly timeout_ms?: number;
}

export interface NexStructuralValidationSuccess {
  readonly kind: "SUCCESS";
  readonly receipt: NexValidationReceipt;
  readonly receipt_path_relative: string;
  readonly python_stdout_last_line_json: string;
  readonly grep_marker: typeof NEX_STRUCTURAL_VALIDATOR_GREP_MARKER;
  readonly validator_version: typeof NEX_STRUCTURAL_VALIDATOR_VERSION;
}

export interface NexStructuralValidationFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: NexStructuralValidationRefusalCode;
  readonly reason: string;
  readonly stdout_tail: string | null;
  readonly stderr_tail: string | null;
  readonly grep_marker: typeof NEX_STRUCTURAL_VALIDATOR_GREP_MARKER;
  readonly validator_version: typeof NEX_STRUCTURAL_VALIDATOR_VERSION;
}

export type NexStructuralValidationResult = NexStructuralValidationSuccess | NexStructuralValidationFailure;

// §36-VISUAL-STRUCTURAL-LOCK · M-2 · structural extraction types · 2026-09-15
// NEX bounded infrastructure · authorising bare-token
//   AUTHORISE NEX VISUAL STRUCTURAL LOCK ARCHITECTURE WAVE.
//
// Types are shaped to match nex_visual_reference_profiles.geometry_data +
// .visual_data. No fabricated numbers · every value/confidence pair carries
// an explicit detection_status. Consumers must distinguish null from 0.

export const NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER = "§36-VISUAL-STRUCTURAL-LOCK · M-2 · nex-structural-extraction" as const;
export const NEX_STRUCTURAL_EXTRACTOR_VERSION = "0.1.0" as const;
export const NEX_STRUCTURAL_EXTRACTOR_NAME = "nex-structural-extractor" as const;

export type NexStructuralExtractionRefusalCode =
  | "NEX_STRUCT_INVALID_REQUEST"
  | "NEX_STRUCT_INPUT_MISSING"
  | "NEX_STRUCT_PYTHON_NOT_AVAILABLE"
  | "NEX_STRUCT_SCRIPT_MISSING"
  | "NEX_STRUCT_PROCESS_TIMEOUT"
  | "NEX_STRUCT_PROCESS_NON_ZERO_EXIT"
  | "NEX_STRUCT_OUTPUT_UNPARSEABLE"
  | "NEX_STRUCT_PROFILE_MISSING"
  | "NEX_STRUCT_INTERNAL";

export type NexFeatureDetectionStatus =
  | "verified_deterministic"
  | "verified_probabilistic"
  | "not_implemented"
  | "failed"
  | "pending";

export interface NexFeatureValue<T = unknown> {
  readonly value: T | null;
  readonly confidence: number | null;
  readonly detection_status: NexFeatureDetectionStatus;
  readonly reason?: string;
}

export interface NexVisualDataDepth {
  readonly extractor: string;
  readonly licence: string;
  readonly storage_path: string | null;
  readonly preview_storage_path: string | null;
  readonly min_depth: number | null;
  readonly max_depth: number | null;
  readonly mean_depth: number | null;
  readonly detection_status: NexFeatureDetectionStatus;
  readonly error_reason: string | null;
  readonly runtime_seconds: number | null;
}

export interface NexVisualDataEdges {
  readonly extractor: string;
  readonly licence: string;
  readonly storage_path: string | null;
  readonly detection_status: NexFeatureDetectionStatus;
  readonly error_reason: string | null;
  readonly runtime_seconds: number | null;
  readonly canny_threshold_low: number;
  readonly canny_threshold_high: number;
  readonly edge_pixel_count: number | null;
  readonly edge_density_ratio: number | null;
}

export interface NexVisualDataMask {
  readonly extractor: string;
  readonly licence: string;
  readonly storage_path: string | null;
  readonly detection_status: NexFeatureDetectionStatus;
  readonly error_reason: string | null;
  readonly runtime_seconds: number | null;
  readonly mask_pixel_count: number | null;
  readonly mask_coverage_ratio: number | null;
}

export interface NexReferenceProfile {
  readonly kind: "SUCCESS";
  readonly extractor_name: string;
  readonly extractor_version: string;
  readonly profile_type: string;
  readonly profile_version: number;
  readonly reference_asset_id: string | null;
  readonly reference_asset_input_path: string;
  readonly reference_asset_input_sha256: string;
  readonly reference_asset_input_bytes: number;
  readonly reference_asset_width: number;
  readonly reference_asset_height: number;
  readonly reference_asset_aspect_ratio: number;
  readonly geometry_data: {
    readonly stair_pitch_degrees: NexFeatureValue<number>;
    readonly tread_count_visible: NexFeatureValue<number>;
    readonly tread_spacing_pixels: NexFeatureValue<number>;
    readonly riser_run_ratio: NexFeatureValue<number>;
    readonly handrail_trajectory: NexFeatureValue<unknown>;
    readonly newel_positions: NexFeatureValue<unknown>;
    readonly baluster_count_visible: NexFeatureValue<number>;
    readonly baluster_spacing_mean_pixels: NexFeatureValue<number>;
    readonly stringer_boundary_polygons: NexFeatureValue<unknown>;
    readonly upper_landing_connection: NexFeatureValue<unknown>;
    readonly silhouette_polygon: NexFeatureValue<unknown>;
    readonly staircase_bounding_region: NexFeatureValue<unknown>;
  };
  readonly visual_data: {
    readonly depth: NexVisualDataDepth;
    readonly edges: NexVisualDataEdges;
    readonly foreground_mask: NexVisualDataMask;
  };
  readonly extraction_environment: {
    readonly python_version: string;
    readonly platform: string;
  };
  readonly extracted_at: string;
  readonly overall_confidence: number | null;
  readonly extraction_status: "complete" | "failed" | "pending" | "running" | "not_implemented";
}

export interface RunNexStructuralExtractionRequest {
  readonly reference_asset_id: string | null;
  readonly input_image_path: string;
  readonly output_dir: string;
  readonly profile_type?: string;
  readonly profile_version?: number;
  readonly python_exe: string;
  readonly script_path: string;
  readonly timeout_ms?: number;
}

export interface NexStructuralExtractionSuccess {
  readonly kind: "SUCCESS";
  readonly profile: NexReferenceProfile;
  readonly profile_receipt_path_relative: string;
  readonly python_stdout_last_line_json: string;
  readonly grep_marker: typeof NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER;
  readonly extractor_version: typeof NEX_STRUCTURAL_EXTRACTOR_VERSION;
}

export interface NexStructuralExtractionFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: NexStructuralExtractionRefusalCode;
  readonly reason: string;
  readonly stdout_tail: string | null;
  readonly stderr_tail: string | null;
  readonly grep_marker: typeof NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER;
  readonly extractor_version: typeof NEX_STRUCTURAL_EXTRACTOR_VERSION;
}

export type NexStructuralExtractionResult = NexStructuralExtractionSuccess | NexStructuralExtractionFailure;

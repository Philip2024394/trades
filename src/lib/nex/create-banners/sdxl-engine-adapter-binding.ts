// src/lib/nex/create-banners/sdxl-engine-adapter-binding.ts
//
// NEX Create Banners · SDXL engine adapter binding · Founder Authorisation A · 2026-09-23
// ========================================================================================
// One implementation of the GenerationEngineAdapter contract that binds to
// the existing local SDXL adapter at:
//   src/lib/nex-agent-runtime/nex-sdxl-engine-adapter/
//
// This file is the ONLY place in the create-banners module that imports
// SDXL-specific types. The rest of the module is engine-agnostic.
// See doctrine locks at the bottom.

import type {
  GenerationEngineAdapter,
  GenerationEngineProvider,
} from "./capability-contract";
import type {
  BannerGenerationRequest,
  GenerationResult,
} from "./types";
import { getBannerFormat } from "./formats";
import { DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES } from "./quality-status";

/**
 * Engine slug used by the binding. Chosen to match the existing internal
 * slug used by the SDXL adapter (`nex-visual-engine-primary`) — the same
 * name so NEX capability logs are consistent, but every OTHER file in
 * create-banners refers to the engine only through the adapter interface.
 */
export const NEX_VISUAL_ENGINE_PRIMARY_SLUG =
  "nex-visual-engine-primary" as const;

/**
 * Adapter version. Bumped independently from the underlying SDXL script.
 * This is the CREATE-BANNERS BINDING version, not the SDXL Python script
 * version.
 */
export const CREATE_BANNERS_SDXL_BINDING_VERSION = "0.1.0" as const;

/**
 * Constructor input for the binding. Every dependency is injected · zero
 * side effects at module load. Tests may inject fakes.
 */
export interface SdxlBindingInput {
  /**
   * The underlying SDXL adapter's `runNexSdxlAdapter` function. Injected
   * so create-banners never imports the SDXL adapter module at type-time
   * (keeps type-level engine-independence enforced in tests).
   */
  readonly invokeUnderlyingAdapter: (payload: {
    readonly seed: number;
    readonly width: number;
    readonly height: number;
    readonly output_dir: string;
    readonly request_json_path: string;
  }) => Promise<UnderlyingAdapterOutcome>;

  /** Where the underlying script writes outputs. */
  readonly output_dir_abs: string;
  /** Where to write per-request JSON. */
  readonly request_json_path_abs: string;
}

export type UnderlyingAdapterOutcome =
  | {
      readonly kind: "SUCCESS";
      readonly output_image_path_relative: string;
      readonly output_bytes: number;
      readonly output_sha256: string;
      readonly duration_ms: number;
      readonly model_weights_sha256_fingerprint: string;
    }
  | {
      readonly kind: "FAILURE";
      readonly reason: string;
    };

/**
 * The GenerationEngineAdapter binding. `runAdapter` is engine-agnostic in
 * signature and only translates the create-banners request into the
 * underlying SDXL call.
 */
export function makeSdxlEngineAdapter(
  input: SdxlBindingInput
): GenerationEngineAdapter {
  const { invokeUnderlyingAdapter, output_dir_abs, request_json_path_abs } =
    input;
  return {
    engine_slug: NEX_VISUAL_ENGINE_PRIMARY_SLUG,
    adapter_version: CREATE_BANNERS_SDXL_BINDING_VERSION,
    is_local_only: true,
    async runAdapter(
      request: BannerGenerationRequest
    ): Promise<GenerationResult> {
      const format = getBannerFormat(request.format_id);
      const started_at = new Date();
      const outcome = await invokeUnderlyingAdapter({
        seed: request.seed,
        width: format.width,
        height: format.height,
        output_dir: output_dir_abs,
        request_json_path: request_json_path_abs,
      });
      if (outcome.kind === "FAILURE") {
        return {
          result_id: `${request.request_id}::result`,
          request_id: request.request_id,
          kind: "FAILURE",
          generated_asset_path_or_ref: null,
          generated_asset_sha256: null,
          engine_identity: {
            engine_slug: NEX_VISUAL_ENGINE_PRIMARY_SLUG,
            engine_adapter_version: CREATE_BANNERS_SDXL_BINDING_VERSION,
          },
          model_identity: {
            model_slug: "unknown",
            model_variant: null,
            model_weights_sha256_fingerprint: "unknown",
          },
          seed: request.seed,
          generation_parameters_fingerprint: `seed=${request.seed}·w=${format.width}·h=${format.height}·quality=${request.quality_status_at_request_time}`,
          reference_provenance: [],
          generated_at: started_at.toISOString(),
          generation_duration_ms: Date.now() - started_at.getTime(),
          quality_status_at_generation_time:
            DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
          failure_reason: outcome.reason,
        };
      }
      return {
        result_id: `${request.request_id}::result`,
        request_id: request.request_id,
        kind: "SUCCESS",
        generated_asset_path_or_ref: outcome.output_image_path_relative,
        generated_asset_sha256: outcome.output_sha256,
        engine_identity: {
          engine_slug: NEX_VISUAL_ENGINE_PRIMARY_SLUG,
          engine_adapter_version: CREATE_BANNERS_SDXL_BINDING_VERSION,
        },
        model_identity: {
          model_slug: "sdxl-1.0-base",
          model_variant: "fp16",
          model_weights_sha256_fingerprint:
            outcome.model_weights_sha256_fingerprint,
        },
        seed: request.seed,
        generation_parameters_fingerprint: `seed=${request.seed}·w=${format.width}·h=${format.height}·quality=${request.quality_status_at_request_time}`,
        reference_provenance: [],
        generated_at: started_at.toISOString(),
        generation_duration_ms: outcome.duration_ms,
        quality_status_at_generation_time:
          DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
        failure_reason: null,
      };
    },
  };
}

/**
 * Provider wrapping the SDXL adapter. Registered with the
 * InMemoryGenerationEngineRegistry by callers that want SDXL selected.
 */
export function makeSdxlProvider(
  adapter: GenerationEngineAdapter
): GenerationEngineProvider {
  return {
    provider_slug: NEX_VISUAL_ENGINE_PRIMARY_SLUG,
    display_name: "NEX Visual Engine Primary (local SDXL)",
    quality_status: DEFAULT_QUALITY_STATUS_UNTIL_EVALUATION_PASSES,
    adapter,
  };
}

// Doctrine locks
export const _SDXL_BINDING_IS_ONLY_ENGINE_SPECIFIC_FILE = true as const;
export const _SDXL_BINDING_IS_LOCAL_ONLY = true as const;
export const _SDXL_BINDING_QUALITY_STATUS_STARTS_UNPROVEN = true as const;
export const _SDXL_BINDING_NEVER_CALLS_ANTHROPIC = true as const;

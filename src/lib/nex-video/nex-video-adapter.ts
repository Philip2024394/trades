// NEX Video · reference image-to-video adapter (H0 HONEST STUB)
// 2026-09-15 · AGENT VIDEO investigation deliverable.
//
// PURPOSE
// -------
// Defines the NEX video generation contract that a later H1/H2 wave
// (12 GB+ VRAM tier, or authorised hosted-provider adapter) can plug
// into. On H0 (RTX 2050 4 GB VRAM · ~710 MB free disk) EVERY credible
// open-weight image-to-video model is out of reach:
//
//   · CogVideoX-2B (Apache-2.0)     ~5-8 GB weights · ~12 GB VRAM
//   · LTX-Video (OpenRAIL)           ~9 GB weights · ~12 GB VRAM
//   · Wan 2.2                        ~20+ GB weights · 24 GB VRAM
//   · Stable Video Diffusion img2vid ~9 GB weights · ~8 GB VRAM at
//                                    576x1024 · borderline at 384x384
//                                    fp16 with aggressive offload but
//                                    still infeasible on 710 MB free
//                                    disk (SVD weights alone exceed
//                                    current headroom).
//
// This adapter therefore returns NEX_VIDEO_INSUFFICIENT_HARDWARE
// truthfully on H0. It NEVER fabricates a "successful" video. It
// preserves the interface so H1/H2 code can implement a real engine
// without touching call sites.
//
// Aligned with Founder doctrine (Structural-Lock · sealed 2026-09-15):
//   · Do NOT ship visually-plausible-but-structurally-wrong output.
//   · Reference geometry (staircase / product) is the anchor, not
//     inspiration — the same applies to any future video engine.
//   · A faster video that is the wrong staircase is a failure.
//
// This file MUST NOT:
//   · download models
//   · pip install packages
//   · mutate V3_ENGINE_REGISTRY
//   · touch DB migrations
//   · mock a successful video path
//
// A later wave (post-H1 hardware upgrade OR authorised hosted-provider
// wave) implements the real engine behind this contract.

// ---------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------

/**
 * Refusal codes returned when the adapter cannot honestly produce a
 * video. Every non-success path MUST return one of these; the caller
 * decides whether to surface a UX message, queue for retry, or block.
 */
export const NEX_VIDEO_REFUSAL_CODES = {
  /** Hardware tier below required VRAM / disk. Waits for H1 upgrade. */
  INSUFFICIENT_HARDWARE: "NEX_VIDEO_INSUFFICIENT_HARDWARE",
  /** No engine registered locally AND no authorised hosted provider. */
  NO_ENGINE_AVAILABLE: "NEX_VIDEO_NO_ENGINE_AVAILABLE",
  /** Hosted provider selected but credentials/config missing. */
  PROVIDER_NOT_CONFIGURED: "NEX_VIDEO_PROVIDER_NOT_CONFIGURED",
  /** Reference image failed structural pre-check (e.g. profile absent). */
  REFERENCE_UNVALIDATED: "NEX_VIDEO_REFERENCE_UNVALIDATED",
  /** Feature gate off (Founder-controlled rollout). */
  FEATURE_DISABLED: "NEX_VIDEO_FEATURE_DISABLED",
} as const;

export type NexVideoRefusalCode =
  (typeof NEX_VIDEO_REFUSAL_CODES)[keyof typeof NEX_VIDEO_REFUSAL_CODES];

export interface GenerateVideoInput {
  /** Absolute path (or NEX asset URI) of the locked reference image. */
  referenceImagePath: string;
  /** Motion description ("gentle orbit camera around staircase"). */
  motionPrompt: string;
  /** Optional: reference_profile_id if the caller already extracted one. */
  referenceProfileId?: string;
  /** Target duration in seconds. Engines cap this to their own max. */
  durationSeconds?: number;
  /** Frames per second (default 8 — cheap tier). */
  fps?: number;
  /** Deterministic seed for reproducibility. */
  seed?: number;
  /** Explicit engine hint (else auto-selected). */
  engineHint?: "svd" | "cogvideox" | "ltx" | "wan22" | "hosted-replicate" | "hosted-fal";
}

export interface GenerateVideoRefusal {
  ok: false;
  refusalCode: NexVideoRefusalCode;
  humanMessage: string;
  detectedHardware: {
    vramGb: number | null;
    freeDiskMb: number | null;
    platform: string;
  };
  unblocksAt: "H1" | "H2" | "provider-configured" | "feature-flag-on";
}

export interface GenerateVideoSuccess {
  ok: true;
  videoAssetId: string;
  videoStoragePath: string;
  durationSeconds: number;
  fps: number;
  frameCount: number;
  engine: string;
  engineVersion: string;
  referenceAssetId: string;
  referenceProfileId: string;
  generationParameters: Record<string, unknown>;
  /** REQUIRED: structural similarity vs reference (0..1). Never fabricated. */
  structuralSimilarity: number;
  createdAt: string;
}

export type GenerateVideoResult = GenerateVideoSuccess | GenerateVideoRefusal;

// ---------------------------------------------------------------------
// Hardware detection · read-only, no side effects
// ---------------------------------------------------------------------

/**
 * Minimum requirements for the CHEAPEST credible open-weight I2V engine
 * (SVD at 384x384 fp16 with sequential CPU offload + VAE tiling).
 * Even this is optimistic on 4 GB VRAM.
 */
const MIN_VRAM_GB_LOCAL_I2V = 8;
const MIN_FREE_DISK_MB_LOCAL_I2V = 12_000; // SVD weights ~9 GB + workspace

interface DetectedHardware {
  vramGb: number | null;
  freeDiskMb: number | null;
  platform: string;
}

/**
 * H0-safe hardware probe. Returns null fields when detection is
 * unavailable rather than fabricating numbers. The caller decides
 * how strictly to treat null (default: treat null as insufficient).
 *
 * Deliberately synchronous + dependency-free so this file loads in any
 * NEX runtime (Next.js route, worker, script) without side effects.
 */
export function detectVideoHardware(
  overrides?: Partial<DetectedHardware>,
): DetectedHardware {
  return {
    vramGb: overrides?.vramGb ?? null,
    freeDiskMb: overrides?.freeDiskMb ?? null,
    platform: overrides?.platform ?? (typeof process !== "undefined" ? process.platform : "unknown"),
  };
}

// ---------------------------------------------------------------------
// Adapter entry point
// ---------------------------------------------------------------------

/**
 * Generate a video from a NEX-locked reference image + motion prompt.
 *
 * On H0 (current NEX build machine) this ALWAYS returns a refusal with
 * NEX_VIDEO_INSUFFICIENT_HARDWARE. That is the honest answer. When a
 * later wave authorises H1 hardware or a hosted provider, the real
 * engine is implemented in a sibling file and dispatched to from here.
 *
 * NEVER returns a mocked success. Callers can safely rely on `ok: true`
 * meaning a real video asset exists on disk with a measured structural
 * similarity score against the reference.
 */
export async function generateVideoFromReference(
  input: GenerateVideoInput,
  hardware: DetectedHardware = detectVideoHardware(),
): Promise<GenerateVideoResult> {
  // Void the input in a lint-safe way so future engines see it.
  void input;

  // ---- Feature gate (Founder-controlled) ---------------------------
  // No env var declared yet · intentional. When Founder authorises the
  // NEX Video wave, this reads NEX_VIDEO_ENABLED from env. Until then
  // we take the honest path: the feature is not enabled, not because
  // of a flag, but because no engine can honestly serve it.

  // ---- Hardware gate -----------------------------------------------
  const vramInsufficient =
    hardware.vramGb === null || hardware.vramGb < MIN_VRAM_GB_LOCAL_I2V;
  const diskInsufficient =
    hardware.freeDiskMb === null || hardware.freeDiskMb < MIN_FREE_DISK_MB_LOCAL_I2V;

  if (vramInsufficient || diskInsufficient) {
    return {
      ok: false,
      refusalCode: NEX_VIDEO_REFUSAL_CODES.INSUFFICIENT_HARDWARE,
      humanMessage:
        "Video generation is not available on the current hardware tier. " +
        "NEX video unblocks at H1 (12 GB+ VRAM local engine) or when a " +
        "hosted provider is authorised. No credible open-weight image-to-" +
        "video model fits 4 GB VRAM with 710 MB free disk.",
      detectedHardware: hardware,
      unblocksAt: "H1",
    };
  }

  // ---- No engine registered yet ------------------------------------
  // Even if hardware were sufficient, no engine adapter is wired here.
  // That is intentional: registering a video engine requires a Founder-
  // authorised wave per the same doctrine that governs V3 registry.
  return {
    ok: false,
    refusalCode: NEX_VIDEO_REFUSAL_CODES.NO_ENGINE_AVAILABLE,
    humanMessage:
      "Hardware would suffice but no NEX video engine is registered. " +
      "Register one via a Founder-authorised NEX Video wave.",
    detectedHardware: hardware,
    unblocksAt: "feature-flag-on",
  };
}

/**
 * Convenience: returns the refusal a caller would receive right now
 * WITHOUT running the full generator. Useful for UX pre-checks so the
 * "Create video" button can be disabled with an honest tooltip.
 */
export function probeVideoAvailability(
  hardware: DetectedHardware = detectVideoHardware(),
): GenerateVideoRefusal | { ok: true; note: "adapter ready · engine not registered" } {
  const vramInsufficient =
    hardware.vramGb === null || hardware.vramGb < MIN_VRAM_GB_LOCAL_I2V;
  const diskInsufficient =
    hardware.freeDiskMb === null || hardware.freeDiskMb < MIN_FREE_DISK_MB_LOCAL_I2V;

  if (vramInsufficient || diskInsufficient) {
    return {
      ok: false,
      refusalCode: NEX_VIDEO_REFUSAL_CODES.INSUFFICIENT_HARDWARE,
      humanMessage:
        "Video generation blocked at H0. Unblocks at H1 (12 GB+ VRAM) " +
        "or when a hosted provider is authorised.",
      detectedHardware: hardware,
      unblocksAt: "H1",
    };
  }

  return { ok: true, note: "adapter ready · engine not registered" };
}

// src/lib/nex-native/custom-intro-config.ts
//
// NEX Phase 1.0 Custom Intro · shared constants (client-safe).
// Sealed 2026-10-06.
//
// Pure data · no server-only runtime · imported by both the service
// (which is server-only) and the client surface (which is "use client").
// Keeping the constants here avoids pulling the server-only directive
// across the server/client boundary · see the sealed build error from
// 2026-10-06 that prompted this split.

export const CUSTOM_INTRO_PRICE_IDR = 500_000;

export const CUSTOM_INTRO_STORAGE_BUCKET = "nex-media-videos";

export const CUSTOM_INTRO_VIDEO_LIMITS = Object.freeze({
  min_duration_ms: 3_000,
  max_duration_ms: 10_000,
  max_size_bytes: 20 * 1024 * 1024, // 20 MB
  min_width: 480,
  min_height: 270,
  max_width: 3_840,
  max_height: 2_160,
  allowed_mime_types: ["video/mp4", "video/quicktime"] as const,
  // Target aspect ratio · 16:9 ± 10% tolerance. Narrower / taller videos
  // break the chat intro overlay layout.
  target_aspect: 16 / 9,
  aspect_tolerance: 0.1,
});

export interface VideoValidationInput {
  mime_type: string;
  size_bytes: number;
  duration_ms: number;
  width: number;
  height: number;
}

export type VideoValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Validate a video against the Custom Intro limits. Pure function ·
 *  CLIENT-SAFE (no server-only imports) · called server-side in the
 *  upload API before persisting, and could be called client-side as a
 *  pre-flight if desired. */
export function validateVideo(input: VideoValidationInput): VideoValidationResult {
  const L = CUSTOM_INTRO_VIDEO_LIMITS;
  if (!L.allowed_mime_types.includes(input.mime_type as "video/mp4" | "video/quicktime")) {
    return {
      ok: false,
      reason: `Video must be one of: ${L.allowed_mime_types.join(", ")}`,
    };
  }
  if (input.size_bytes <= 0 || input.size_bytes > L.max_size_bytes) {
    return {
      ok: false,
      reason: `Video must be between 1 byte and ${Math.round(L.max_size_bytes / 1024 / 1024)}MB`,
    };
  }
  if (
    input.duration_ms < L.min_duration_ms ||
    input.duration_ms > L.max_duration_ms
  ) {
    return {
      ok: false,
      reason: `Video length must be between ${L.min_duration_ms / 1000}s and ${L.max_duration_ms / 1000}s`,
    };
  }
  if (
    input.width < L.min_width ||
    input.height < L.min_height ||
    input.width > L.max_width ||
    input.height > L.max_height
  ) {
    return {
      ok: false,
      reason: `Video dimensions must be between ${L.min_width}x${L.min_height} and ${L.max_width}x${L.max_height}`,
    };
  }
  const aspect = input.width / input.height;
  if (
    Math.abs(aspect - L.target_aspect) / L.target_aspect >
    L.aspect_tolerance
  ) {
    return {
      ok: false,
      reason: "Video must be 16:9 (landscape) · retry with a 16:9 crop",
    };
  }
  return { ok: true };
}

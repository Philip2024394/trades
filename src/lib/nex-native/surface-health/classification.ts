// src/lib/nex-native/surface-health/classification.ts
//
// Closed-set error_classification contract for the surface-health domain.
// Sealed per doctrine §7.4 (NEX Chat Surfaces × Visual Themes × HQ ·
// 2026-10-03). Extending this set requires a schema migration — the
// nex_surface_health_event.error_classification CHECK constraint locks
// the enum at the DB layer, so TypeScript and SQL stay in lock-step.

export const ERROR_CLASSIFICATIONS = [
  "render_runtime_error",
  "theme_asset_missing",
  "theme_asset_invalid",
  "theme_bundle_load_failure",
  "animation_runtime_error",
  "sticker_renderer_error",
  "emoji_renderer_error",
  "bubble_renderer_error",
  "composer_render_error",
  "unknown",
] as const;

export type ErrorClassification = (typeof ERROR_CLASSIFICATIONS)[number];

export function isErrorClassification(v: unknown): v is ErrorClassification {
  return (
    typeof v === "string" &&
    (ERROR_CLASSIFICATIONS as readonly string[]).includes(v)
  );
}

export const RECOVERY_ACTIONS = [
  "none",
  "fallback",
  "retry",
  "degrade",
] as const;

export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];

export function isRecoveryAction(v: unknown): v is RecoveryAction {
  return (
    typeof v === "string" && (RECOVERY_ACTIONS as readonly string[]).includes(v)
  );
}

/** Normalized client environment per doctrine §7.4. Raw user-agent
 *  strings MUST NOT be stored anywhere in this shape — resolve to the
 *  normalized dimensions below at the ingestion boundary. */
export interface ClientEnvironment {
  browser: string; // e.g. "chrome", "safari", "firefox", "edge"
  os: string; // e.g. "windows", "macos", "ios", "android", "linux"
  device_class: "mobile" | "tablet" | "desktop" | "unknown";
  runtime: "web" | "pwa" | "unknown";
  locale?: string; // optional · e.g. "en-GB" · never a precise identifier
}

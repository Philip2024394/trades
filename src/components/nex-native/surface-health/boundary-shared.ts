// src/components/nex-native/surface-health/boundary-shared.ts
//
// Shared types + helpers for Tier 1/2/3 surface-health boundaries.
// Non-rendering · safe to import from both client and server contexts.
//
// Doctrine references:
//   · §5 Layered Error Boundaries · 3 tiers
//   · §5a Error Boundary Scope · render/runtime only
//   · §7.4 content-safety · no raw error text, no stack, no PII
//   · §8 User UX separation · raw errors never reach the user

import type {
  ErrorClassification,
  RecoveryAction,
} from "@/lib/nex-native/surface-health/classification";

/** The three protection tiers per doctrine §5. */
export type BoundaryTier = "chat-core" | "visual-theme" | "optional-visual-module";

/** Normalized payload emitted by a boundary to the ingestion route.
 *  Deliberately omits error.message, stack, componentStack and any
 *  caller-supplied free text that could carry conversation content. */
export interface BoundaryEmission {
  tier: BoundaryTier;
  surface: string;
  visual_theme: string;
  component_module: string;
  error_classification: ErrorClassification;
  recovery_action: RecoveryAction;
  app_version?: string | null;
  theme_version?: string | null;
  client_environment?: NormalizedClientEnvironment | null;
}

/** The subset of ClientEnvironment that boundaries can derive from
 *  the browser without touching UA strings. */
export interface NormalizedClientEnvironment {
  browser: string;
  os: string;
  device_class: "mobile" | "tablet" | "desktop" | "unknown";
  runtime: "web" | "pwa" | "unknown";
}

/** Map (tier, module) to a classification from the closed set defined
 *  in Item 1's src/lib/nex-native/surface-health/classification.ts.
 *  Pure function · deterministic · never consults error.message. */
export function classifyBoundaryError(
  tier: BoundaryTier,
  component_module: string,
): ErrorClassification {
  const m = component_module.toLowerCase();
  if (m.includes("bubble")) return "bubble_renderer_error";
  if (m.includes("animation") || m.includes("overlay") || m.includes("smoke")) {
    return "animation_runtime_error";
  }
  if (m.includes("sticker")) return "sticker_renderer_error";
  if (m.includes("emoji")) return "emoji_renderer_error";
  if (m.includes("composer")) return "composer_render_error";
  if (tier === "visual-theme") return "theme_bundle_load_failure";
  // Tier 1 catches anything that got past Tier 2 and Tier 3.
  return "render_runtime_error";
}

/** Return a safe normalized device/runtime signal from the current
 *  browser without storing a raw user-agent string. Called on the
 *  client just before emission. */
export function readNormalizedClientEnvironment():
  | NormalizedClientEnvironment
  | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return null;
  }
  const ua = navigator.userAgent ?? "";
  const browser = detectBrowser(ua);
  const os = detectOs(ua);
  const device_class = detectDeviceClass(ua);
  const runtime: NormalizedClientEnvironment["runtime"] =
    isStandalonePwa() ? "pwa" : "web";
  return { browser, os, device_class, runtime };
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "edge";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "chrome";
  if (/firefox\//i.test(ua)) return "firefox";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "safari";
  return "unknown";
}

function detectOs(ua: string): string {
  if (/windows/i.test(ua)) return "windows";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "unknown";
}

function detectDeviceClass(ua: string): NormalizedClientEnvironment["device_class"] {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|iphone|android/i.test(ua)) return "mobile";
  if (/windows|mac os x|linux/i.test(ua)) return "desktop";
  return "unknown";
}

function isStandalonePwa(): boolean {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      // iOS Safari legacy flag
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

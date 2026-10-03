"use client";

// src/components/nex-native/surface-health/telemetry-client.ts
//
// Fire-and-forget client → server bridge for surface-health events.
// Posts a NORMALIZED payload to /api/nex-native/surface-health. Must
// never fail loudly; must never block render; must never include
// error.message, error.stack, componentStack, or any caller-supplied
// free-text that could carry conversation content.
//
// The server route re-validates the payload shape and routes it
// through src/lib/nex-native/surface-health-service.ts (Item 1).
//
// Doctrine: §7.4 content-safety · §9 reuse studio telemetry pattern,
// but NOT its content shape (studio sends raw error.message · we must
// not).

import type { BoundaryEmission } from "./boundary-shared";

const ENDPOINT = "/api/nex-native/surface-health";

export function emitSurfaceHealthEvent(payload: BoundaryEmission): void {
  if (typeof fetch === "undefined") return; // SSR / non-browser · drop silently
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Silent · telemetry is best-effort by doctrine (§8 · users never
      // see or trigger diagnostics).
    });
  } catch {
    // Even JSON.stringify can throw on circular structures. Never let
    // telemetry failures crash the fallback path.
  }
}

// Studio telemetry — client-side helper.
//
// Fire-and-forget: never blocks the UI, never throws to the caller,
// never renders an error toast. Failures are silent by design —
// telemetry can never break editing. Feeds Live Component Intelligence
// (Module 5), Smart Layout Recommendations (Module 5), and AI Design
// Score trend analysis (Module 15).

import type { LayoutEventKind } from "./schema";

const ENDPOINT = "/api/studio/telemetry";

export type StudioTelemetryEvent = {
  /** Canonical event kind. Non-canonical strings are dropped server-
   *  side (the studio_layout_events CHECK constraint enforces the set
   *  — see Module 0.1). */
  event: LayoutEventKind;
  pageId?: string;
  sectionKey?: string;
  /** Registration id of the specific variant used, e.g.
   *  "hero.plant_hire_bold_1". Powers Live Component Intelligence
   *  slice-by-variant queries. */
  layoutVariant?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
};

export async function sendTelemetry(
  events: StudioTelemetryEvent[]
): Promise<void> {
  if (events.length === 0) return;
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      // `keepalive` lets the request survive the editor tab closing —
      // useful for terminal events like `revert` fired during unload.
      keepalive: true
    });
  } catch {
    // silent
  }
}

/** Convenience for one-event fire — most call sites. */
export function trackEvent(event: StudioTelemetryEvent): void {
  void sendTelemetry([event]);
}

// Guide analytics — dispatches window CustomEvents so any analytics
// pipeline (Plausible, Fathom, GA, PostHog, in-house beacon) can wire
// in without touching the guide internals. Zero-cost when no listener.
//
// Event contract:
//   tn:guide:opened      { featureId?: string }
//   tn:guide:featureView { featureId: string }
//   tn:guide:tourStart   { featureId: string, stepCount: number }
//   tn:guide:closed      { featuresSeen: number }
//
// Consumers subscribe with window.addEventListener("tn:guide:opened", …).

export type GuideEventName =
  | "tn:guide:opened"
  | "tn:guide:featureView"
  | "tn:guide:tourStart"
  | "tn:guide:closed";

export type GuideEventPayload = {
  "tn:guide:opened":      { featureId?: string | null };
  "tn:guide:featureView": { featureId: string };
  "tn:guide:tourStart":   { featureId: string; stepCount: number };
  "tn:guide:closed":      { featuresSeen: number };
};

export function emitGuideEvent<K extends GuideEventName>(
  name: K,
  detail: GuideEventPayload[K]
) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch { /* older browsers — fail silent */ }
}

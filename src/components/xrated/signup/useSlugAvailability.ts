"use client";

// Client hook — debounced availability check against
// /api/signup/slug-check. Returns a stable status that a badge
// component can render (green tick / red X / spinner).
//
// Debounce is 500ms so we don't hammer the endpoint on every keystroke.
// Aborts in-flight requests on new keystrokes to avoid stale-result
// races.

import { useEffect, useState } from "react";

export type SlugRejectionReason =
  | "taken"
  | "invalid"
  | "reserved"
  | "reserved-trade"
  | "reserved-city"
  | "reserved-qualifier"
  | "too-short"
  | "too-long";

export type SlugAvailability =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; reason: SlugRejectionReason };

// User-facing messages per rejection reason. Squatter-block responses
// suggest the fix ("add your business name") rather than just saying no.
export const SLUG_REJECTION_MESSAGE: Record<SlugRejectionReason, string> = {
  taken:                "Already taken — try adding your first name or town.",
  invalid:              "Lowercase letters, numbers and hyphens only.",
  reserved:             "This slug is reserved. Try adding your business name.",
  "reserved-trade":     "That's a trade category, not a business name. Try mikes-kitchens or bright-electric.",
  "reserved-city":      "City names alone aren't allowed. Add your business name first — e.g. mikes-kitchens-manchester.",
  "reserved-qualifier": "Marketing words like best / top / cheap aren't allowed. Use your real business name.",
  "too-short":          "At least 3 characters.",
  "too-long":           "Keep it under 40 characters."
};

export function useSlugAvailability(slug: string): SlugAvailability {
  const [state, setState] = useState<SlugAvailability>({ status: "idle" });

  useEffect(() => {
    const trimmed = slug.trim().toLowerCase();
    if (trimmed.length === 0) {
      setState({ status: "idle" });
      return;
    }

    // Client-side early-out — same rules the endpoint enforces. Saves
    // an obvious-fail round-trip while typing.
    if (trimmed.length < 3) {
      setState({ status: "unavailable", reason: "too-short" });
      return;
    }
    if (trimmed.length > 40) {
      setState({ status: "unavailable", reason: "too-long" });
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
      setState({ status: "unavailable", reason: "invalid" });
      return;
    }

    setState({ status: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/signup/slug-check?slug=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          // On transient failure, don't block the user with a red X
          // they can't act on. Assume-available; the create endpoint
          // handles real collisions at submit-time.
          setState({ status: "available" });
          return;
        }
        const data = await res.json() as { available: boolean; reason?: SlugRejectionReason };
        if (data.available) {
          setState({ status: "available" });
        } else {
          setState({ status: "unavailable", reason: data.reason ?? "taken" });
        }
      } catch (err) {
        // AbortError is expected when the user keeps typing; ignore.
        if ((err as { name?: string }).name === "AbortError") return;
        setState({ status: "available" });
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  return state;
}

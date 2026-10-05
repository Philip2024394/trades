// Pure helpers for ImmersivePreviewShell · extracted so Vitest can
// exercise the state machines without mounting React / jsdom. The
// shell component imports from here; nothing else should.
//
// Phase 2 · founder-approved 2026-10-05 · behind NEX_THEMES_IMMERSIVE_PREVIEW.

export const LOCAL_MESSAGE_LIMIT = 3;

export interface LocalMessage {
  id: string;
  text: string;
  /** All user-sent local messages are mine=true. The two seed bubbles
   *  ("hey!" peer / "love this ✨" mine) live in render code, not here. */
  mine: true;
}

/** Append a message if the limit allows, otherwise return the input
 *  unchanged. Pure · same input always yields same output. */
export function appendLocalMessage(
  messages: LocalMessage[],
  text: string,
): LocalMessage[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return messages;
  if (messages.length >= LOCAL_MESSAGE_LIMIT) return messages;
  return [
    ...messages,
    {
      id: `local-${Date.now()}-${messages.length}`,
      text: trimmed,
      mine: true,
    },
  ];
}

/** True when the composer should accept more input. */
export function canSendLocalMessage(messages: LocalMessage[]): boolean {
  return messages.length < LOCAL_MESSAGE_LIMIT;
}

export interface SwipeDecision {
  direction: "prev" | "next" | "none";
  /** Normalised commit progress (0 → didn't commit, 1 → fully committed).
   *  Useful if the caller wants to animate the cross-fade based on
   *  user intent rather than a fixed curve. */
  progress: number;
}

/** Given a horizontal delta (px) and elapsed time (ms), decide whether
 *  the gesture should commit a prev/next navigation.
 *
 *  Thresholds · founder-approved:
 *    · absolute delta ≥ 48 px, OR
 *    · velocity ≥ 0.5 px/ms AND absolute delta ≥ 24 px
 *
 *  A pure rightward swipe (positive delta) goes to the PREVIOUS theme;
 *  leftward goes to NEXT. This matches the iOS photo-roll convention. */
export function evaluateSwipe(
  deltaX: number,
  elapsedMs: number,
): SwipeDecision {
  const absDelta = Math.abs(deltaX);
  const velocity = elapsedMs > 0 ? absDelta / elapsedMs : 0;
  const meetsDistance = absDelta >= 48;
  const meetsVelocity = velocity >= 0.5 && absDelta >= 24;
  if (!meetsDistance && !meetsVelocity) {
    return { direction: "none", progress: Math.min(1, absDelta / 48) };
  }
  const direction: "prev" | "next" = deltaX > 0 ? "prev" : "next";
  return { direction, progress: 1 };
}

/** Clamp an index to the themes array bounds, wrapping around the ends.
 *  Returns null when the array is empty · caller should bail. */
export function navigateIndex(
  current: number,
  direction: "prev" | "next",
  total: number,
): number | null {
  if (total <= 0) return null;
  if (direction === "prev") {
    return current > 0 ? current - 1 : total - 1;
  }
  return current < total - 1 ? current + 1 : 0;
}

/** Build the next pathname+search for the ?preview=<id> URL state.
 *  Pure function so the caller can use history.pushState / replaceState
 *  consistently. Preserves other query params (banner codes etc). */
export function buildPreviewUrl(
  pathname: string,
  currentSearch: string,
  themeId: string | null,
): string {
  const params = new URLSearchParams(currentSearch);
  if (themeId === null) {
    params.delete("preview");
  } else {
    params.set("preview", themeId);
  }
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

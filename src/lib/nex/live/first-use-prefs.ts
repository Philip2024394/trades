// src/lib/nex/live/first-use-prefs.ts
//
// NEX Music/Video · first-use tutorial local preferences · Phase M
//
// §15 rule: once the user completes the spatial-gesture tutorial, never
// show the full sequence again unless they explicitly ask for it. This
// module owns the small localStorage key that tracks completion, plus a
// tiny "next lesson" cursor so the progressive tutorial (§14) can walk
// through: swipe-down → swipe-left → swipe-right → swipe-up.
//
// Everything is best-effort: if localStorage is unavailable (private
// browsing / storage blocked) reads return the "not yet seen" state so
// the tutorial can still show once for this session · writes silently
// no-op. Never throws.

export const TUTORIAL_STORAGE_KEY = "nex.music.spatial.tutorial.seen";
export const TUTORIAL_STEP_STORAGE_KEY = "nex.music.spatial.tutorial.step";

/** Ordered lessons for the progressive tutorial (§14). Cursor value = next
 *  lesson to teach. When cursor === "done" no lesson renders. */
export const TUTORIAL_LESSONS = ["down", "left", "right", "up", "done"] as const;
export type TutorialLesson = typeof TUTORIAL_LESSONS[number];

// ── Storage guards ─────────────────────────────────────────────

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch { return null; }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch { /* ignore · storage blocked */ }
}

function safeRemove(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch { /* ignore */ }
}

// ── Public API ─────────────────────────────────────────────────

export function hasCompletedTutorial(): boolean {
  return safeGet(TUTORIAL_STORAGE_KEY) === "true";
}

export function markTutorialComplete(): void {
  safeSet(TUTORIAL_STORAGE_KEY, "true");
  safeSet(TUTORIAL_STEP_STORAGE_KEY, "done");
}

export function currentTutorialLesson(): TutorialLesson {
  if (hasCompletedTutorial()) return "done";
  const raw = safeGet(TUTORIAL_STEP_STORAGE_KEY);
  if (raw && (TUTORIAL_LESSONS as ReadonlyArray<string>).includes(raw)) {
    return raw as TutorialLesson;
  }
  return "down"; // Default starting lesson
}

export function advanceTutorialLesson(current: TutorialLesson): TutorialLesson {
  const idx = TUTORIAL_LESSONS.indexOf(current);
  if (idx === -1 || idx >= TUTORIAL_LESSONS.length - 1) {
    markTutorialComplete();
    return "done";
  }
  const next = TUTORIAL_LESSONS[idx + 1];
  safeSet(TUTORIAL_STEP_STORAGE_KEY, next);
  if (next === "done") markTutorialComplete();
  return next;
}

/** Called by the "How does navigation work?" explicit replay affordance
 *  per §15 · resets the cursor + completion flag so the tutorial replays
 *  from the beginning. */
export function replayTutorial(): void {
  safeRemove(TUTORIAL_STORAGE_KEY);
  safeSet(TUTORIAL_STEP_STORAGE_KEY, "down");
}

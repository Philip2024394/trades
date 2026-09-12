// src/lib/nex/live/free-content-intro-policy.ts
//
// NEX LIVE · Phase 3 · Free-user Live intro decision engine
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 3
//
// PURPOSE (§28 · §29 · §30 · §31 · §33 · §34 · §35 · §36)
//   Pure decision function that answers "should NEX show a short Live
//   discovery clip before this free user consumes the free content
//   they asked for?"
//
// GOVERNING RULES · IMMUTABLE
//   1. Paid users NEVER see a free-content intro.
//   2. Free users can always Continue immediately (§31 · never trap).
//   3. Frequency levels · OFF / LOW / MEDIUM / HIGH map to minimum-
//      interval-since-last-intro thresholds. Never more than one intro
//      per user session.
//   4. If no eligible clip is available for this user/city, do NOT show
//      a synthetic clip. Return SUPPRESS with reason no_clip.
//   5. Reduced-motion / accessibility opt-out fully suppresses.
//   6. The intro NEVER auto-advances into paid content. `onContinue`
//      is always what actually happens next.
//
// PURE FUNCTION MODULE.  No I/O.  No React.  No DOM.

export type UserTier = "FREE" | "PAID";
export type IntroFrequency = "OFF" | "LOW" | "MEDIUM" | "HIGH";

export type FreeIntroCandidate = {
  media_id: string;
  entity_name: string;
  city_label: string | null;
  title: string | null;
  playback_url: string | null;
  poster_url: string | null;
  duration_hint_sec: number;
  is_mock_fixture: boolean;
};

export type FreeIntroDecisionInput = {
  user_tier: UserTier;
  intro_frequency: IntroFrequency;
  /** Millisecond timestamp of the last intro shown to this user, or
   *  null if never. Callers persist this outside the module. */
  last_intro_shown_at_ms: number | null;
  now_ms: number;
  /** Reduced-motion preference honored per §36 accessibility rule. */
  reduced_motion: boolean;
  /** Whether an intro already ran in the current session · §33 rule 3. */
  intro_shown_this_session: boolean;
  /** Available candidate clips for this user/city · caller supplies them. */
  candidates: ReadonlyArray<FreeIntroCandidate>;
};

export type FreeIntroSuppressReason =
  | "user_is_paid"
  | "frequency_off"
  | "already_shown_this_session"
  | "reduced_motion"
  | "min_interval_not_elapsed"
  | "no_clip"
  | "candidate_missing_playback";

export type FreeIntroDecision =
  | { action: "SHOW"; clip: FreeIntroCandidate; reason: "eligible" }
  | { action: "SUPPRESS"; reason: FreeIntroSuppressReason };

/** Minimum interval (ms) between two intros for the same user per §34. */
export const INTRO_MIN_INTERVAL_MS: Record<IntroFrequency, number> = {
  OFF:    Number.POSITIVE_INFINITY,   // never
  LOW:    24 * 60 * 60 * 1000,        // one per day
  MEDIUM: 3 * 60 * 60 * 1000,         // one per 3 hours
  HIGH:   30 * 60 * 1000,             // one per 30 minutes
};

export function decideFreeIntro(input: FreeIntroDecisionInput): FreeIntroDecision {
  // Rule 1 · paid users never see the free-content intro
  if (input.user_tier === "PAID") {
    return { action: "SUPPRESS", reason: "user_is_paid" };
  }

  // Rule 3a · frequency OFF is a hard opt-out
  if (input.intro_frequency === "OFF") {
    return { action: "SUPPRESS", reason: "frequency_off" };
  }

  // Rule 5 · reduced-motion is a hard opt-out (§36)
  if (input.reduced_motion) {
    return { action: "SUPPRESS", reason: "reduced_motion" };
  }

  // Rule 3c · one intro per session · hard cap
  if (input.intro_shown_this_session) {
    return { action: "SUPPRESS", reason: "already_shown_this_session" };
  }

  // Rule 3b · minimum interval since last intro
  const minInterval = INTRO_MIN_INTERVAL_MS[input.intro_frequency];
  if (input.last_intro_shown_at_ms !== null) {
    const elapsed = input.now_ms - input.last_intro_shown_at_ms;
    if (elapsed < minInterval) {
      return { action: "SUPPRESS", reason: "min_interval_not_elapsed" };
    }
  }

  // Rule 4 · no eligible clip → never fabricate
  if (input.candidates.length === 0) {
    return { action: "SUPPRESS", reason: "no_clip" };
  }

  // Pick the first candidate that has a real playback URL. We do NOT
  // rank by relevance here — that lives in the discovery layer that
  // built the candidate list.
  const clip = input.candidates.find((c) => c.playback_url !== null && c.playback_url.length > 0) ?? null;
  if (clip === null) {
    return { action: "SUPPRESS", reason: "candidate_missing_playback" };
  }

  return { action: "SHOW", clip, reason: "eligible" };
}

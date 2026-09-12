// src/lib/nex/live/media-lifecycle-v2.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Extended lifecycle for report/takedown
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §8 · §9
//
// EXTENDS Phase A lifecycle.ts. Does NOT replace it.
//   · Phase A models: DRAFT → UPLOADING → PROCESSING → READY → PUBLISHED
//     → LIVE → ENDED → ARCHIVED (+ UPLOAD_FAILED / PROCESSING_FAILED /
//     BLOCKED / REMOVED).
//   · This module adds the REPORT / REVIEW / TAKEDOWN sub-states that
//     apply AFTER publication:
//        ACTIVE → REPORTED → UNDER_REVIEW → RESTRICTED / REMOVED
//        REPORTED → KEEP (back to ACTIVE)
//        REMOVED / RESTRICTED → RESTORED (after successful appeal)
//        anything → DISPUTED
//
// §8 immutable · NEX must never silently delete history. Every
// transition records who + when + why · reversal is possible where
// authorized.

// ── Discovery-visibility state ─────────────────────────────────────
// Whether the media is currently surface-able to end-users. Derived
// from the current lifecycle state · never trusted from a single flag.

export type MediaVisibilityState =
  | "ACTIVE"          // published + no restriction
  | "REPORTED"        // one or more reports filed · still active pending review
  | "UNDER_REVIEW"    // moderator/founder has picked it up
  | "RESTRICTED"      // limited visibility (e.g. muted, no discovery feed)
  | "REMOVED"         // fully removed from surfaces · audit history preserved
  | "DISPUTED"        // decision issued but uploader is disputing
  | "RESTORED";       // was removed/restricted, appeal succeeded, back to active

// Every allowed transition. Anything not listed is REJECTED (assertion
// throws with descriptive reason).
const V2_TRANSITIONS: Record<MediaVisibilityState, ReadonlyArray<MediaVisibilityState>> = {
  ACTIVE:        ["REPORTED", "REMOVED"],                                    // moderator may go straight to REMOVED for CSAM etc.
  REPORTED:      ["UNDER_REVIEW", "ACTIVE"],                                 // moderator picks up, or auto-clears if bogus report
  UNDER_REVIEW:  ["ACTIVE", "RESTRICTED", "REMOVED", "DISPUTED"],
  RESTRICTED:    ["REMOVED", "RESTORED", "DISPUTED"],
  REMOVED:       ["RESTORED", "DISPUTED"],                                   // never terminal — restoration possible
  DISPUTED:      ["UNDER_REVIEW", "RESTORED", "REMOVED"],
  RESTORED:      ["ACTIVE"],                                                 // restoration finalises back to active
};

export function canV2Transition(from: MediaVisibilityState, to: MediaVisibilityState): boolean {
  const allowed = V2_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertV2Transition(from: MediaVisibilityState, to: MediaVisibilityState): void {
  if (!canV2Transition(from, to)) {
    throw new Error(`nex-live:invalid_visibility_transition:${from}->${to}`);
  }
}

// ── Discovery-eligibility predicate ────────────────────────────────
// The single function discovery endpoints and swipe feeds ask before
// returning a media item to the caller. §9: RESTRICTED and REMOVED
// must not appear in normal customer feeds.

export function isDiscoverableV2(state: MediaVisibilityState): boolean {
  // ACTIVE + REPORTED remain discoverable — a report alone does not hide
  // content (§8 spirit: NEX must never silently disappear content
  // merely because someone reported it). UNDER_REVIEW is a judgment
  // call — we keep it visible until a decision is made, but downstream
  // UIs may choose to render a "review pending" pill.
  return state === "ACTIVE" || state === "REPORTED" || state === "UNDER_REVIEW"
      || state === "DISPUTED" || state === "RESTORED";
}

/** Whether the actual media bytes should be served. §9: REMOVED
 *  content must NOT be served, even by direct link. */
export function shouldServeMediaBytes(state: MediaVisibilityState): boolean {
  return state !== "REMOVED";
}

/** Whether the visibility state permits monetization / promotion. Any
 *  reported/reviewed/restricted state suspends monetization even if
 *  publish remains allowed. */
export function permitsMonetization(state: MediaVisibilityState): boolean {
  return state === "ACTIVE" || state === "RESTORED";
}

// ── Default state for freshly published media ─────────────────────

export function defaultV2State(): MediaVisibilityState {
  return "ACTIVE";
}

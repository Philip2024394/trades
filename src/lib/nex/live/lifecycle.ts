// src/lib/nex/live/lifecycle.ts
//
// NEX LIVE · Phase A · Universal Media/Content Lifecycle State Machine
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A
//
// PURPOSE (§8)
//   The universal content lifecycle every Live/Uploaded/Recorded artefact
//   passes through — regardless of vertical (music · film · restaurant ·
//   seller · artist · venue · creator · people · movie).
//
// DISCIPLINE (§8 · §26)
//   Failures must be EXPLICIT. NEX must never tell the user something is
//   live/uploaded/published unless the system has independently verified
//   that transition.
//
// SCOPE (Phase A)
//   Zero UI · zero API · zero DB · zero adapter implementation. This is a
//   pure state contract with a transition validator that downstream
//   phases (B upload · C edit · D storage · E entity model) will consume.

export type LiveContentState =
  // Happy path
  | "DRAFT"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "PUBLISHED"
  | "LIVE"
  | "ENDED"
  | "ARCHIVED"
  // Failure/moderation paths — MUST remain explicit (§8)
  | "UPLOAD_FAILED"
  | "PROCESSING_FAILED"
  | "BLOCKED"
  | "REMOVED";

// Every allowed transition. Anything not listed is REJECTED.
// Read as: from → set of valid next states.
const TRANSITIONS: Record<LiveContentState, ReadonlyArray<LiveContentState>> = {
  DRAFT:              ["UPLOADING", "REMOVED"],
  UPLOADING:          ["PROCESSING", "UPLOAD_FAILED", "REMOVED"],
  UPLOAD_FAILED:      ["UPLOADING", "REMOVED"],
  PROCESSING:         ["READY", "PROCESSING_FAILED", "REMOVED"],
  PROCESSING_FAILED:  ["PROCESSING", "REMOVED"],
  READY:              ["PUBLISHED", "REMOVED", "BLOCKED"],
  PUBLISHED:          ["LIVE", "ENDED", "ARCHIVED", "REMOVED", "BLOCKED"],
  LIVE:               ["ENDED", "REMOVED", "BLOCKED"],
  ENDED:              ["ARCHIVED", "REMOVED"],
  ARCHIVED:           ["REMOVED"],
  BLOCKED:            ["REMOVED", "READY"],   // moderator may reinstate
  REMOVED:            [],                     // terminal
};

export function canTransition(from: LiveContentState, to: LiveContentState): boolean {
  const allowed = TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/** Throws a descriptive error when the transition is not allowed. Used
 *  by future upload/publish/broadcast pipelines so the discipline is
 *  enforced at every seam, not just recommended. */
export function assertTransition(from: LiveContentState, to: LiveContentState): void {
  if (!canTransition(from, to)) {
    throw new Error(`nex-live:invalid_lifecycle_transition:${from}->${to}`);
  }
}

/** Returns the terminal states — the ones NEX must never transition out
 *  of automatically. Used by cleanup jobs to avoid resurrecting REMOVED
 *  content. */
export function isTerminal(state: LiveContentState): boolean {
  return state === "REMOVED";
}

/** Returns true if the state is visible to a discovery surface. Draft /
 *  uploading / processing / failed states MUST NOT surface in NEX Live
 *  discovery (§8 · §26). */
export function isDiscoverable(state: LiveContentState): boolean {
  return state === "PUBLISHED" || state === "LIVE" || state === "ENDED";
}

/** Returns true if the state permits the "LIVE NOW" presentation. Only
 *  LIVE qualifies at the state layer — freshness enforcement happens in
 *  types.ts::derivePresentationState. */
export function permitsLiveNowPresentation(state: LiveContentState): boolean {
  return state === "LIVE";
}

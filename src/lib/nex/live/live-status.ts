// src/lib/nex/live/live-status.ts
//
// NEX LIVE · Master Experience · Live-status derivation
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// PURPOSE (§25 · §37 · §41 · §42)
//   Pure derivation of customer-facing Live discovery state:
//     LIVE_NOW · STARTING_SOON · TONIGHT · UPCOMING · ENDED · UNKNOWN
//   from timing + Phase A LiveContentState + Phase 1 MediaVisibilityState.
//
//   §42 immutable · a Live must not remain "LIVE NOW" forever · we use
//   heartbeat freshness + explicit end_time to demote stale sessions.
//   §41 immutable · use existing lifecycle contracts · do not invent.
//
// PURE FUNCTION MODULE.  No I/O.  No React.  No DOM.

import type { LiveContentState } from "./lifecycle";
import type { MediaVisibilityState } from "./media-lifecycle-v2";

export type LiveDiscoveryStatus =
  | "LIVE_NOW"           // status=LIVE + freshness ok + not past end_time
  | "STARTING_SOON"      // scheduled start within 60 minutes
  | "TONIGHT"            // scheduled start within current-city evening window (18:00-23:59 local)
  | "UPCOMING"           // scheduled beyond TONIGHT window
  | "ENDED"              // status=ENDED/ARCHIVED OR past end_time
  | "STALE"              // status=LIVE but heartbeat > staleness threshold
  | "UNKNOWN";           // insufficient signal · never rendered as LIVE_NOW

export type StatusInput = {
  content_state: LiveContentState;
  visibility_state: MediaVisibilityState;
  /** Optional Live-session timing. When null the item is treated as
   *  non-Live media (regular published video/audio). */
  started_at_iso: string | null;
  end_at_iso: string | null;
  /** Last known heartbeat for the Live session (§42 freshness). Null
   *  means we've never seen a heartbeat — status defaults conservative. */
  last_heartbeat_iso: string | null;
  /** Freshness threshold in ms · defaults 2 minutes. */
  freshness_ttl_ms?: number;
  now_iso: string;
};

const DEFAULT_FRESHNESS_TTL_MS = 2 * 60 * 1000;
const STARTING_SOON_WINDOW_MS = 60 * 60 * 1000;
const TONIGHT_START_HOUR = 18;
const TONIGHT_END_HOUR = 24;

export function deriveLiveDiscoveryStatus(input: StatusInput): LiveDiscoveryStatus {
  const now = Date.parse(input.now_iso);
  if (Number.isNaN(now)) return "UNKNOWN";

  // Removed / restricted / draft states never surface as Live discovery
  if (input.visibility_state === "REMOVED"
      || input.visibility_state === "RESTRICTED") {
    return "ENDED";   // caller filters at discovery layer · this is safe fallback
  }

  // Lifecycle-terminal states short-circuit
  if (input.content_state === "ENDED" || input.content_state === "ARCHIVED"
      || input.content_state === "REMOVED" || input.content_state === "BLOCKED") {
    return "ENDED";
  }

  // Non-Live content (no timing) is not part of the LIVE_NOW / STARTING_SOON
  // discovery axis — caller treats it as regular published media.
  if (input.started_at_iso === null) return "UNKNOWN";

  const startedAt = Date.parse(input.started_at_iso);
  if (Number.isNaN(startedAt)) return "UNKNOWN";

  const endAt = input.end_at_iso ? Date.parse(input.end_at_iso) : null;
  if (endAt !== null && !Number.isNaN(endAt) && now > endAt) return "ENDED";

  // Currently live?
  if (input.content_state === "LIVE" && now >= startedAt) {
    // §42 freshness check
    const ttl = input.freshness_ttl_ms ?? DEFAULT_FRESHNESS_TTL_MS;
    if (input.last_heartbeat_iso) {
      const hb = Date.parse(input.last_heartbeat_iso);
      if (!Number.isNaN(hb) && now - hb <= ttl) return "LIVE_NOW";
      return "STALE";
    }
    // No heartbeat but state says LIVE and we're past start_at · very
    // conservative: STALE (not LIVE_NOW). Callers may treat as LIVE_NOW
    // when they have out-of-band confirmation.
    return "STALE";
  }

  // Scheduled (state PUBLISHED · start in the future)
  const untilStartMs = startedAt - now;
  if (untilStartMs > 0) {
    if (untilStartMs <= STARTING_SOON_WINDOW_MS) return "STARTING_SOON";
    // Tonight: within today's evening window in the viewer's local time.
    // (Location-aware tonight would need the entity/viewer city timezone;
    // here we use the viewer's local browser time via new Date on the
    // now_iso, which the caller passes as a real ISO string.)
    const nowDate = new Date(now);
    const startDate = new Date(startedAt);
    const sameDay = nowDate.toDateString() === startDate.toDateString();
    if (sameDay && startDate.getHours() >= TONIGHT_START_HOUR && startDate.getHours() < TONIGHT_END_HOUR) {
      return "TONIGHT";
    }
    return "UPCOMING";
  }

  return "UNKNOWN";
}

/** Discovery-feed eligibility · used by the /api/nex-live/tonight
 *  endpoint to gate items. Never returns true for REMOVED / RESTRICTED
 *  (already filtered upstream but defense-in-depth). */
export function isDiscoveryVisibleStatus(status: LiveDiscoveryStatus): boolean {
  return status === "LIVE_NOW"
      || status === "STARTING_SOON"
      || status === "TONIGHT"
      || status === "UPCOMING";
}

/** Sort weight for discovery ordering · LIVE_NOW first, then STARTING_SOON,
 *  then TONIGHT, then UPCOMING. Ties broken by started_at ascending. */
export function discoveryOrderWeight(status: LiveDiscoveryStatus): number {
  switch (status) {
    case "LIVE_NOW":       return 0;
    case "STARTING_SOON":  return 1;
    case "TONIGHT":        return 2;
    case "UPCOMING":       return 3;
    default:               return 99;
  }
}

/** Human-facing label per §26 calm visual language. Never invents. */
export function labelForStatus(status: LiveDiscoveryStatus): string {
  switch (status) {
    case "LIVE_NOW":       return "LIVE";
    case "STARTING_SOON":  return "Starting soon";
    case "TONIGHT":        return "Tonight";
    case "UPCOMING":       return "Upcoming";
    case "STALE":          return "Signal lost";
    case "ENDED":          return "Ended";
    case "UNKNOWN":        return "";
  }
}

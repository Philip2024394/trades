// src/lib/nex/live/types.ts
//
// NEX LIVE · Phase A · Universal Live Entity Contract (aggregate)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A
//
// PURPOSE (§18 · §15 · §26)
//   The universal LiveEntity every vertical shares. Vertical-specific
//   attributes attach as optional facets · the core contract stays
//   universal so NEX Live remains vertical-independent (§15) and no
//   surface can silently claim LIVE when the underlying state doesn't
//   support that claim (§26).
//
// AGGREGATES
//   · LiveContentState  from ./lifecycle
//   · RightsDeclaration from ./rights
//   · LiveCapabilitySnapshot from ./capability
//   · MediaRef          from ./media-adapter/types
//
// SCOPE (Phase A)
//   Types + two guard functions (isLiveRightNow, derivePresentationState).
//   No adapter implementations. No API. No UI. No DB.

import type { LiveContentState } from "./lifecycle";
import type { RightsDeclaration } from "./rights";
import type { LiveCapabilitySnapshot } from "./capability";
import type { MediaRef } from "./media-adapter/types";

export type { MediaRef } from "./media-adapter/types";

// ── Vertical taxonomy · superset of WorldVertical ───────────────────

export type LiveVertical =
  | "live_music"
  | "live_artist"
  | "live_venue"
  | "live_restaurant"
  | "live_food"
  | "live_seller"
  | "live_commerce"
  | "live_movie"
  | "live_film"
  | "live_creator"
  | "live_people"
  | "live_place"
  | "live_transport"
  | "live_accommodation"
  | "live_event"
  | "live_generic";

// ── Content kind · independent of vertical ─────────────────────────

export type LiveContentKind =
  | "recorded_video"
  | "recorded_audio"
  | "livestream_video"
  | "livestream_audio"
  | "uploaded_video"
  | "uploaded_audio"
  | "movie"
  | "short_film";

// ── Identifier aliases · permissive at Phase A ─────────────────────

export type LiveId = string;         // "live:<uuid>" · shape confirmed Phase E
export type NexId = string;
export type EntityRefId = string;
export type CityId = string;

// ── Location primitive · matches existing free-text city pattern ────

export type LiveLocation = {
  city: CityId;
  country?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
};

// ── Privacy contract (§15) ─────────────────────────────────────────

export type LivePrivacy =
  | "public"
  | "connections"
  | "private"
  | "unlisted";

export type LiveInteractionPolicy = {
  can_be_messaged: boolean;
  can_be_interested: boolean;
  can_be_booked: boolean;
  location_visible: boolean;
};

// ── Freshness — critical honesty layer for LIVE claims ─────────────

export type LiveFreshness =
  | "FRESH"
  | "STALE"
  | "ENDED"
  | "UNKNOWN";

// ── The universal LiveEntity ────────────────────────────────────────

export type LiveEntity = {
  live_id: LiveId;
  entity_ref_id: EntityRefId | null;
  owner_nex_id: NexId;
  vertical: LiveVertical;
  content_kind: LiveContentKind;

  title: string | null;
  description: string | null;

  location: LiveLocation | null;
  start_time_iso: string | null;
  end_time_iso: string | null;

  status: LiveContentState;
  freshness: LiveFreshness;

  thumbnail_media_ref: MediaRef | null;
  media_ref: MediaRef | null;

  privacy: LivePrivacy;
  interaction_policy: LiveInteractionPolicy;

  capability: LiveCapabilitySnapshot;
  rights: RightsDeclaration;

  created_at_iso: string;
  published_at_iso: string | null;
};

// ── Guards · the honesty enforcement layer ─────────────────────────
// Discipline: no surface may render an entity as LIVE unless BOTH state
// and freshness agree. Weakening this rule is a §26 violation.

export function isLiveRightNow(entity: Pick<LiveEntity, "status" | "freshness">): boolean {
  return entity.status === "LIVE" && entity.freshness === "FRESH";
}

// ── Presentation state · routes every entity to an honest UI state ─
// Downstream renderers read THIS, not `status` directly, so a
// LIVE-status entity with STALE freshness can never appear as "LIVE
// NOW".

export type LivePresentationState =
  | "LIVE_NOW"           // status=LIVE + freshness=FRESH
  | "STARTING_SOON"      // status=PUBLISHED + start_time within 60min
  | "ENDED"              // status=ENDED/ARCHIVED OR freshness=ENDED
  | "STALE_UNKNOWN"      // status=LIVE but freshness != FRESH → honest boundary
  | "DRAFT_NOT_VISIBLE"  // pre-PUBLISHED lifecycle states
  | "HIDDEN";            // BLOCKED / REMOVED

export function derivePresentationState(
  entity: Pick<LiveEntity, "status" | "freshness" | "start_time_iso">,
  nowIso: string,
): LivePresentationState {
  if (entity.status === "BLOCKED" || entity.status === "REMOVED") return "HIDDEN";

  const preVisible: LiveContentState[] = [
    "DRAFT", "UPLOADING", "PROCESSING", "READY",
    "UPLOAD_FAILED", "PROCESSING_FAILED",
  ];
  if (preVisible.includes(entity.status)) return "DRAFT_NOT_VISIBLE";

  if (entity.status === "ENDED" || entity.status === "ARCHIVED"
      || entity.freshness === "ENDED") return "ENDED";

  if (entity.status === "LIVE" && entity.freshness === "FRESH") return "LIVE_NOW";
  if (entity.status === "LIVE" && entity.freshness !== "FRESH") return "STALE_UNKNOWN";

  if (entity.status === "PUBLISHED" && entity.start_time_iso) {
    const nowMs = Date.parse(nowIso);
    const startMs = Date.parse(entity.start_time_iso);
    if (!Number.isNaN(nowMs) && !Number.isNaN(startMs)
        && startMs > nowMs && (startMs - nowMs) <= 60 * 60 * 1000) {
      return "STARTING_SOON";
    }
  }
  return "DRAFT_NOT_VISIBLE";
}

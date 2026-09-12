// src/lib/nex/live/capability.ts
//
// NEX LIVE · Phase A · Live Capability Contract
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A
//
// PURPOSE (§21 · §26)
//   Every action offered from a Live surface (chat · book · order · buy ·
//   visit · contact · watch) must be gated by verified evidence — not by
//   Live presence alone. A restaurant being LIVE does NOT mean the
//   restaurant is bookable. An artist being LIVE does NOT mean the
//   artist is bookable Friday.
//
// COMPOSITION
//   Reuses the existing:
//     · CapabilityState + CapabilityKind (capability-display-intelligence.ts)
//     · ContactabilityState + interest_send_enabled (interest/contactability.ts)
//   and re-projects them into Live-facing action kinds so the same
//   discipline flows through Live surfaces.
//
// SCOPE (Phase A)
//   Pure contract + derivation function. Zero UI. Zero API. Zero
//   fabrication path. Downstream Live surfaces (Phase G, H, I, J, K)
//   consume the resulting snapshot.

import type { CapabilityKind, CapabilityState } from "../brain/capability-display-intelligence";
import type { ContactabilityAssessment, ContactabilityState } from "../brain/interest/contactability";

// ── Live-facing action kinds ────────────────────────────────────────
// Each maps to (a) a CapabilityKind from the existing registry when
// applicable, or (b) an evidence-source that must be independently
// verified.

export type LiveCapabilityKind =
  | "WATCH"           // is this Live actually watchable right now?
  | "CHAT"            // can the user chat with the entity?
  | "BOOK_ARTIST"     // is the artist bookable?
  | "ORDER_DISH"      // can the user order from a restaurant Live?
  | "BUY_PRODUCT"     // can the user buy a seller Live's product?
  | "RESERVE_TABLE"   // can the user reserve at a venue?
  | "VISIT_VENUE"     // does the venue publish an address the user can visit?
  | "SHOW_MENU"       // is there a verified menu to display?
  | "SHOW_LOCATION";  // is the location verified?

// ── State (mirrors existing CapabilityState + adds STALE) ───────────
// Adding STALE explicitly is critical for a Live surface: a Live that
// declared BOOK_ARTIST an hour ago may no longer be true.

export type LiveCapabilityState =
  | "VERIFIED"
  | "UNKNOWN"
  | "UNAVAILABLE"
  | "STALE";

export type LiveCapabilityFacet = {
  kind: LiveCapabilityKind;
  state: LiveCapabilityState;
  /** Machine-readable reason so downstream UIs can render honest text
   *  rather than pretending unavailable = unknown. Never rendered
   *  verbatim to end-users. */
  reason: string;
  /** ISO timestamp of the assessment. Older assessments should be
   *  refreshed by callers; STALE is preferred over silently returning a
   *  6-hour-old VERIFIED. */
  assessed_at_iso: string;
};

/** The complete capability snapshot for a Live entity. Downstream UIs
 *  read facets by kind rather than making up their own truth. */
export type LiveCapabilitySnapshot = {
  facets: ReadonlyArray<LiveCapabilityFacet>;
  assessed_at_iso: string;
};

// ── Mapping helpers ─────────────────────────────────────────────────

/** Project the existing CapabilityState into the Live capability state.
 *  Live adds STALE on top of the base 3 states so callers can degrade
 *  gracefully. */
export function projectCapabilityState(
  base: CapabilityState,
  isStale: boolean,
): LiveCapabilityState {
  if (isStale && base === "VERIFIED") return "STALE";
  return base;
}

/** Derive a WATCH capability facet from a Live status + freshness pair.
 *  Kept in this module (not types.ts) so freshness-driven capability
 *  degradation lives with the capability contract. */
export function deriveWatchFacet(input: {
  isDiscoverable: boolean;
  isFresh: boolean;
  isEnded: boolean;
  nowIso: string;
}): LiveCapabilityFacet {
  if (input.isEnded) {
    return { kind: "WATCH", state: "UNAVAILABLE", reason: "live_ended", assessed_at_iso: input.nowIso };
  }
  if (input.isDiscoverable && input.isFresh) {
    return { kind: "WATCH", state: "VERIFIED", reason: "live_now_fresh", assessed_at_iso: input.nowIso };
  }
  if (input.isDiscoverable && !input.isFresh) {
    return { kind: "WATCH", state: "STALE", reason: "no_recent_heartbeat", assessed_at_iso: input.nowIso };
  }
  return { kind: "WATCH", state: "UNKNOWN", reason: "not_discoverable", assessed_at_iso: input.nowIso };
}

/** Derive a CHAT capability facet from the existing contactability
 *  assessment. Chat is only VERIFIED when contactability is
 *  VERIFIED_CONTACT AND interest_send_enabled is true. Anything else
 *  MUST NOT surface a "Chat" button. */
export function deriveChatFacet(input: {
  assessment: ContactabilityAssessment | null;
  nowIso: string;
}): LiveCapabilityFacet {
  const a = input.assessment;
  if (!a) return { kind: "CHAT", state: "UNKNOWN", reason: "no_contactability_assessment", assessed_at_iso: input.nowIso };
  const staleStates: ContactabilityState[] = ["STALE_CONTACT"];
  if (staleStates.includes(a.state)) {
    return { kind: "CHAT", state: "STALE", reason: `contactability:${a.state}`, assessed_at_iso: input.nowIso };
  }
  if (a.state === "VERIFIED_CONTACT" && a.interest_send_enabled === true) {
    return { kind: "CHAT", state: "VERIFIED", reason: "verified_contact_channel", assessed_at_iso: input.nowIso };
  }
  if (a.state === "NO_VERIFIED_CONTACT") {
    return { kind: "CHAT", state: "UNAVAILABLE", reason: "no_verified_contact_channel", assessed_at_iso: input.nowIso };
  }
  return { kind: "CHAT", state: "UNKNOWN", reason: `contactability:${a.state}`, assessed_at_iso: input.nowIso };
}

/** Derive a general-purpose capability facet from the existing
 *  CAPABILITY_REGISTRY lookup for a given vertical. Never invents; if
 *  the registry says UNKNOWN we return UNKNOWN. */
export function deriveRegistryFacet(input: {
  kind: LiveCapabilityKind;
  registryState: CapabilityState | undefined;
  isStale: boolean;
  nowIso: string;
}): LiveCapabilityFacet {
  const base: CapabilityState = input.registryState ?? "UNKNOWN";
  return {
    kind: input.kind,
    state: projectCapabilityState(base, input.isStale),
    reason: `registry:${base}${input.isStale ? ":stale" : ""}`,
    assessed_at_iso: input.nowIso,
  };
}

/** The single question downstream Live surfaces ask: "can I present this
 *  action right now?" — mirrors canInterestFireSend from the Interest
 *  slice. Any weakening of this rule is a §26 violation. */
export function canPresentCapability(facet: LiveCapabilityFacet): boolean {
  return facet.state === "VERIFIED";
}

// ── Kind → CapabilityKind bridge for existing registry lookup ───────
// So a Live "BOOK_ARTIST" question maps to the existing capability-
// display registry's "BOOKING" state per vertical, without duplicating
// the registry.

export function toExistingCapabilityKind(k: LiveCapabilityKind): CapabilityKind | null {
  switch (k) {
    case "BOOK_ARTIST":
    case "RESERVE_TABLE": return "BOOKING";
    case "ORDER_DISH":
    case "BUY_PRODUCT":   return "PURCHASE";
    case "CHAT":          return "CONTACT";
    case "SHOW_MENU":     return "GENERIC";
    case "VISIT_VENUE":
    case "SHOW_LOCATION":
    case "WATCH":         return null;   // no existing registry entry — evidence-driven only
    default:              return null;
  }
}

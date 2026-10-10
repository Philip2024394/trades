// src/lib/nex-native/emergency/types.ts
//
// NEX Emergency Help · shared type contract (F4 ⇄ F5).
//
// This file is the single source of truth both the data layer (F4) and
// the UI layer (F5) implement against. It carries NO runtime behaviour
// beyond the sealed enum arrays — just typed shapes.
//
// Doctrine:
//   · Every incident row carries `simulated: boolean`. In v1 PILOT the
//     service layer rejects writes with `simulated = false`.
//   · The three recipient layers are ordered: `trusted_contact` (user
//     pre-selected) → `nearby_opted_in` (opted-in responders within
//     radius) → `wider_community` (DISABLED in v1 by feature flag).
//   · Location is captured ONCE at incident creation. `distance_meters`
//     on a recipient row is derived ONCE at resolve-time and NEVER
//     updated live.

// Sealed lifecycle (migration 193 + widening in migration 195):
//   draft → pending_confirmation → active → responders_assigned → resolved
// Alternative terminals: cancelled · revoked_within_window · expired.
// Ordering below is deliberate · do not reorder without updating the
// doctrine in docs/doctrine/nex-emergency-pending-confirmation-2026-10-10.md.
export const INCIDENT_STATES = [
  "draft",
  "pending_confirmation",
  "active",
  "responders_assigned",
  "resolved",
  "cancelled",
  "revoked_within_window",
  "expired",
] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

export function isIncidentState(s: string): s is IncidentState {
  return (INCIDENT_STATES as readonly string[]).includes(s);
}

export const INCIDENT_CATEGORIES = [
  "general_assistance",
  "medical_concern",
  "safety_concern",
  "other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export function isIncidentCategory(s: string): s is IncidentCategory {
  return (INCIDENT_CATEGORIES as readonly string[]).includes(s);
}

export const RECIPIENT_LAYERS = [
  "trusted_contact",
  "nearby_opted_in",
  "wider_community",
] as const;
export type RecipientLayer = (typeof RECIPIENT_LAYERS)[number];

export function isRecipientLayer(s: string): s is RecipientLayer {
  return (RECIPIENT_LAYERS as readonly string[]).includes(s);
}

export const RESPONSE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export function isResponseStatus(s: string): s is ResponseStatus {
  return (RESPONSE_STATUSES as readonly string[]).includes(s);
}

export interface EmergencyIncident {
  readonly incidentId: string;
  readonly requesterAccountId: string;
  readonly state: IncidentState;
  readonly category: IncidentCategory;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly locationAccuracyMeters: number | null;
  readonly locationCapturedAt: string | null;
  /** v1 PILOT · ALWAYS TRUE. Service layer rejects simulated=false. */
  readonly simulated: boolean;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly resolvedAt: string | null;
  readonly cancelledAt: string | null;
  /** Set when pending_confirmation → active fires (migration 195). */
  readonly pendingConfirmedAt: string | null;
  /** Set when pending_confirmation → revoked_within_window fires
   *  (migration 195). Distinct from cancelledAt. */
  readonly revokedWithinWindowAt: string | null;
  readonly expiresAt: string;
}

export interface IncidentRecipient {
  readonly recipientId: string;
  readonly incidentId: string;
  readonly recipientAccountId: string;
  readonly layer: RecipientLayer;
  /** Derived ONCE at resolve-time. NEVER updated live. May be null for
   *  trusted contacts where distance is irrelevant. */
  readonly distanceMeters: number | null;
  readonly notifiedAt: string;
  readonly responseStatus: ResponseStatus;
  readonly respondedAt: string | null;
  /** Declared by the responder on accept. 1–480 minutes. */
  readonly etaMinutes: number | null;
}

export interface EmergencyResponderOptIn {
  readonly accountId: string;
  readonly optedInAt: string;
  readonly acknowledgedSafetyGuidanceAt: string;
  readonly radiusKm: number;
  /** v1 PILOT · always TRUE. */
  readonly simulated: boolean;
}

export interface TrustedContactRow {
  readonly ownerAccountId: string;
  readonly contactAccountId: string;
  readonly addedAt: string;
  readonly contactLabel: string | null;
}

// =====================================================================
// Action-shaped result envelopes used by server actions.
// Keeps F5's UI typed without pulling in service internals.
// =====================================================================

export type EmergencyActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: EmergencyActionReason };

export const EMERGENCY_ACTION_REASONS = [
  "not_authenticated",
  "db_unavailable",
  "feature_disabled",
  "not_found",
  "not_authorized",
  "invalid_state_transition",
  "rate_limited",
  "invalid_input",
  "simulated_only",
  "safety_guidance_stale",
  "wider_community_disabled",
  "incident_not_updatable",
] as const;
export type EmergencyActionReason = (typeof EMERGENCY_ACTION_REASONS)[number];

// =====================================================================
// Live location (H3 · migration 194)
// =====================================================================

export const LOCATION_UPDATE_SOURCES = [
  "browser_watch_position",
  "manual_pin",
  "service_worker_sync",
] as const;
export type LocationUpdateSource = (typeof LOCATION_UPDATE_SOURCES)[number];

/** Honest shape of a single live-location ping persisted to
 *  `nex.emergency_location_update`. Append-only · never updated after
 *  insert · see docs/doctrine/nex-emergency-live-location-2026-10-10.md
 *  for the full lifecycle. */
export interface LocationUpdate {
  readonly updateId: string;
  readonly incidentId: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyMeters: number | null;
  readonly headingDegrees: number | null;
  readonly speedMps: number | null;
  readonly source: LocationUpdateSource;
  /** v1 PILOT · always TRUE. */
  readonly simulated: boolean;
  readonly capturedAt: string;
  readonly receivedAt: string;
}

/** Public shape returned by `recipient-resolver`. The service layer
 *  turns `layer1` + `layer2` into `incident_recipient` rows; `layer3`
 *  is a signalling flag only in v1 because the wider-community layer
 *  is feature-flag-disabled. */
export interface ResolvedRecipients {
  readonly layer1: readonly string[];
  readonly layer2: readonly string[];
  readonly layer3Available: boolean;
}

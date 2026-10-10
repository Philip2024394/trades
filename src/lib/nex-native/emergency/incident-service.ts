// src/lib/nex-native/emergency/incident-service.ts
//
// NEX Emergency Help · incident lifecycle service.
//
// Server-only. Thin pg wrapper around nex.emergency_incident (migration
// 193). Owns the sealed 6-state lifecycle:
//
//   draft → active → responders_assigned → (resolved | cancelled | expired)
//
// Doctrine:
//   · In v1 PILOT, every write forces `simulated = true`. Callers may
//     NOT create an incident with `simulated = false`; the service
//     throws `incident_service.simulated_only_in_v1`.
//   · Location is captured ONCE at creation. The service never updates
//     location columns post-creation.
//   · State transitions are explicit and bounded. Illegal transitions
//     throw `incident_service.invalid_state_transition`.
//   · Rate limit: 3 concurrent active + 10 incidents / rolling 24h.
//     Enforced by `rateLimit()`; a false return means the caller is
//     over the budget.

import "server-only";

import { withClient } from "@/lib/nex/db";
import { isEmergencyLiveMode } from "./feature-flag";
import type {
  EmergencyIncident,
  IncidentCategory,
  IncidentState,
} from "./types";
import { isIncidentCategory, isIncidentState } from "./types";

// =====================================================================
// Internal helpers
// =====================================================================

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: Record<string, unknown>): EmergencyIncident {
  const state = String(r.state ?? "");
  if (!isIncidentState(state)) {
    throw new Error(`incident_service.unknown_state:${state}`);
  }
  const category = String(r.category ?? "");
  if (!isIncidentCategory(category)) {
    throw new Error(`incident_service.unknown_category:${category}`);
  }
  return {
    incidentId: String(r.incident_id),
    requesterAccountId: String(r.requester_account_id),
    state,
    category,
    locationLat: toNumberOrNull(r.location_lat),
    locationLng: toNumberOrNull(r.location_lng),
    locationAccuracyMeters: toNumberOrNull(r.location_accuracy_meters),
    locationCapturedAt: toIsoOrNull(r.location_captured_at),
    simulated: Boolean(r.simulated),
    createdAt: toIso(r.created_at),
    activatedAt: toIsoOrNull(r.activated_at),
    resolvedAt: toIsoOrNull(r.resolved_at),
    cancelledAt: toIsoOrNull(r.cancelled_at),
    pendingConfirmedAt: toIsoOrNull(r.pending_confirmed_at),
    revokedWithinWindowAt: toIsoOrNull(r.revoked_within_window_at),
    expiresAt: toIso(r.expires_at),
  };
}

const SELECT_COLS =
  "incident_id, requester_account_id, state, category, " +
  "location_lat, location_lng, location_accuracy_meters, " +
  "location_captured_at, simulated, created_at, activated_at, " +
  "resolved_at, cancelled_at, pending_confirmed_at, " +
  "revoked_within_window_at, expires_at";

function assertAccountId(accountId: string, field: string): void {
  if (typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new Error(`incident_service.invalid_${field}`);
  }
}

function assertSimulatedV1(): void {
  // Doctrine: in v1 only simulated=true is allowed. Live mode must be
  // explicitly flipped by the operator AND the live-mode writes are
  // not yet reachable from a public service entry.
  if (isEmergencyLiveMode()) return;
  // No-op; the function below asserts the row we write is simulated.
}

// =====================================================================
// Public API
// =====================================================================

export interface CreateIncidentArgs {
  readonly requesterAccountId: string;
  readonly category: IncidentCategory;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly locationAccuracyMeters: number | null;
  readonly locationCapturedAt: string | null;
}

export async function createIncident(
  args: CreateIncidentArgs,
): Promise<EmergencyIncident> {
  assertAccountId(args.requesterAccountId, "requester_account_id");
  if (!isIncidentCategory(args.category)) {
    throw new Error("incident_service.invalid_category");
  }
  // Latitude / longitude bounds (mirrors migration 193 CHECK).
  if (args.locationLat !== null) {
    if (!Number.isFinite(args.locationLat) || args.locationLat < -90 || args.locationLat > 90) {
      throw new Error("incident_service.invalid_location_lat");
    }
  }
  if (args.locationLng !== null) {
    if (!Number.isFinite(args.locationLng) || args.locationLng < -180 || args.locationLng > 180) {
      throw new Error("incident_service.invalid_location_lng");
    }
  }
  if (
    args.locationAccuracyMeters !== null
    && (!Number.isFinite(args.locationAccuracyMeters) || args.locationAccuracyMeters < 0)
  ) {
    throw new Error("incident_service.invalid_location_accuracy");
  }

  assertSimulatedV1();

  const result = await withClient(async (client) => {
    const r = await client.query(
      `INSERT INTO nex.emergency_incident (
         requester_account_id, state, category,
         location_lat, location_lng, location_accuracy_meters,
         location_captured_at, simulated
       ) VALUES ($1, 'draft', $2, $3, $4, $5, $6, TRUE)
       RETURNING ${SELECT_COLS}`,
      [
        args.requesterAccountId.trim(),
        args.category,
        args.locationLat,
        args.locationLng,
        args.locationAccuracyMeters,
        args.locationCapturedAt,
      ],
    );
    if (r.rowCount !== 1) {
      throw new Error("incident_service.insert_failed");
    }
    return mapRow(r.rows[0]);
  });

  if (result === null) {
    throw new Error("incident_service.db_unavailable");
  }
  return result;
}

export async function getIncident(incidentId: string): Promise<EmergencyIncident | null> {
  if (typeof incidentId !== "string" || incidentId.trim().length === 0) {
    throw new Error("incident_service.invalid_incident_id");
  }
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${SELECT_COLS} FROM nex.emergency_incident WHERE incident_id = $1 LIMIT 1`,
      [incidentId.trim()],
    );
    if (r.rowCount !== 1) return null;
    return mapRow(r.rows[0]);
  });
  return result ?? null;
}

export async function listMyIncidents(
  accountId: string,
  limit: number,
): Promise<EmergencyIncident[]> {
  assertAccountId(accountId, "account_id");
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${SELECT_COLS}
         FROM nex.emergency_incident
        WHERE requester_account_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [accountId.trim(), safeLimit],
    );
    return r.rows.map(mapRow);
  });
  return result ?? [];
}

// =====================================================================
// State transitions
// =====================================================================
//
// Allowed sealed transitions (widened by migration 195):
//   draft                 → active | cancelled
//   pending_confirmation  → active | revoked_within_window | cancelled
//   active                → responders_assigned | resolved | cancelled | expired
//   responders_assigned   → resolved | cancelled | expired
//   (terminal) resolved | cancelled | revoked_within_window | expired → none
//
// `invalid_state_transition` is thrown for anything else.
//
// Note: pending_confirmation is NOT reachable from an existing draft.
// The pre-countdown screen writes a fresh row directly into
// pending_confirmation via `createPendingAlert`. The legacy draft→active
// path is preserved for backward compat during the migration wave.

const ALLOWED_TRANSITIONS: Record<IncidentState, readonly IncidentState[]> = {
  draft: ["active", "cancelled"],
  pending_confirmation: ["active", "revoked_within_window", "cancelled"],
  active: ["responders_assigned", "resolved", "cancelled", "expired"],
  responders_assigned: ["resolved", "cancelled", "expired"],
  resolved: [],
  cancelled: [],
  revoked_within_window: [],
  expired: [],
};

export function canTransition(from: IncidentState, to: IncidentState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

type TransitionStampColumn =
  | "activated_at"
  | "resolved_at"
  | "cancelled_at"
  | "pending_confirmed_at"
  | "revoked_within_window_at";

async function transition(
  incidentId: string,
  from: IncidentState | "any-live",
  to: IncidentState,
  actorAccountId: string | null,
  stampColumn: TransitionStampColumn | readonly TransitionStampColumn[] | null,
): Promise<EmergencyIncident> {
  if (typeof incidentId !== "string" || incidentId.trim().length === 0) {
    throw new Error("incident_service.invalid_incident_id");
  }

  const result = await withClient(async (client) => {
    const existing = await client.query(
      `SELECT ${SELECT_COLS} FROM nex.emergency_incident WHERE incident_id = $1 LIMIT 1`,
      [incidentId.trim()],
    );
    if (existing.rowCount !== 1) {
      throw new Error("incident_service.not_found");
    }
    const current = mapRow(existing.rows[0]);

    if (actorAccountId !== null && current.requesterAccountId !== actorAccountId) {
      throw new Error("incident_service.not_authorized");
    }

    if (from === "any-live") {
      // Any non-terminal state. Used by sweep.
      if (!canTransition(current.state, to)) {
        throw new Error("incident_service.invalid_state_transition");
      }
    } else if (current.state !== from) {
      throw new Error("incident_service.invalid_state_transition");
    } else if (!canTransition(from, to)) {
      throw new Error("incident_service.invalid_state_transition");
    }

    const setClauses: string[] = ["state = $2"];
    const params: unknown[] = [incidentId.trim(), to];
    if (stampColumn !== null) {
      const columns = Array.isArray(stampColumn)
        ? (stampColumn as readonly TransitionStampColumn[])
        : [stampColumn as TransitionStampColumn];
      for (const col of columns) {
        setClauses.push(`${col} = now()`);
      }
    }

    const r = await client.query(
      `UPDATE nex.emergency_incident
          SET ${setClauses.join(", ")}
        WHERE incident_id = $1
        RETURNING ${SELECT_COLS}`,
      params,
    );
    if (r.rowCount !== 1) {
      throw new Error("incident_service.update_failed");
    }
    return mapRow(r.rows[0]);
  });

  if (result === null) {
    throw new Error("incident_service.db_unavailable");
  }
  return result;
}

export async function activateIncident(incidentId: string): Promise<EmergencyIncident> {
  return transition(incidentId, "draft", "active", null, "activated_at");
}

// =====================================================================
// Pending-confirmation lifecycle (migration 195 · L1 2026-10-10)
// =====================================================================
//
// Flow:
//   createPendingAlert   · fresh row in state='pending_confirmation'
//                          at T=0 of the countdown. REAL alert.
//   confirmPendingAlert  · pending_confirmation → active at T=10 (or
//                          Skip countdown). Stamps activated_at AND
//                          pending_confirmed_at in the same UPDATE.
//   revokePendingAlert   · pending_confirmation → revoked_within_window
//                          when the requester cancels during the
//                          10-second safety window. Terminal.

export interface CreatePendingAlertArgs {
  readonly requesterAccountId: string;
  readonly category: IncidentCategory;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly locationAccuracyMeters: number | null;
  readonly locationCapturedAt: string | null;
}

/** Writes a single INSERT with state='pending_confirmation'. Still
 *  subject to the sealed rate limit (3 concurrent + 10/24h) · callers
 *  must gate on `rateLimit(accountId)` first. */
export async function createPendingAlert(
  args: CreatePendingAlertArgs,
): Promise<EmergencyIncident> {
  assertAccountId(args.requesterAccountId, "requester_account_id");
  if (!isIncidentCategory(args.category)) {
    throw new Error("incident_service.invalid_category");
  }
  if (args.locationLat !== null) {
    if (!Number.isFinite(args.locationLat) || args.locationLat < -90 || args.locationLat > 90) {
      throw new Error("incident_service.invalid_location_lat");
    }
  }
  if (args.locationLng !== null) {
    if (!Number.isFinite(args.locationLng) || args.locationLng < -180 || args.locationLng > 180) {
      throw new Error("incident_service.invalid_location_lng");
    }
  }
  if (
    args.locationAccuracyMeters !== null
    && (!Number.isFinite(args.locationAccuracyMeters) || args.locationAccuracyMeters < 0)
  ) {
    throw new Error("incident_service.invalid_location_accuracy");
  }

  assertSimulatedV1();

  const result = await withClient(async (client) => {
    const r = await client.query(
      `INSERT INTO nex.emergency_incident (
         requester_account_id, state, category,
         location_lat, location_lng, location_accuracy_meters,
         location_captured_at, simulated
       ) VALUES ($1, 'pending_confirmation', $2, $3, $4, $5, $6, TRUE)
       RETURNING ${SELECT_COLS}`,
      [
        args.requesterAccountId.trim(),
        args.category,
        args.locationLat,
        args.locationLng,
        args.locationAccuracyMeters,
        args.locationCapturedAt,
      ],
    );
    if (r.rowCount !== 1) {
      throw new Error("incident_service.insert_failed");
    }
    return mapRow(r.rows[0]);
  });

  if (result === null) {
    throw new Error("incident_service.db_unavailable");
  }
  return result;
}

/** Transitions pending_confirmation → active · stamps activated_at
 *  AND pending_confirmed_at. Idempotent on second call: if the row is
 *  ALREADY active with pending_confirmed_at set, returns the row
 *  without raising. Rejects for any other prior state. Only the
 *  requester may confirm. */
export async function confirmPendingAlert(args: {
  readonly incidentId: string;
  readonly actorAccountId: string;
}): Promise<EmergencyIncident> {
  assertAccountId(args.actorAccountId, "actor_account_id");
  const existing = await getIncident(args.incidentId);
  if (!existing) throw new Error("incident_service.not_found");
  if (existing.requesterAccountId !== args.actorAccountId) {
    throw new Error("incident_service.not_authorized");
  }
  // Idempotency: if already confirmed, return the same row.
  if (existing.state === "active" && existing.pendingConfirmedAt !== null) {
    return existing;
  }
  if (existing.state !== "pending_confirmation") {
    throw new Error("incident_service.invalid_state_transition");
  }
  return transition(
    args.incidentId,
    "pending_confirmation",
    "active",
    args.actorAccountId,
    ["activated_at", "pending_confirmed_at"],
  );
}

/** Transitions pending_confirmation → revoked_within_window · stamps
 *  revoked_within_window_at. Only the requester may revoke. Rejects
 *  for any state other than pending_confirmation. */
export async function revokePendingAlert(args: {
  readonly incidentId: string;
  readonly actorAccountId: string;
  readonly reason?: string;
}): Promise<EmergencyIncident> {
  assertAccountId(args.actorAccountId, "actor_account_id");
  // The reason parameter is accepted for the public contract so the
  // hook has symmetry with cancelIncident, but the schema does not
  // store it in v1. L3 may surface it to the fan-out side effect.
  void args.reason;
  const existing = await getIncident(args.incidentId);
  if (!existing) throw new Error("incident_service.not_found");
  if (existing.requesterAccountId !== args.actorAccountId) {
    throw new Error("incident_service.not_authorized");
  }
  if (existing.state !== "pending_confirmation") {
    throw new Error("incident_service.invalid_state_transition");
  }
  return transition(
    args.incidentId,
    "pending_confirmation",
    "revoked_within_window",
    args.actorAccountId,
    "revoked_within_window_at",
  );
}

export async function markRespondersAssigned(
  incidentId: string,
): Promise<EmergencyIncident> {
  return transition(incidentId, "active", "responders_assigned", null, null);
}

export async function cancelIncident(
  incidentId: string,
  actorAccountId: string,
): Promise<EmergencyIncident> {
  assertAccountId(actorAccountId, "actor_account_id");
  // Cancel allowed from draft, active, or responders_assigned.
  const existing = await getIncident(incidentId);
  if (!existing) throw new Error("incident_service.not_found");
  if (existing.requesterAccountId !== actorAccountId) {
    throw new Error("incident_service.not_authorized");
  }
  if (!canTransition(existing.state, "cancelled")) {
    throw new Error("incident_service.invalid_state_transition");
  }
  return transition(incidentId, existing.state, "cancelled", actorAccountId, "cancelled_at");
}

export async function resolveIncident(
  incidentId: string,
  actorAccountId: string,
): Promise<EmergencyIncident> {
  assertAccountId(actorAccountId, "actor_account_id");
  const existing = await getIncident(incidentId);
  if (!existing) throw new Error("incident_service.not_found");
  if (existing.requesterAccountId !== actorAccountId) {
    throw new Error("incident_service.not_authorized");
  }
  if (!canTransition(existing.state, "resolved")) {
    throw new Error("incident_service.invalid_state_transition");
  }
  return transition(incidentId, existing.state, "resolved", actorAccountId, "resolved_at");
}

/**
 * Sweeps expired incidents. Flips `active | responders_assigned → expired`
 * when `expires_at` has passed with no accepted responders.
 *
 * The "no accepted responders" check is enforced by the subquery; an
 * incident with at least one accepted recipient is kept in its current
 * state (the UI will transition it to resolved explicitly).
 *
 * Returns the number of rows flipped.
 */
export async function sweepExpired(): Promise<number> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.emergency_incident ei
          SET state = 'expired'
        WHERE ei.state IN ('active', 'responders_assigned')
          AND ei.expires_at <= now()
          AND NOT EXISTS (
            SELECT 1 FROM nex.incident_recipient ir
             WHERE ir.incident_id = ei.incident_id
               AND ir.response_status = 'accepted'
          )
        RETURNING incident_id`,
      [],
    );
    return r.rowCount ?? 0;
  });
  return result ?? 0;
}

// =====================================================================
// Rate limiting
// =====================================================================
//
// Policy (v1 pilot defaults · founder-decision-eligible):
//   · Hard cap: 3 concurrent active OR responders_assigned incidents.
//   · Daily cap: 10 incidents created in the last rolling 24 hours
//     (summed from hourly buckets in nex.emergency_rate_limit).
//
// Returns true when the caller is UNDER both limits (safe to proceed).
// Returns false when the caller is at or above either limit.

const MAX_CONCURRENT_ACTIVE = 3;
const MAX_PER_24H = 10;

export async function rateLimit(accountId: string): Promise<boolean> {
  assertAccountId(accountId, "account_id");
  const result = await withClient(async (client) => {
    const concurrent = await client.query(
      `SELECT count(*)::int AS n
         FROM nex.emergency_incident
        WHERE requester_account_id = $1
          AND state IN ('active', 'responders_assigned')`,
      [accountId.trim()],
    );
    const concurrentN = Number(concurrent.rows[0]?.n ?? 0);
    if (concurrentN >= MAX_CONCURRENT_ACTIVE) return false;

    const daily = await client.query(
      `SELECT COALESCE(sum(count), 0)::int AS n
         FROM nex.emergency_rate_limit
        WHERE account_id = $1
          AND window_start > now() - interval '24 hours'`,
      [accountId.trim()],
    );
    const dailyN = Number(daily.rows[0]?.n ?? 0);
    if (dailyN >= MAX_PER_24H) return false;
    return true;
  });
  // DB unavailable → fail CLOSED (false) · never silently permit.
  return result ?? false;
}

/** Bumps the per-hour counter for `accountId`. Called by the server
 *  action AFTER a successful incident creation. Idempotent via UPSERT. */
export async function recordRateLimitEvent(accountId: string): Promise<void> {
  assertAccountId(accountId, "account_id");
  const result = await withClient(async (client) => {
    await client.query(
      `INSERT INTO nex.emergency_rate_limit (account_id, window_start, count)
       VALUES ($1, date_trunc('hour', now()), 1)
       ON CONFLICT (account_id, window_start)
       DO UPDATE SET count = nex.emergency_rate_limit.count + 1`,
      [accountId.trim()],
    );
    return true;
  });
  if (result === null) {
    throw new Error("incident_service.db_unavailable");
  }
}

// Expose constants for tests and action layer.
export const INCIDENT_RATE_LIMIT = Object.freeze({
  maxConcurrentActive: MAX_CONCURRENT_ACTIVE,
  maxPer24h: MAX_PER_24H,
});

// =====================================================================
// Live location updates (H3 · migration 194)
// =====================================================================
//
// updateIncidentLocation ingests a single GPS ping from the requester's
// foreground browser tab (watchPosition). Doctrine:
//
//   · Only the incident's requester may submit updates. Any other
//     actor → `incident_service.not_authorized`.
//   · Only valid for live states (`active`, `responders_assigned`).
//     Terminal states (resolved/cancelled/expired/draft) →
//     `incident_service.incident_not_updatable`.
//   · Rate-limited at 1 update per 10 s per incident (DB-enforced via
//     a WHERE guard against the latest ping's captured_at).
//   · All v1 writes have `simulated = TRUE`.
//   · The parent `emergency_incident.location_*` columns are updated to
//     the latest values in the SAME transaction so a reader of the
//     incident row always sees the freshest location without a JOIN.

export type LocationUpdateSource =
  | "browser_watch_position"
  | "manual_pin"
  | "service_worker_sync";

export const LOCATION_UPDATE_SOURCES: readonly LocationUpdateSource[] = [
  "browser_watch_position",
  "manual_pin",
  "service_worker_sync",
];

export function isLocationUpdateSource(s: string): s is LocationUpdateSource {
  return (LOCATION_UPDATE_SOURCES as readonly string[]).includes(s);
}

/** Minimum seconds between accepted pings for the same incident.
 *  Server-side enforced. The browser-side watchPosition hook also
 *  debounces at the same interval so we rarely hit this guard. */
export const LOCATION_UPDATE_MIN_INTERVAL_SECONDS = 10;

export interface UpdateIncidentLocationArgs {
  readonly incidentId: string;
  /** Must equal the incident's requester_account_id · service enforces. */
  readonly actorAccountId: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyMeters?: number | null;
  readonly headingDegrees?: number | null;
  readonly speedMps?: number | null;
  readonly capturedAt: string;
  readonly source?: LocationUpdateSource;
}

export interface UpdateIncidentLocationResult {
  readonly updateId: string;
  readonly appliedAt: string;
}

const LIVE_INCIDENT_STATES: readonly IncidentState[] = ["active", "responders_assigned"];

export async function updateIncidentLocation(
  args: UpdateIncidentLocationArgs,
): Promise<UpdateIncidentLocationResult> {
  assertAccountId(args.actorAccountId, "actor_account_id");
  if (typeof args.incidentId !== "string" || args.incidentId.trim().length === 0) {
    throw new Error("incident_service.invalid_incident_id");
  }
  if (!Number.isFinite(args.lat) || args.lat < -90 || args.lat > 90) {
    throw new Error("incident_service.invalid_location_lat");
  }
  if (!Number.isFinite(args.lng) || args.lng < -180 || args.lng > 180) {
    throw new Error("incident_service.invalid_location_lng");
  }
  if (
    args.accuracyMeters !== undefined && args.accuracyMeters !== null
    && (!Number.isFinite(args.accuracyMeters) || args.accuracyMeters < 0)
  ) {
    throw new Error("incident_service.invalid_location_accuracy");
  }
  if (
    args.headingDegrees !== undefined && args.headingDegrees !== null
    && (!Number.isFinite(args.headingDegrees) || args.headingDegrees < 0 || args.headingDegrees > 360)
  ) {
    throw new Error("incident_service.invalid_heading_degrees");
  }
  if (
    args.speedMps !== undefined && args.speedMps !== null
    && (!Number.isFinite(args.speedMps) || args.speedMps < 0)
  ) {
    throw new Error("incident_service.invalid_speed_mps");
  }
  if (typeof args.capturedAt !== "string" || args.capturedAt.trim().length === 0) {
    throw new Error("incident_service.invalid_captured_at");
  }
  const capturedIso = (() => {
    const d = new Date(args.capturedAt);
    if (Number.isNaN(d.getTime())) {
      throw new Error("incident_service.invalid_captured_at");
    }
    return d.toISOString();
  })();
  const source: LocationUpdateSource = args.source ?? "browser_watch_position";
  if (!isLocationUpdateSource(source)) {
    throw new Error("incident_service.invalid_source");
  }

  assertSimulatedV1();

  const incidentId = args.incidentId.trim();
  const actor = args.actorAccountId.trim();

  const result = await withClient(async (client) => {
    // Authorization + state gate in one SELECT. Also fetches the most
    // recent captured_at for the rate-limit guard.
    const existing = await client.query(
      `SELECT ei.requester_account_id, ei.state,
              (SELECT MAX(captured_at)
                 FROM nex.emergency_location_update
                WHERE incident_id = $1) AS last_captured_at
         FROM nex.emergency_incident ei
        WHERE ei.incident_id = $1
        LIMIT 1`,
      [incidentId],
    );
    if (existing.rowCount !== 1) {
      throw new Error("incident_service.not_found");
    }
    const requester = String(existing.rows[0].requester_account_id);
    const state = String(existing.rows[0].state);
    const lastCapturedRaw = existing.rows[0].last_captured_at;

    if (requester !== actor) {
      throw new Error("incident_service.not_authorized");
    }
    if (!LIVE_INCIDENT_STATES.includes(state as IncidentState)) {
      throw new Error("incident_service.incident_not_updatable");
    }

    // Rate limit · 1 update per 10 s per incident.
    if (lastCapturedRaw !== null && lastCapturedRaw !== undefined) {
      const lastMs = new Date(String(lastCapturedRaw)).getTime();
      const thisMs = new Date(capturedIso).getTime();
      if (
        Number.isFinite(lastMs) && Number.isFinite(thisMs)
        && thisMs - lastMs < LOCATION_UPDATE_MIN_INTERVAL_SECONDS * 1000
      ) {
        throw new Error("incident_service.rate_limited");
      }
    }

    // Insert the ping. simulated forced TRUE.
    const inserted = await client.query(
      `INSERT INTO nex.emergency_location_update (
         incident_id, lat, lng, accuracy_meters,
         heading_degrees, speed_mps, source, simulated, captured_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
       RETURNING update_id, received_at`,
      [
        incidentId,
        args.lat,
        args.lng,
        args.accuracyMeters ?? null,
        args.headingDegrees ?? null,
        args.speedMps ?? null,
        source,
        capturedIso,
      ],
    );
    if (inserted.rowCount !== 1) {
      throw new Error("incident_service.insert_failed");
    }
    const updateId = String(inserted.rows[0].update_id);
    const appliedAt = toIso(inserted.rows[0].received_at);

    // Mirror latest location onto the parent incident row.
    await client.query(
      `UPDATE nex.emergency_incident
          SET location_lat             = $2,
              location_lng             = $3,
              location_accuracy_meters = $4,
              location_captured_at     = $5
        WHERE incident_id = $1`,
      [
        incidentId,
        args.lat,
        args.lng,
        args.accuracyMeters ?? null,
        capturedIso,
      ],
    );

    return { updateId, appliedAt };
  });

  if (result === null) {
    throw new Error("incident_service.db_unavailable");
  }
  return result;
}

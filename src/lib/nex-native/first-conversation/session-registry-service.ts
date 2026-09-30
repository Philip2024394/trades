// src/lib/nex-native/first-conversation/session-registry-service.ts
//
// Bridge 99 · Stage 4b · nex_session_registry service layer.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7 Cookie contract · Founder-sealed 2026-09-30 · doctrine baseline 6566ace3.
//
// DB layer for the session registry created by Migration 102 Part E. Writes
// go through the service-role Supabase client (nexSupabaseAdmin) because
// the table has RLS enabled with zero authenticated-role policies — clients
// never touch it directly.
//
// Sealed §7 lifetime contract:
//
//   · 30 days ROLLING · a session's expires_at is extended by up to 30 days
//     when the session is used within the last 7 days before expiry
//   · 90 days ABSOLUTE cap · expires_at is never allowed to exceed
//     issued_at + 90 days
//
// The two-tier scheme means:
//   · An idle user's session expires cleanly at 30 days.
//   · An active user gets rolling extension but is force-re-signed-in at
//     90 days regardless. This bounds long-term credential exposure.
//
// Naming discipline:
//   · This service exposes an ms-epoch interface (issued_at_ms, expires_at_ms,
//     etc.) that matches the crypto layer and the eventual cookie payload.
//   · Internally, timestamptz values from Postgres are converted at the DB
//     seam. Never mix representations within a code path.
//
// Delivery boundaries this service enforces:
//   · Session-specific revocation (never account-wide). Revoking session A
//     for account X does NOT affect session B for account X.
//   · Cookie re-presentation is NOT activity per sealed §7B — this service
//     exposes touchSessionLastSeen for observability but that call MUST NOT
//     roll expiry. The last_seen_at column is decoupled from the abandonment
//     timer (which lives on nex_account, updated by messages/claims only).
//   · Absolute cap invariant: rollSessionIfNearExpiry never writes an
//     expires_at beyond issued_at + 90d.
//
// What this service does NOT do (belongs to Stage 4c/4d):
//   · Cookie set/get/clear via next/headers.
//   · Signing/verifying tokens (that is Stage 4a's session-crypto).
//   · Resolving Supabase-vs-provisional session union.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { generateSessionId } from "./session-crypto";

// ---------------------------------------------------------------------------
// Sealed §7 lifetime constants
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Rolling window · fresh session expiry = now + this value. */
export const NEX_SESSION_ROLLING_MS = 30 * MS_PER_DAY;

/** Absolute cap · expires_at can never exceed issued_at + this value. */
export const NEX_SESSION_ABSOLUTE_MS = 90 * MS_PER_DAY;

/**
 * Refresh window · if remaining time before expiry is less than this,
 * a call to rollSessionIfNearExpiry will extend expires_at by up to
 * one rolling period (capped by absolute cap).
 */
export const NEX_SESSION_REFRESH_WINDOW_MS = 7 * MS_PER_DAY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Allowed values for nex_session_registry.revoked_reason. */
export type NexSessionRevokeReason =
  | "user_reset_cover_continuity"
  | "admin_revoke"
  | "signing_key_rotated"
  | "account_deleted"
  | "expired_cleanup";

/** Full session row (all timestamps as ms epoch at this seam). */
export interface NexSessionRegistryRow {
  session_id: string;
  account_id: string;
  issued_at_ms: number;
  expires_at_ms: number;
  last_seen_at_ms: number;
  revoked_at_ms: number | null;
  revoked_reason: NexSessionRevokeReason | null;
}

export interface CreateSessionInput {
  account_id: string;
  /** Injectable for tests. Defaults to Date.now(). */
  now_ms?: number;
}

export interface CreateSessionResult {
  session_id: string;
  account_id: string;
  issued_at_ms: number;
  expires_at_ms: number;
}

export type NexSessionValidity =
  | { valid: true; row: NexSessionRegistryRow }
  | {
      valid: false;
      reason: "not_found" | "revoked" | "expired" | "past_absolute_cap";
    };

export interface RollSessionInput {
  session_id: string;
  /** Injectable for tests. Defaults to Date.now(). */
  now_ms?: number;
}

export type RollSessionResult =
  | {
      extended: true;
      previous_expires_at_ms: number;
      new_expires_at_ms: number;
      absolute_cap_ms: number;
    }
  | {
      extended: false;
      reason:
        | "not_found"
        | "revoked"
        | "expired"
        | "past_absolute_cap"
        | "outside_refresh_window"
        | "at_absolute_cap";
      current_expires_at_ms?: number;
      absolute_cap_ms?: number;
    };

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a fresh session row for the given account. Returns the assigned
 * session_id + issued_at_ms + expires_at_ms so the caller can immediately
 * sign a cookie.
 *
 * The DB has DEFAULT gen_random_uuid() on session_id, but we generate it
 * here so we can return it in the same call and the crypto layer stays
 * the sole owner of ID generation.
 */
export async function createSession(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const now = input.now_ms ?? Date.now();
  const issuedIso = new Date(now).toISOString();
  const expiresIso = new Date(now + NEX_SESSION_ROLLING_MS).toISOString();
  const session_id = generateSessionId();

  const { data, error } = await nexSupabaseAdmin
    .from("nex_session_registry")
    .insert({
      session_id,
      account_id: input.account_id,
      issued_at: issuedIso,
      expires_at: expiresIso,
      last_seen_at: issuedIso,
    })
    .select("session_id, account_id, issued_at, expires_at")
    .single();

  if (error || !data) {
    throw new Error(
      `session-registry-service.createSession: ${error?.message ?? "no row returned"}`,
    );
  }

  return {
    session_id: data.session_id,
    account_id: data.account_id,
    issued_at_ms: new Date(data.issued_at).getTime(),
    expires_at_ms: new Date(data.expires_at).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch a session by id · returns null if not found. */
export async function getSessionById(
  session_id: string,
): Promise<NexSessionRegistryRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session_registry")
    .select(
      "session_id, account_id, issued_at, expires_at, last_seen_at, revoked_at, revoked_reason",
    )
    .eq("session_id", session_id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `session-registry-service.getSessionById: ${error.message}`,
    );
  }
  if (!data) return null;
  return rowToDomain(data);
}

/**
 * Full validity check per sealed §7:
 *   valid iff exists AND revoked_at IS NULL AND now < expires_at
 *                       AND now < issued_at + NEX_SESSION_ABSOLUTE_MS
 *
 * The absolute-cap check is defensive: rollSessionIfNearExpiry never
 * writes expires_at past the absolute cap, so past_absolute_cap should
 * only fire if the row was corrupted externally. Included so the
 * invariant is enforced at read time regardless.
 */
export async function checkSessionValidity(
  session_id: string,
  now_ms: number = Date.now(),
): Promise<NexSessionValidity> {
  const row = await getSessionById(session_id);
  if (!row) return { valid: false, reason: "not_found" };
  if (row.revoked_at_ms !== null) return { valid: false, reason: "revoked" };
  if (now_ms >= row.expires_at_ms) return { valid: false, reason: "expired" };
  if (now_ms >= row.issued_at_ms + NEX_SESSION_ABSOLUTE_MS) {
    return { valid: false, reason: "past_absolute_cap" };
  }
  return { valid: true, row };
}

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

/**
 * Revoke a specific session_id. Does NOT affect other sessions for the
 * same account. Idempotent: revoking an already-revoked session is a
 * no-op (does not overwrite the original revoked_at / revoked_reason).
 *
 * Throws if the session does not exist (caller should distinguish "not
 * found" from "already revoked" before invoking).
 */
export async function revokeSession(
  session_id: string,
  reason: NexSessionRevokeReason,
  now_ms: number = Date.now(),
): Promise<void> {
  // Two-step: check existence + already-revoked state first, then
  // conditionally update. Cleaner than relying on count-of-affected-rows
  // from an UPDATE (which the Supabase client returns unreliably across
  // versions when combined with head:true).
  //
  // TOCTOU safety: the UPDATE below is filtered on .is("revoked_at",
  // null), so two concurrent revokes race harmlessly · whichever hits
  // second updates 0 rows and the row keeps the first revocation's
  // reason and timestamp.
  const existing = await getSessionById(session_id);
  if (!existing) {
    throw new Error(
      `session-registry-service.revokeSession: session ${session_id} not found`,
    );
  }
  if (existing.revoked_at_ms !== null) {
    // Already revoked · idempotent no-op.
    return;
  }
  const revokedIso = new Date(now_ms).toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_session_registry")
    .update({
      revoked_at: revokedIso,
      revoked_reason: reason,
    })
    .eq("session_id", session_id)
    .is("revoked_at", null);

  if (error) {
    throw new Error(
      `session-registry-service.revokeSession: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Roll (rolling extension)
// ---------------------------------------------------------------------------

/**
 * Extend expires_at if the session is inside the refresh window and not
 * past the absolute cap. Behaviour:
 *
 *   · If now < expires_at - REFRESH_WINDOW → outside refresh window · no extend.
 *   · If session is revoked/expired/at cap → no extend, return reason.
 *   · Else · new expires_at = min(now + ROLLING_MS, issued_at + ABSOLUTE_MS).
 *
 * The absolute-cap min() guarantees that a rolled expires_at never
 * exceeds the sealed 90-day cap even if the caller passes a now_ms
 * that would normally extend well beyond it.
 *
 * Does NOT update last_seen_at. That is a separate call.
 * Never revokes; never touches other columns.
 */
export async function rollSessionIfNearExpiry(
  input: RollSessionInput,
): Promise<RollSessionResult> {
  const now = input.now_ms ?? Date.now();
  const row = await getSessionById(input.session_id);
  if (!row) return { extended: false, reason: "not_found" };
  if (row.revoked_at_ms !== null) return { extended: false, reason: "revoked" };

  const absoluteCap = row.issued_at_ms + NEX_SESSION_ABSOLUTE_MS;

  if (now >= row.expires_at_ms) {
    return {
      extended: false,
      reason: "expired",
      current_expires_at_ms: row.expires_at_ms,
      absolute_cap_ms: absoluteCap,
    };
  }
  if (now >= absoluteCap) {
    return {
      extended: false,
      reason: "past_absolute_cap",
      current_expires_at_ms: row.expires_at_ms,
      absolute_cap_ms: absoluteCap,
    };
  }
  if (row.expires_at_ms >= absoluteCap) {
    // Already at the cap · no headroom to extend.
    return {
      extended: false,
      reason: "at_absolute_cap",
      current_expires_at_ms: row.expires_at_ms,
      absolute_cap_ms: absoluteCap,
    };
  }
  if (row.expires_at_ms - now > NEX_SESSION_REFRESH_WINDOW_MS) {
    return {
      extended: false,
      reason: "outside_refresh_window",
      current_expires_at_ms: row.expires_at_ms,
      absolute_cap_ms: absoluteCap,
    };
  }

  const proposed = now + NEX_SESSION_ROLLING_MS;
  const newExpires = Math.min(proposed, absoluteCap);

  const { error } = await nexSupabaseAdmin
    .from("nex_session_registry")
    .update({ expires_at: new Date(newExpires).toISOString() })
    .eq("session_id", input.session_id)
    .is("revoked_at", null);

  if (error) {
    throw new Error(
      `session-registry-service.rollSessionIfNearExpiry: ${error.message}`,
    );
  }

  return {
    extended: true,
    previous_expires_at_ms: row.expires_at_ms,
    new_expires_at_ms: newExpires,
    absolute_cap_ms: absoluteCap,
  };
}

// ---------------------------------------------------------------------------
// Touch (observability only · NOT activity)
// ---------------------------------------------------------------------------

/**
 * Update last_seen_at for observability. Does NOT extend expires_at.
 * Does NOT update the visitor's account-level last_activity_at (that
 * lives on nex_account and is only bumped by messages/claims per §7B
 * abandonment rule).
 *
 * Best-effort: never throws. Cookie re-presentation is not a critical
 * path — losing a last_seen_at update is acceptable.
 */
export async function touchSessionLastSeen(
  session_id: string,
  now_ms: number = Date.now(),
): Promise<void> {
  const iso = new Date(now_ms).toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_session_registry")
    .update({ last_seen_at: iso })
    .eq("session_id", session_id)
    .is("revoked_at", null);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `session-registry-service.touchSessionLastSeen soft-fail: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface RawRow {
  session_id: string;
  account_id: string;
  issued_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_reason: NexSessionRevokeReason | null;
}

function rowToDomain(r: RawRow): NexSessionRegistryRow {
  return {
    session_id: r.session_id,
    account_id: r.account_id,
    issued_at_ms: new Date(r.issued_at).getTime(),
    expires_at_ms: new Date(r.expires_at).getTime(),
    last_seen_at_ms: new Date(r.last_seen_at).getTime(),
    revoked_at_ms: r.revoked_at ? new Date(r.revoked_at).getTime() : null,
    revoked_reason: r.revoked_reason,
  };
}

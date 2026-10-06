// src/lib/nex-native/security-service.ts
//
// NEX Phase 1.0 Security data layer (server-only).
// -------------------------------------------------------------------------
// Owns the three Phase 1.0 Security tables created in migration 139:
//
//   · nex_session          · per-session companion to Supabase auth
//   · nex_sign_in_event    · append-only audit log
//   · nex_account.sessions_invalidated_at · "sign out all other"
//
// Every function here operates server-side via `nexSupabaseAdmin`
// (service-role). Owner-scope is enforced by requiring the caller to
// pass the authenticated `accountId` · the API routes resolve the
// session first and feed `session.account.id` in, so no untrusted
// user-controlled id can ever reach these functions.
//
// Doctrine references:
//   · Universal Rule Enforcement discipline sealed 2026-10-05
//   · Phase 1.0 Security brief sealed 2026-10-06

import "server-only";
import { createHash } from "node:crypto";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexTimestamp, NexUuid } from "./types";

// ---------------------------------------------------------------------------
// Row types (mirror migration 139 columns)
// ---------------------------------------------------------------------------

export interface NexSessionRow {
  id: NexUuid;
  account_id: NexUuid;
  supabase_session_key: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  approx_city: string | null;
  approx_country: string | null;
  trusted: boolean;
  created_at: NexTimestamp;
  last_seen_at: NexTimestamp;
  revoked_at: NexTimestamp | null;
}

export type SignInEventType =
  | "password"
  | "webauthn"
  | "magic_link"
  | "remote_sign_out"
  | "password_change"
  | "failure";

export interface NexSignInEventRow {
  id: NexUuid;
  account_id: NexUuid;
  event_type: SignInEventType;
  success: boolean;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  approx_city: string | null;
  approx_country: string | null;
  created_at: NexTimestamp;
}

// ---------------------------------------------------------------------------
// Access-token key derivation
// ---------------------------------------------------------------------------

/** sha256 of a Supabase access token · lowercase hex (64 chars). Stable
 *  per session · rotates on token refresh. Used as the `supabase_session_key`
 *  column throughout. Exported so API routes + tests can derive the same
 *  key from a token when they need to look a session up by it. */
export function sessionKeyFromAccessToken(accessToken: string): string {
  return createHash("sha256").update(accessToken, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/** List every live session for an account, newest-last-seen first.
 *  Includes revoked rows so the UI can show "signed out at X" for a
 *  short grace period · callers that only want live sessions filter
 *  `revoked_at IS NULL`. */
export async function listSessionsForAccount(
  accountId: NexUuid,
): Promise<NexSessionRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select("*")
    .eq("account_id", accountId)
    .order("last_seen_at", { ascending: false });
  if (error) {
    throw new Error(`security-service.listSessionsForAccount: ${error.message}`);
  }
  return (data as NexSessionRow[]) ?? [];
}

/** Fetch a single session for an owner-scope check. Returns null when
 *  the session does not belong to the account. */
export async function getSessionForOwner(
  sessionId: NexUuid,
  ownerAccountId: NexUuid,
): Promise<NexSessionRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select("*")
    .eq("id", sessionId)
    .eq("account_id", ownerAccountId)
    .maybeSingle();
  if (error) {
    throw new Error(`security-service.getSessionForOwner: ${error.message}`);
  }
  return (data as NexSessionRow) ?? null;
}

/** Owner-scoped revoke of ONE session. Returns true when the session
 *  was marked revoked · false when the row did not exist for this
 *  owner. Does NOT bump `sessions_invalidated_at` · see
 *  `revokeAllOtherSessionsForOwner` for the global-invalidation path. */
export async function revokeSessionForOwner(
  sessionId: NexUuid,
  ownerAccountId: NexUuid,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .update({ revoked_at: now })
    .eq("id", sessionId)
    .eq("account_id", ownerAccountId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`security-service.revokeSessionForOwner: ${error.message}`);
  }
  return !!data?.id;
}

/** Owner-scoped toggle of the trusted flag · Phase 1.0 UI ships the
 *  marking · enforcement (e.g. require 2FA on untrusted) is Phase 1.1
 *  scope. Returns true when the row was updated. */
export async function setSessionTrustedForOwner(
  sessionId: NexUuid,
  ownerAccountId: NexUuid,
  trusted: boolean,
): Promise<boolean> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .update({ trusted })
    .eq("id", sessionId)
    .eq("account_id", ownerAccountId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`security-service.setSessionTrustedForOwner: ${error.message}`);
  }
  return !!data?.id;
}

/** "Sign out all other sessions" · marks every nex_session row for this
 *  account (except the current one, if `keepSessionKey` is provided)
 *  as revoked_at = now. The session resolver rejects any session whose
 *  nex_session row is revoked, so other devices are kicked off on
 *  their next protected request.
 *
 *  Does NOT bump `nex_account.sessions_invalidated_at` · that column
 *  is reserved for future "mass invalidation including the current
 *  device" flows (e.g. a dedicated 'sign out everywhere + this device'
 *  button, or a password-change-triggered mass invalidation). Mixing
 *  the two mechanisms would kick out the current session too (because
 *  the current session's JWT iat is older than the bump time) ·
 *  defeating the sealed 'keep me signed in, log everyone else out'
 *  rule. Returns the number of nex_session rows that were revoked. */
export async function revokeAllOtherSessionsForOwner(
  ownerAccountId: NexUuid,
  keepSessionKey?: string | null,
): Promise<{ invalidated_at: string; revoked_count: number }> {
  const now = new Date().toISOString();
  let revokeQuery = nexSupabaseAdmin
    .from("nex_session")
    .update({ revoked_at: now })
    .eq("account_id", ownerAccountId)
    .is("revoked_at", null);
  if (keepSessionKey) {
    revokeQuery = revokeQuery.neq("supabase_session_key", keepSessionKey);
  }
  const { data: revokedRows, error: revokeError } = await revokeQuery.select("id");
  if (revokeError) {
    throw new Error(
      `security-service.revokeAllOtherSessionsForOwner: ${revokeError.message}`,
    );
  }
  return {
    invalidated_at: now,
    revoked_count: revokedRows?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Sign-in event log
// ---------------------------------------------------------------------------

export interface LogSignInEventInput {
  account_id: NexUuid;
  event_type: SignInEventType;
  success: boolean;
  device_label?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  approx_city?: string | null;
  approx_country?: string | null;
}

/** Append-only · writes one row to nex_sign_in_event. Fire-and-forget
 *  callers (e.g. sign-in action) should await this · it's cheap and we
 *  want the audit trail written synchronously with the sign-in. */
export async function logSignInEvent(
  input: LogSignInEventInput,
): Promise<NexSignInEventRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_sign_in_event")
    .insert({
      account_id: input.account_id,
      event_type: input.event_type,
      success: input.success,
      device_label: input.device_label ?? null,
      user_agent: input.user_agent ? input.user_agent.slice(0, 1024) : null,
      ip_address: input.ip_address ?? null,
      approx_city: input.approx_city ?? null,
      approx_country: input.approx_country ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `security-service.logSignInEvent: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexSignInEventRow;
}

/** List the most recent sign-in events for an account, newest first.
 *  Defaults to 30 events · UI "load more" caller passes a higher limit
 *  OR a `beforeIso` cursor. */
export async function listSignInEventsForAccount(
  accountId: NexUuid,
  options?: { limit?: number; beforeIso?: string },
): Promise<NexSignInEventRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 500);
  let q = nexSupabaseAdmin
    .from("nex_sign_in_event")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options?.beforeIso) {
    q = q.lt("created_at", options.beforeIso);
  }
  const { data, error } = await q;
  if (error) {
    throw new Error(
      `security-service.listSignInEventsForAccount: ${error.message}`,
    );
  }
  return (data as NexSignInEventRow[]) ?? [];
}

// ---------------------------------------------------------------------------
// Dashboard aggregates (used by /settings/security landing + Privacy
// Audit Dashboard)
// ---------------------------------------------------------------------------

export interface SecurityHealthSnapshot {
  face_credential_count: number;
  face_credential_latest_iso: string | null;
  active_session_count: number;
  recent_event_count: number;
  password_last_changed_iso: string | null;
  sessions_invalidated_at: string | null;
}

/** One-call snapshot for the Security landing dashboard. All queries
 *  are owner-scoped and ignore RLS (service-role) because the API
 *  route establishes the owner identity first. */
export async function loadSecurityHealthSnapshot(
  accountId: NexUuid,
): Promise<SecurityHealthSnapshot> {
  // Credential count + newest timestamp.
  const credResult = await nexSupabaseAdmin
    .from("nex_webauthn_credential")
    .select("created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  const credRows = (credResult.data ?? []) as { created_at: string }[];

  // Live (non-revoked) session count.
  const sessionResult = await nexSupabaseAdmin
    .from("nex_session")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .is("revoked_at", null);
  const liveSessionCount = sessionResult.count ?? 0;

  // Recent event count (last 30 days window).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const eventResult = await nexSupabaseAdmin
    .from("nex_sign_in_event")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .gte("created_at", since);
  const recentEventCount = eventResult.count ?? 0;

  // Password last-changed · we approximate from the most recent
  // password_change event. Null when the user has never changed their
  // password via NEX (which is the default for every account at
  // Phase 1.0 landing).
  const pwdResult = await nexSupabaseAdmin
    .from("nex_sign_in_event")
    .select("created_at")
    .eq("account_id", accountId)
    .eq("event_type", "password_change")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pwdChangedIso = (pwdResult.data?.created_at as string | undefined) ?? null;

  // Account-level invalidation timestamp.
  const acctResult = await nexSupabaseAdmin
    .from("nex_account")
    .select("sessions_invalidated_at")
    .eq("id", accountId)
    .maybeSingle();
  const invalidatedAt =
    (acctResult.data?.sessions_invalidated_at as string | undefined) ?? null;

  return {
    face_credential_count: credRows.length,
    face_credential_latest_iso: credRows[0]?.created_at ?? null,
    active_session_count: liveSessionCount,
    recent_event_count: recentEventCount,
    password_last_changed_iso: pwdChangedIso,
    sessions_invalidated_at: invalidatedAt,
  };
}

// ---------------------------------------------------------------------------
// Device-label derivation from User-Agent (lightweight · no dep)
// ---------------------------------------------------------------------------

/** Parse a User-Agent string into a short, human-friendly device label
 *  like "Chrome on macOS" or "Safari on iOS". Returns "Unknown device"
 *  when the UA is missing or doesn't match any known pattern. The
 *  output is capped at 80 chars (matches the DB CHECK on device_label). */
export function deriveDeviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = detectBrowser(ua);
  const os = detectOs(ua);
  const label = browser && os ? `${browser} on ${os}` : browser || os || "Unknown device";
  return label.slice(0, 80);
}

function detectBrowser(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return null;
}

function detectOs(ua: string): string | null {
  if (/Windows NT 10/.test(ua)) return "Windows";
  if (/Windows NT 11/.test(ua)) return "Windows";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

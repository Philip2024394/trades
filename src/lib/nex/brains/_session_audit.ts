// src/lib/nex/brains/_session_audit.ts
//
// D1 Turn 2 · Application-level session audit (Philip 2026-07-28)
//
// Writes to hammerex_nex_sessions when a user logs in / out / times out.
// Never blocks the auth flow — audit failures log to console but do
// not fail login/logout for the user.
//
// Purpose: enable incident investigation. "Who approved this?" leads to
// a session row with device, IP, MFA status, time — supporting or
// refuting the disputed claim.

import { brainSupabase } from "./_supabase";

export type LoginAuditInput = {
  user_id: string;                      // hammerex_nex_users.id
  supabase_session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  device_name: string | null;
  mfa_used: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Insert a session audit row on successful login. Returns the session
 * id on success, or null on audit failure (never throws — audit must
 * not block the login).
 */
export async function recordLogin(input: LoginAuditInput): Promise<string | null> {
  const sb = brainSupabase();
  if (!sb) {
    console.warn("[session_audit] recordLogin skipped · Supabase unavailable");
    return null;
  }
  try {
    const { data, error } = await sb
      .from("hammerex_nex_sessions")
      .insert({
        user_id: input.user_id,
        supabase_session_id: input.supabase_session_id,
        ip: input.ip,
        user_agent: input.user_agent,
        device_name: input.device_name,
        mfa_used: input.mfa_used,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();
    if (error) {
      console.error("[session_audit] recordLogin failed:", error.message);
      return null;
    }
    // Also update the user's last_login_at
    await sb
      .from("hammerex_nex_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", input.user_id);
    return (data as { id: string }).id;
  } catch (err) {
    console.error("[session_audit] recordLogin threw:", err);
    return null;
  }
}

/** Mark a session as user-logged-out. Never throws. */
export async function recordLogout(sessionId: string): Promise<void> {
  const sb = brainSupabase();
  if (!sb) return;
  try {
    await sb
      .from("hammerex_nex_sessions")
      .update({ logout_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("logout_at", null)
      .is("revoked_at", null);
  } catch (err) {
    console.error("[session_audit] recordLogout failed:", err);
  }
}

/** Mark a session as admin-revoked. Never throws. */
export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  const sb = brainSupabase();
  if (!sb) return;
  try {
    await sb
      .from("hammerex_nex_sessions")
      .update({
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq("id", sessionId)
      .is("revoked_at", null);
  } catch (err) {
    console.error("[session_audit] revokeSession failed:", err);
  }
}

/**
 * Update last_seen on the currently active session for this user.
 * Best-effort · called from getAuthenticatedUser · never throws.
 * Only updates the most recent open session (heuristic: last row with
 * no logout_at and no revoked_at).
 */
export async function touchLastSeen(userId: string): Promise<void> {
  const sb = brainSupabase();
  if (!sb) return;
  try {
    // Find the most recent open session for this user
    const { data } = await sb
      .from("hammerex_nex_sessions")
      .select("id")
      .eq("user_id", userId)
      .is("logout_at", null)
      .is("revoked_at", null)
      .order("login_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    await sb
      .from("hammerex_nex_sessions")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", (data as { id: string }).id);
  } catch {
    // Silent — this is a hint update, never critical
  }
}

/**
 * Record a privileged-action authorisation to the audit trail.
 * Called from requireMFA when MFA check passes for publish · rollback
 * · edit_identity. Philip 2026-07-28: "record MFA verification time
 * and last privileged action".
 *
 * Writes to hammerex_nex_events (generic audit log) with event_type
 * `privileged_action_authorised.<action>` so incident investigations
 * can query all privileged-action authorisations by actor + time.
 */
export async function recordPrivilegedActionAuthorised(input: {
  user_id: string;
  email: string;
  action: string;
  entity_id: string | null;
}): Promise<void> {
  const sb = brainSupabase();
  if (!sb) return;
  try {
    await sb.from("hammerex_nex_events").insert({
      event_type: `privileged_action_authorised.${input.action}`,
      entity_type: "user_action",
      entity_id: input.entity_id ?? input.user_id,
      actor_id: input.email,
      actor_role: "admin",
      before_json: null,
      after_json: { action: input.action, mfa_verified: true },
      metadata: { user_id: input.user_id, kind: "authorisation_grant" },
    });
  } catch (err) {
    console.error("[session_audit] recordPrivilegedActionAuthorised failed:", err);
  }
}

/**
 * Parse a friendly device name from the User-Agent header. Rough
 * heuristics. Returns a display string like "MacBook · Chrome" or
 * "Windows · Firefox". Not exact — this is for the audit display, not
 * for security decisions.
 */
export function deriveDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const os =
    /Mac OS X/i.test(userAgent) ? "Mac" :
    /Windows/i.test(userAgent)  ? "Windows" :
    /Android/i.test(userAgent)  ? "Android" :
    /iPhone/i.test(userAgent)   ? "iPhone" :
    /iPad/i.test(userAgent)     ? "iPad" :
    /Linux/i.test(userAgent)    ? "Linux" :
    "Unknown OS";
  const browser =
    /Edg\//i.test(userAgent)    ? "Edge" :
    /Chrome\//i.test(userAgent) ? "Chrome" :
    /Firefox\//i.test(userAgent) ? "Firefox" :
    /Safari\//i.test(userAgent) ? "Safari" :
    "Unknown browser";
  return `${os} · ${browser}`;
}

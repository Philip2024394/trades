// src/lib/nex/brains/_route_guards.ts
//
// D1 Turn 3 · Reusable route authorisation guards (Philip 2026-07-28)
// ────────────────────────────────────────────────────────────────────
// Centralises authorisation into small composable functions so
// mutation routes don't scatter permission logic. The flow every
// protected route follows:
//
//   const user = await requireAuth();
//   requireRole(user, ["admin"]);
//   requireBrainPermission(user, brain_slug, "publish");
//   await requireMFA(user, "publish");
//   // ... business logic
//
// Any guard failure throws HttpError. Routes wrap the whole block in
// try/catch and hand HttpError to `toErrorResponse` for consistent
// JSON error shape.

import { NextResponse } from "next/server";
import type { NexUserRole } from "./_living_types";
import {
  canPerform,
  mfaRequiredForAction,
  isPrivilegedAction,
  type BrainAction,
} from "./_permissions";
import { getAuthenticatedUser, type AuthenticatedUser } from "./_auth";
import { recordPrivilegedActionAuthorised } from "./_session_audit";

// ---------- HttpError ----------

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error("[route_guard] unexpected error:", err);
  return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
}

// ---------- Guards ----------

/**
 * Read + validate the current session, return the authenticated user.
 * Throws HttpError(401) if no session / HttpError(403) if account not
 * authorised for the platform.
 *
 * Preserves the dev bypass (NEX_DEV_AUTH_BYPASS=1 in non-production).
 * Dev bypass returns a synthetic admin user so local iteration keeps
 * working without Supabase Auth cookies.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const devBypass =
    process.env.NEX_DEV_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV !== "production";

  if (devBypass) {
    return {
      supabase_user_id: "dev-bypass-user-id",
      email: "dev@localhost",
      session_id: null,
      aal: "aal2",
      session_used_mfa: true,
      nex_user: {
        id: "dev-bypass-nex-user-id",
        supabase_user_id: "dev-bypass-user-id",
        email: "dev@localhost",
        display_name: "Dev Bypass",
        role: "admin",
        status: "active",
        qualifications: {},
        brain_permissions: {},
        organisation: null,
        approved_by: "dev-bypass",
        verified_at: null,
        verified_by: null,
        last_review_at: null,
        last_login_at: null,
        metadata: { dev_bypass: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }

  const result = await getAuthenticatedUser();
  if (!result.ok) throw new HttpError(result.status, result.error);
  return result.user;
}

export function requireRole(
  user: AuthenticatedUser,
  allowed: NexUserRole[]
): void {
  if (!allowed.includes(user.nex_user.role)) {
    throw new HttpError(
      403,
      `role_denied · required: ${allowed.join("|")} · user is ${user.nex_user.role}`
    );
  }
}

export function requireBrainPermission(
  user: AuthenticatedUser,
  brain_slug: string,
  action: BrainAction
): void {
  const perm = canPerform(user.nex_user, action, brain_slug);
  if (!perm.ok) throw new HttpError(403, perm.reason);
}

/**
 * If the action is privileged (publish / rollback / edit_identity),
 * require the session to have completed MFA (aal2). Non-privileged
 * actions pass through untouched.
 *
 * When MFA passes for a privileged action, records the authorisation
 * event to the audit trail (Philip 2026-07-28: "record MFA verification
 * time and last privileged action").
 */
export async function requireMFA(
  user: AuthenticatedUser,
  action: BrainAction,
  entity_id?: string
): Promise<void> {
  if (!mfaRequiredForAction(action)) return;

  // Admin role check first — non-admins can't reach privileged actions
  // via role default, so if a non-admin somehow reaches this, deny.
  if (user.nex_user.role !== "admin") {
    throw new HttpError(
      403,
      `role_denied_for_privileged_action · action '${action}' requires admin role`
    );
  }

  if (!user.session_used_mfa) {
    throw new HttpError(
      403,
      `mfa_required · action '${action}' is privileged. Complete MFA (TOTP) in your Supabase account, then re-sign-in.`
    );
  }

  // Audit the successful privileged authorisation. Never blocks — audit
  // failures log to console but don't fail the operation.
  if (isPrivilegedAction(action)) {
    await recordPrivilegedActionAuthorised({
      user_id: user.nex_user.id,
      email: user.email,
      action,
      entity_id: entity_id ?? null,
    });
  }
}

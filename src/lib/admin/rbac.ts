// RBAC · role-based access control for admin surfaces.
// Phase 0.2 of the engine-first roadmap.
//
// Backward compatible with the shared-password model in src/lib/adminAuth.ts:
// - When the shared password cookie is present (no per-admin identity),
//   caller is treated as effective role 'admin' with email 'root'.
// - When a per-admin session cookie is present (Phase 1+), caller
//   identity + role are read from hammerex_admins.
//
// Guard helper `assertAdminRole(request, allowedRoles)`:
//   - Returns AdminIdentity on success.
//   - Returns { error, status } on failure (never throws).
//
// Extend by adding new roles to the CHECK constraint in
// migration 20260720130000_hammerex_admins.sql + allowed-roles arrays
// at each route.

import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE_NAME, verifyAdminCookie } from "@/lib/adminAuth";

export type AdminRole = "admin" | "moderator" | "support" | "analyst" | "finance";

export type AdminIdentity = {
  adminId:     string | null;     // null when shared-password fallback
  email:       string;            // 'root' when shared-password fallback
  role:        AdminRole;
  displayName: string | null;
};

export type RoleAssertionResult =
  | { ok: true;  identity: AdminIdentity }
  | { ok: false; status: number; error: string };

// Session cookie for per-admin identity (Phase 1+). Distinct from
// ADMIN_COOKIE_NAME so both can coexist during transition.
export const ADMIN_SESSION_COOKIE = "xrated_admin_session_v2";

/** Resolve the caller's admin identity from cookies. Returns null if
 *  the caller is not authenticated as an admin at all. */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const jar = await cookies();

  // Phase 1+: per-admin session (opaque token → hammerex_admins row).
  // Not yet issued by any login endpoint — reserved for Phase 1.2.
  const sessionToken = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (sessionToken) {
    // Placeholder — real implementation reads session table when Phase 1.2
    // introduces hammerex_admin_sessions. For now, no per-admin sessions
    // exist; caller falls through to shared-password check.
  }

  // Phase 0: shared-password fallback. Effective role 'admin', email 'root'.
  const sharedCookie = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (verifyAdminCookie(sharedCookie)) {
    return {
      adminId:     null,
      email:       "root",
      role:        "admin",
      displayName: "Owner"
    };
  }

  return null;
}

/** Guard: require the caller to have one of the allowed roles.
 *  Use at the top of any admin API route. */
export async function assertAdminRole(
  allowedRoles: AdminRole[]
): Promise<RoleAssertionResult> {
  const identity = await getAdminIdentity();
  if (!identity) {
    return { ok: false, status: 401, error: "Unauthorized — admin session required" };
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(identity.role)) {
    return {
      ok:     false,
      status: 403,
      error:  `Forbidden — this action requires one of: ${allowedRoles.join(", ")}`
    };
  }
  return { ok: true, identity };
}

/** Convenience: assert the caller is any authenticated admin (any role). */
export async function assertAnyAdmin(): Promise<RoleAssertionResult> {
  return assertAdminRole([]);
}

/** Load a live admin by email (for login flow — Phase 1.2). */
export async function loadAdminByEmail(email: string): Promise<{
  id: string; email: string; password_hash: string; role: AdminRole;
  display_name: string | null; active: boolean;
} | null> {
  const res = await supabaseAdmin
    .from("hammerex_admins")
    .select("id, email, password_hash, role, display_name, active")
    .eq("email", email.toLowerCase().trim())
    .eq("active", true)
    .maybeSingle();
  return (res.data as {
    id: string; email: string; password_hash: string; role: AdminRole;
    display_name: string | null; active: boolean;
  } | null);
}

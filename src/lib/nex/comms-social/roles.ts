// NEX Comms Centre · Social · role permissions.
//
// Charter §S-V role scoping · enforced at the API layer via these
// helpers · never inferred from string comparisons at call sites.

import type { SocialRole } from "./types";

// Actions gated by role. Every merchant-facing action MUST map to one
// of these; adding a new action requires adding a case here so the
// enforcement surface stays enumerable and auditable.
export const SOCIAL_ACTIONS = [
  "connect_account",
  "disconnect_account",
  "enable_automatic",
  "disable_automatic",
  "propose_automatic",
  "approve_post",
  "publish_post",
  "pause_account",
  "resume_account",
  "manage_roles",
  "read_analytics",
  "administer_campaigns",
  "cross_tenant_read",
  "administer_publish",             // nex_admin_publish only · time-bounded
] as const;
export type SocialAction = typeof SOCIAL_ACTIONS[number];

// Fixed permission matrix. Keys are ROLES · values are the SOCIAL_ACTIONS
// the role may perform. Not extensible at runtime · changes are code
// changes reviewed like any other governance change.
const PERMISSIONS: Record<SocialRole, ReadonlySet<SocialAction>> = {
  owner: new Set([
    "connect_account", "disconnect_account",
    "enable_automatic", "disable_automatic", "propose_automatic",
    "approve_post", "publish_post",
    "pause_account", "resume_account",
    "manage_roles", "read_analytics", "administer_campaigns",
  ]),
  admin: new Set([
    "connect_account", "disconnect_account",
    "enable_automatic", "disable_automatic", "propose_automatic",
    "approve_post", "publish_post",
    "pause_account", "resume_account",
    "read_analytics", "administer_campaigns",
    // Note: manage_roles is owner-only.
  ]),
  marketing_manager: new Set([
    "propose_automatic",
    "approve_post", "publish_post",
    "pause_account", "resume_account",
    "read_analytics", "administer_campaigns",
  ]),
  staff: new Set([
    "propose_automatic",
    "read_analytics",
  ]),
  viewer: new Set([
    "read_analytics",
  ]),
  agency_manager: new Set([
    "connect_account", "disconnect_account",
    "propose_automatic",
    "approve_post", "publish_post",
    "pause_account", "resume_account",
    "read_analytics", "administer_campaigns",
    // Not: enable_automatic without explicit owner grant.
  ]),
  nex_admin_support: new Set([
    "cross_tenant_read",
  ]),
  nex_admin_publish: new Set([
    "cross_tenant_read",
    "administer_publish",
  ]),
};

export interface RoleGrantSnapshot {
  role:       SocialRole;
  expires_at: string | null;
  revoked_at: string | null;
}

/**
 * Returns true iff any of the caller's active grants includes the
 * required action. Grants past their expiry or revoked are ignored.
 */
export function permits(
  grants: readonly RoleGrantSnapshot[],
  action: SocialAction,
  now: Date = new Date(),
): boolean {
  const nowMs = now.getTime();
  for (const g of grants) {
    if (g.revoked_at) continue;
    if (g.expires_at && new Date(g.expires_at).getTime() <= nowMs) continue;
    const allowed = PERMISSIONS[g.role];
    if (allowed && allowed.has(action)) return true;
  }
  return false;
}

/**
 * Enforcement helper. Throws if the caller does not have the required
 * permission — callers should use this at the entry point of any
 * mutation-carrying API handler.
 */
export function requirePermits(
  grants: readonly RoleGrantSnapshot[],
  action: SocialAction,
  ctx: { actor: string; tenant_id?: string } = { actor: "unknown" },
): void {
  if (!permits(grants, action)) {
    const err = new Error(`permission_denied · actor=${ctx.actor} · action=${action}${ctx.tenant_id ? ` · tenant=${ctx.tenant_id}` : ""}`);
    (err as Error & { code?: string }).code = "PERMISSION_DENIED";
    throw err;
  }
}

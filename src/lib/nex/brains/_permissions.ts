// src/lib/nex/brains/_permissions.ts
//
// D1 Turn 3 · Per-brain permission model (Philip 2026-07-28)
// ─────────────────────────────────────────────────────────
// Rewritten from Turn 2's ACTION_MIN_ROLE table to the brain-slug-keyed
// shape Philip specified:
//
//   {
//     "staircase": { "author": true, "review": true, "publish": true },
//     "plumbing":  { "author": false, "review": false, "publish": false }
//   }
//
// Composition rule:
//   1. Status must be 'active'
//   2. If explicit per-brain flag is set (true/false), it wins
//   3. Otherwise, fall back to role-based default (role does the work)
//
// This lets a role grant sensible defaults (admin can do everything on
// every brain) while permitting explicit denial ("Sarah is admin but
// cannot publish plumbing content") or explicit uplift ("Bob is author
// on staircase but reviewer on joinery specifically").

import type { NexUserRow, NexBrainPermissions, NexUserRole } from "./_living_types";

export type BrainAction =
  | "read"
  | "author"
  | "review"        // approve / reject / request_changes (F6-guarded elsewhere)
  | "publish"
  | "rollback"
  | "edit_identity"
  | "admin_all";

export type PermissionResult =
  | { ok: true }
  | { ok: false; reason: string };

// Role rank for role-based defaults. Higher rank subsumes lower rank.
const ROLE_RANK: Record<NexUserRole, number> = {
  admin: 3,
  reviewer: 2,
  author: 1,
  system: 0,
  runtime: 0,
};

// Minimum role required for each action when no explicit per-brain
// permission overrides.
const ACTION_MIN_ROLE: Record<BrainAction, NexUserRole> = {
  read: "author",
  author: "author",
  review: "reviewer",
  publish: "admin",
  rollback: "admin",
  edit_identity: "admin",
  admin_all: "admin",
};

// Actions considered "privileged" — always require MFA when performed
// by an admin, regardless of brain scope. Philip 2026-07-28:
// publish · rollback · edit_identity · (delete = via direct SQL, out of
// route scope but noted). Non-privileged actions (author · review ·
// comment · read) do NOT require MFA.
const PRIVILEGED_ACTIONS: ReadonlySet<BrainAction> = new Set([
  "publish",
  "rollback",
  "edit_identity",
]);

// Map action → the boolean flag key on per-brain permissions
function actionToPermissionFlag(action: BrainAction): keyof NonNullable<NexBrainPermissions[string]> | null {
  switch (action) {
    case "read":          return "author";       // reading via authoring surface
    case "author":        return "author";
    case "review":        return "review";
    case "publish":       return "publish";
    case "rollback":      return "rollback";
    case "edit_identity": return "edit_identity";
    case "admin_all":     return null;           // no per-brain flag; admin role only
  }
}

export function canPerform(
  user: NexUserRow,
  action: BrainAction,
  brain_slug: string
): PermissionResult {
  // 1 · Status check
  if (user.status !== "active") {
    return { ok: false, reason: `user_status_${user.status}` };
  }

  // 2 · Explicit per-brain permission wins (either grant or deny)
  const brainPerm = user.brain_permissions?.[brain_slug];
  const flag = brainPerm && actionToPermissionFlag(action);
  if (brainPerm && flag) {
    const explicit = brainPerm[flag];
    if (explicit === true) return { ok: true };
    if (explicit === false) {
      return { ok: false, reason: `explicit_deny · '${action}' denied for user on brain '${brain_slug}'` };
    }
    // undefined: fall through to role default
  }

  // 3 · Role-based default
  const minRole = ACTION_MIN_ROLE[action];
  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    return {
      ok: false,
      reason: `role_insufficient · action '${action}' requires ${minRole}+ · user has ${user.role}`,
    };
  }

  return { ok: true };
}

export function isPrivilegedAction(action: BrainAction): boolean {
  return PRIVILEGED_ACTIONS.has(action);
}

/**
 * Whether MFA is required for this action. Philip 2026-07-28:
 * only privileged actions (publish · rollback · edit_identity) require
 * MFA. Ordinary drafting, review, commenting do not.
 */
export function mfaRequiredForAction(action: BrainAction): boolean {
  return isPrivilegedAction(action);
}

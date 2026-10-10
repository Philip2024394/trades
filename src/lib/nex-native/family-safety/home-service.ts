// src/lib/nex-native/family-safety/home-service.ts
//
// NEX Family Safety · Home snapshot service · authored 2026-10-10.
// ----------------------------------------------------------------
// Server-only · READ-ONLY · default-closed.
//
// Returns the minimum state the /nex-native/family-safety home page
// needs to render honestly, computed from:
//
//   · sealed `family-role-reader` primitives (migration 198)
//   · sealed `account-exists-reader` (account-gate)
//   · the Phase 1 pending-invitation count (not yet in a sealed
//     reader · we query the sealed `nex.family_link` table directly
//     with the same safe-default-on-error contract the sealed
//     readers follow · READ-ONLY).
//
// Load-bearing anti-patterns:
//   · Do NOT reveal counterparty details (names, emails, DOBs). The
//     snapshot is viewer-centric and intentionally thin.
//   · Do NOT throw. Any resolver failure folds to the
//     FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT shape.
//   · Do NOT write to the DB from this module. Any write path is
//     scope FS-2.

import "server-only";

import {
  listGuardianAccountIdsFor,
  listChildAccountIdsFor,
} from "@/lib/nex-native/family-links/family-role-reader";
import { withClient } from "@/lib/nex/db";
import {
  FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT,
  type FamilyHomeSnapshot,
  type FamilyMembershipState,
} from "@/components/nex-native/family-safety/types";

// ─────────────────────────────────────────────────────────────────────
// Pending-invitation count · READ-ONLY · default 0
// ─────────────────────────────────────────────────────────────────────

/** Count pending links where the viewer is the party that must still
 *  confirm. In the sealed data model a child confirms a guardian's
 *  invite · so we count rows where `child_account_id = viewer` AND
 *  `state = 'pending'`. */
async function countPendingInvitationsForViewer(
  viewerAccountId: string,
): Promise<number> {
  if (!viewerAccountId) return 0;
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM nex.family_link
        WHERE child_account_id = $1
          AND state            = 'pending'`,
      [viewerAccountId],
    );
    return res.rows;
  });
  if (!rows || rows.length === 0) return 0;
  const raw = rows[0]?.n;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

// ─────────────────────────────────────────────────────────────────────
// Membership-state resolution
// ─────────────────────────────────────────────────────────────────────

interface MembershipInputs {
  readonly hasAnyGuardianLink: boolean;
  readonly hasAnyChildLink: boolean;
  readonly pendingInvitationCount: number;
}

function resolveMembershipState(
  inputs: MembershipInputs,
): FamilyMembershipState {
  // Precedence · higher wins. Pending invitation takes precedence
  // over "none" so the home page can lead with the actionable chip.
  if (inputs.hasAnyGuardianLink) return "active_guardian";
  if (inputs.hasAnyChildLink) return "active_child";
  if (inputs.pendingInvitationCount > 0) return "pending_invitation";
  return "none";
}

// ─────────────────────────────────────────────────────────────────────
// Test-seam shape
// ─────────────────────────────────────────────────────────────────────

export interface GetFamilyHomeSnapshotArgs {
  /** The viewer's `nex_account.id`. Required · must not be blank. */
  readonly viewerAccountId: string;
}

export interface GetFamilyHomeSnapshotDeps {
  readonly listGuardianAccountIdsFor?: (
    viewerAccountId: string,
  ) => Promise<readonly string[]>;
  readonly listChildAccountIdsFor?: (
    viewerAccountId: string,
  ) => Promise<readonly string[]>;
  readonly countPendingInvitations?: (
    viewerAccountId: string,
  ) => Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the Family Safety home-page snapshot for a given viewer.
 *
 * Default-closed: on any failure, returns FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT.
 * Never throws.
 */
export async function getFamilyHomeSnapshot(
  args: GetFamilyHomeSnapshotArgs,
  deps: GetFamilyHomeSnapshotDeps = {},
): Promise<FamilyHomeSnapshot> {
  const viewer = (args.viewerAccountId ?? "").trim();
  if (!viewer) return FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT;

  const listGuardians =
    deps.listGuardianAccountIdsFor ?? listGuardianAccountIdsFor;
  const listChildren = deps.listChildAccountIdsFor ?? listChildAccountIdsFor;
  const countPending =
    deps.countPendingInvitations ?? countPendingInvitationsForViewer;

  try {
    const [guardiansOfViewer, childrenOfViewer, pendingCount] =
      await Promise.all([
        listGuardians(viewer),
        listChildren(viewer),
        countPending(viewer),
      ]);

    const hasAnyGuardianLink =
      Array.isArray(childrenOfViewer) && childrenOfViewer.length > 0;
    const hasAnyChildLink =
      Array.isArray(guardiansOfViewer) && guardiansOfViewer.length > 0;
    const safePending =
      typeof pendingCount === "number" &&
      Number.isFinite(pendingCount) &&
      pendingCount >= 0
        ? Math.floor(pendingCount)
        : 0;

    const familyMembershipState = resolveMembershipState({
      hasAnyGuardianLink,
      hasAnyChildLink,
      pendingInvitationCount: safePending,
    });

    return {
      familyMembershipState,
      hasAnyChildLink,
      hasAnyGuardianLink,
      pendingInvitationCount: safePending,
      // Dashboard is reachable whenever the viewer has ANY active link
      // · guardian OR child.
      canAccessDashboard: hasAnyGuardianLink || hasAnyChildLink,
      // SafeChat config is only meaningful when the viewer is a
      // guardian · in Phase 1 the panel is read-only but at least the
      // CTA is actionable for that audience.
      canConfigureSafeChat: hasAnyGuardianLink,
    };
  } catch {
    return FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT;
  }
}

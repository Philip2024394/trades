// src/components/nex-native/family-safety/types.ts
//
// NEX Family Safety · shared UI/contract types · authored 2026-10-10.
// -------------------------------------------------------------------
// This module is the single source of truth for Family Safety shell /
// nav / status types consumed by:
//
//   · FS-1 (this agent · shell + home + Settings entry)
//   · FS-2 (setup / invitation / acceptance / pressure signal)
//   · FS-3 (parent dashboard / SafeChat config / contact visibility)
//   · FS-4 (subscription + end-to-end Playwright)
//
// Load-bearing anti-patterns:
//   · Do NOT fork these types into FS-2/3/4 scope folders. Import from
//     here. If a scope needs a new type, add it here first.
//   · Do NOT add any sensitive-data types here (DOB, ID uploads, raw
//     biometric). Those are capability-ceiling violations.
//   · Do NOT re-export sealed `family-links/types.ts` tokens from here.
//     Those are server-only; FS surfaces import them separately in
//     server scope.

import * as React from "react";

// ─────────────────────────────────────────────────────────────────────
// §1 · Membership state (viewer-centric)
// ─────────────────────────────────────────────────────────────────────

/**
 * The viewer's current relationship to the Family Safety product.
 *
 * Computed by `home-service.ts` from `nex.family_link` rows WITHOUT
 * revealing counterparty details. Consumers may use this to decide
 * which nav chips to show.
 */
export type FamilyMembershipState =
  | "none" // no active or pending links
  | "pending_invitation" // viewer has a pending invitation to confirm
  | "active_guardian" // viewer is an active guardian on at least one child
  | "active_child" // viewer is an active ward of at least one guardian
  | "suspended" // all links suspended (reserved · Phase 2+ · never set in Phase 1)
  | "revoked"; // viewer previously had an active link that was revoked

export const FAMILY_MEMBERSHIP_STATES: readonly FamilyMembershipState[] = [
  "none",
  "pending_invitation",
  "active_guardian",
  "active_child",
  "suspended",
  "revoked",
] as const;

/** Sealed family role tokens re-exposed to UI consumers. These must
 *  match the sealed server-side `family-links/types.ts` enum. */
export type FamilyRelationshipRole =
  | "guardian_primary"
  | "guardian_secondary"
  | "trusted_adult"
  | "mentor"
  | "child";

// ─────────────────────────────────────────────────────────────────────
// §2 · Shell + nav
// ─────────────────────────────────────────────────────────────────────

/** Which Family Safety sub-surface is currently active. */
export type FamilySafetyNavKey =
  | "home"
  | "setup"
  | "dashboard"
  | "safechat"
  | "subscription";

export interface FamilySafetyShellProps {
  readonly children: React.ReactNode;
  /** The active nav chip. Omit on routes outside the nav (e.g.
   *  `not-available`). */
  readonly activeNav?: FamilySafetyNavKey;
  /** Optional one-line subtitle rendered under the shell header. */
  readonly subtitle?: string;
}

// ─────────────────────────────────────────────────────────────────────
// §3 · Status chip
// ─────────────────────────────────────────────────────────────────────

/** Semantic tone of a status chip · determines colour only. */
export type StatusChipTone =
  | "neutral" // grey
  | "info" // cyan
  | "pending" // amber
  | "active" // family-green
  | "revoked" // red (muted)
  | "expired" // dimmed grey
  | "suspended"; // orange

export interface StatusChipProps {
  readonly tone: StatusChipTone;
  readonly label: string;
  /** Optional small icon or glyph. */
  readonly glyph?: string;
  /** Optional data-testid for e2e. */
  readonly testId?: string;
}

// ─────────────────────────────────────────────────────────────────────
// §4 · Home snapshot (what the home page renders)
// ─────────────────────────────────────────────────────────────────────

/**
 * The minimum shape the home page needs to render honestly.
 *
 * Default-closed: a consumer that cannot compute this snapshot MUST
 * treat `familyMembershipState='none'` and all booleans FALSE.
 */
export interface FamilyHomeSnapshot {
  readonly familyMembershipState: FamilyMembershipState;
  readonly hasAnyChildLink: boolean;
  readonly hasAnyGuardianLink: boolean;
  /** Count of pending invitations the viewer must confirm/decline. */
  readonly pendingInvitationCount: number;
  readonly canAccessDashboard: boolean;
  readonly canConfigureSafeChat: boolean;
}

/** Safe default · consumers that cannot resolve the snapshot must use
 *  this value and surface the "not available" state. */
export const FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT: FamilyHomeSnapshot = {
  familyMembershipState: "none",
  hasAnyChildLink: false,
  hasAnyGuardianLink: false,
  pendingInvitationCount: 0,
  canAccessDashboard: false,
  canConfigureSafeChat: false,
} as const;

// ─────────────────────────────────────────────────────────────────────
// §5 · Pilot-mode marker
// ─────────────────────────────────────────────────────────────────────

/**
 * Universal Family Safety pilot banner identifier. Every surface in
 * this product MUST render a SimulatedPilotBadge. This const is used
 * as a sealed anchor by tests to grep for the badge.
 */
export const FAMILY_SAFETY_PILOT_LABEL = "SIMULATED · PILOT" as const;

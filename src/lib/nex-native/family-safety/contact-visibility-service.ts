// src/lib/nex-native/family-safety/contact-visibility-service.ts
//
// NEX Family Safety · Phase 1 · child-contact visibility reader.
//
// Server-only. This file exists so a future wave has a stable landing
// spot for a `can_see_contacts_summary` permission flag. In Phase 1
// that flag DOES NOT EXIST in the sealed schema (migration 198 ·
// `nex.family_link` carries only `can_see_emergency_alerts` /
// `can_see_safety_summaries` / `can_see_location_when_shared`), so
// the service unconditionally returns `{available: false, reason:
// 'contact_visibility_not_in_phase_1'}` and NEVER queries any
// contact-adjacent table.
//
// Load-bearing privacy doctrine:
//   · This service does NOT query `nex_friend_edge`, `nex_contact_*`,
//     `nex_peer_conversation`, or any other table that could leak
//     the child's social graph. Grep-anchor test enforces this.
//   · Guardians NEVER get blanket access to a child's contacts
//     "because a family link exists" · a dedicated permission flag
//     + both-party-consent flow is required when this ships.
//   · Every CALL writes an audit row with outcome='denied_flag_off'
//     so the audit log answers "did a guardian ATTEMPT contact
//     access during Phase 1?" even though no data was ever served.

import "server-only";

import {
  logDashboardAccess,
  resolveChildDashboardAccess,
} from "./dashboard-service";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed shape
// ═════════════════════════════════════════════════════════════════════

export const CONTACT_VISIBILITY_PHASE_1_REASON =
  "contact_visibility_not_in_phase_1" as const;

export interface ContactVisibilityUnavailable {
  readonly available: false;
  readonly reason: typeof CONTACT_VISIBILITY_PHASE_1_REASON;
  readonly simulatedPhase1: true;
}

// Reserved shape for the future wave. Phase 1 code MUST NOT construct
// this · the service always returns `Unavailable`.
export interface ContactVisibilityAvailable {
  readonly available: true;
  readonly contacts: readonly never[]; // placeholder · Phase 1 never returns this
  readonly simulatedPhase1: true;
}

export type ContactVisibilityResult =
  | ContactVisibilityUnavailable
  | ContactVisibilityAvailable;

// ═════════════════════════════════════════════════════════════════════
// §2 · Reader
// ═════════════════════════════════════════════════════════════════════

export interface GetContactVisibilityArgs {
  readonly viewerAccountId: string;
  readonly childAccountId: string;
}

/**
 * Phase 1 behaviour: UNCONDITIONAL unavailable.
 *
 * The gate order is deliberate:
 *   1. Resolve guardianship FIRST so an attempt by a non-guardian
 *      logs as `denied_not_guardian` (and we do NOT leak the Phase 1
 *      ceiling reason to someone who isn't even a guardian).
 *   2. If the viewer IS a guardian, log the flag-off denial and
 *      return the unavailable shape.
 *
 * No contact tables are read in either branch.
 */
export async function getContactVisibilityForChild(
  args: GetContactVisibilityArgs,
): Promise<ContactVisibilityResult> {
  const gate = await resolveChildDashboardAccess({
    viewerAccountId: args.viewerAccountId,
    childAccountId: args.childAccountId,
    surface: "child_contacts",
  });

  if (!gate.ok) {
    // The gate already wrote its own audit row with the appropriate
    // not-guardian / revoked outcome. We MUST NOT fabricate contact
    // data for a non-guardian · return the unavailable shape as if
    // the flag were off (which it is), without leaking why.
    return {
      available: false,
      reason: CONTACT_VISIBILITY_PHASE_1_REASON,
      simulatedPhase1: true,
    };
  }

  // Guardian is authorised to view the dashboard but NOT the
  // contacts summary · the permission flag doesn't exist in the
  // Phase 1 schema. Log the flag-off denial as a separate audit row
  // (append-only) and return the sealed unavailable shape.
  await logDashboardAccess({
    viewerAccountId: args.viewerAccountId,
    viewedChildAccountId: args.childAccountId,
    surface: "child_contacts",
    outcome: "denied_flag_off",
  });

  return {
    available: false,
    reason: CONTACT_VISIBILITY_PHASE_1_REASON,
    simulatedPhase1: true,
  };
}

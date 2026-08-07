// NEX Compliance Engine · standardised policy across providers
//
// Provider-agnostic rules (Philip 2026-08-08):
//   hard bounce  → suppressed_hard  · immediate
//   complaint    → complaint        · immediate · reinstate needs admin confirm
//   unsubscribed → unsubscribed     · immediate · reinstate is opt-in re-subscribe
//   soft bounce  → count++ · when count >= threshold → suppressed_soft
//   delivered    → reset soft_bounce_count (optional · configurable)
//   manual_block → set by admin only · reinstate needs admin confirm

import type { ComplianceState } from "./types";

export const POLICY = {
  // How many consecutive soft bounces before automatic suppression.
  // Env override: NEX_COMPLIANCE_SOFT_BOUNCE_THRESHOLD
  softBounceThreshold: Number(process.env.NEX_COMPLIANCE_SOFT_BOUNCE_THRESHOLD ?? 5),

  // Reset the soft-bounce counter after a successful delivery.
  // Env override: NEX_COMPLIANCE_RESET_SOFT_ON_DELIVERED (default true)
  resetSoftOnDelivered: (process.env.NEX_COMPLIANCE_RESET_SOFT_ON_DELIVERED ?? "true") !== "false",
};

/**
 * States that an admin can freely reinstate (single-click undo).
 * All other states require explicit admin confirmation with a reason,
 * because they represent an ISP or user signal we must respect.
 */
const FREE_REINSTATE_STATES = new Set<ComplianceState>(["suppressed_soft", "suppressed_hard"]);
const CONFIRM_REINSTATE_STATES = new Set<ComplianceState>(["complaint", "manual_block", "unsubscribed"]);

export type ReinstatePolicy = "allowed" | "requires_confirmation" | "denied";

export function reinstatePolicy(from: ComplianceState): ReinstatePolicy {
  if (from === "allowed") return "denied";                       // nothing to undo
  if (FREE_REINSTATE_STATES.has(from)) return "allowed";
  if (CONFIRM_REINSTATE_STATES.has(from)) return "requires_confirmation";
  return "denied";
}

/**
 * Whether an event source is trusted to enact an automatic suppression.
 * All provider webhooks are trusted; the simulator is trusted (for
 * end-to-end testing); manual_admin is trusted; expansion_check is
 * defense-in-depth (may re-suppress · never un-suppress).
 */
export function isTrustedSource(source: string): boolean {
  return /_webhook$|^simulator$|^manual_admin$|^expansion_check$/.test(source);
}

/**
 * A recipient with any of these states is NOT eligible for sending ·
 * used by expansion + defense-in-depth send-loop check.
 */
export const NON_SENDABLE_STATES = new Set<ComplianceState>([
  "suppressed_soft", "suppressed_hard", "unsubscribed", "complaint", "manual_block",
]);

// src/lib/nex/marketing/deliverability/suppression-preflight.ts
//
// NEX Deliverability · Suppression Preflight
// Founder-authorised programme · Session-14 · Part 11h · 2026-09-22.
//
// PURE AGGREGATE. Given a proposed audience represented as suppression-flag
// rows (never email addresses in the pure function), projects how many will
// actually be sendable and enumerates the breakdown by suppression reason.
//
// GOVERNANCE HARD-LOCKS:
//   * Pure function · zero side effects · zero mutation
//   * Never returns email addresses · rows carry opaque contact_id only
//   * Deterministic precedence · same input always produces same projection
//   * Never exposes an unsuppress / bypass / override function

import type { ReputationState } from "./types";

/** Suppression reasons enumerated in Founder-authored precedence order.
 *  When a contact matches multiple reasons, we count the FIRST match ·
 *  most-restrictive-wins. This ensures consistent reporting and prevents
 *  double-counting across categories. */
export const SUPPRESSION_REASONS = [
  "hard_bounced",          // deterministic hard block · never reversed
  "on_opt_out_list",       // explicit unsubscribe · legal + reputational
  "recent_complaint",      // ≥1 spam complaint recorded
  "sender_frozen",         // sender reputation = frozen · hard block
  "sender_limited",        // sender reputation = limited · hard block
  "domain_dmarc_reject_unaligned", // domain auth prevents send
  "no_email",              // missing/invalid email address on record
] as const;

export type SuppressionReason = typeof SUPPRESSION_REASONS[number];

/** Input row for the pure calculator. Carries ONLY the flags needed to
 *  determine suppression · never PII/email addresses. */
export interface SuppressionInputRow {
  readonly contact_id: string;              // opaque UUID · not an email
  readonly has_valid_email: boolean;        // false when email is null/malformed
  readonly hard_bounced: boolean;
  readonly opt_out: boolean;                // marketing_contact.opt_out OR marketing_opt_out row
  readonly complaint_count: number;         // ≥1 → suppressed
  readonly sender_reputation_state: ReputationState | null;
  readonly domain_dmarc_reject_unaligned: boolean;
}

export interface SuppressionProjection {
  readonly total_proposed: number;
  readonly sendable: number;
  readonly total_suppressed: number;
  readonly suppressed_by_reason: Readonly<Record<SuppressionReason, number>>;
  readonly precedence_order: readonly SuppressionReason[];
  readonly overlap_count: number;           // rows that matched >1 reason (counted under first)
  readonly sendable_percentage: number | null; // sendable / total (rounded to 4dp)
  readonly note: string;
}

/** Determine the first-matching suppression reason for a row · null if sendable. */
function classifyRow(r: SuppressionInputRow): SuppressionReason | null {
  if (!r.has_valid_email) return "no_email";
  if (r.hard_bounced) return "hard_bounced";
  if (r.opt_out) return "on_opt_out_list";
  if (r.complaint_count > 0) return "recent_complaint";
  if (r.sender_reputation_state === "frozen") return "sender_frozen";
  if (r.sender_reputation_state === "limited") return "sender_limited";
  if (r.domain_dmarc_reject_unaligned) return "domain_dmarc_reject_unaligned";
  return null;
}

/** Count how many suppression reasons a row matches (for overlap analysis). */
function countReasons(r: SuppressionInputRow): number {
  let n = 0;
  if (!r.has_valid_email) n++;
  if (r.hard_bounced) n++;
  if (r.opt_out) n++;
  if (r.complaint_count > 0) n++;
  if (r.sender_reputation_state === "frozen") n++;
  if (r.sender_reputation_state === "limited") n++;
  if (r.domain_dmarc_reject_unaligned) n++;
  return n;
}

// ─── Public API ────────────────────────────────────────────────────
export function computeSuppressionProjection(rows: readonly SuppressionInputRow[]): SuppressionProjection {
  const total_proposed = rows.length;
  const by_reason: Record<SuppressionReason, number> = {
    hard_bounced: 0,
    on_opt_out_list: 0,
    recent_complaint: 0,
    sender_frozen: 0,
    sender_limited: 0,
    domain_dmarc_reject_unaligned: 0,
    no_email: 0,
  };
  let sendable = 0;
  let overlap_count = 0;

  for (const r of rows) {
    const reason = classifyRow(r);
    if (reason) {
      by_reason[reason]++;
      if (countReasons(r) > 1) overlap_count++;
    } else {
      sendable++;
    }
  }

  const total_suppressed = total_proposed - sendable;
  const sendable_percentage = total_proposed > 0
    ? Math.round((sendable / total_proposed) * 10000) / 10000
    : null;

  return {
    total_proposed,
    sendable,
    total_suppressed,
    suppressed_by_reason: by_reason,
    precedence_order: SUPPRESSION_REASONS,
    overlap_count,
    sendable_percentage,
    note:
      total_proposed === 0
        ? "empty_audience_no_send_would_occur"
        : sendable === 0
          ? "all_proposed_contacts_are_suppressed_no_send_would_occur"
          : `${sendable} of ${total_proposed} contacts would be sendable (${((sendable_percentage ?? 0) * 100).toFixed(2)}%)`,
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _PREFLIGHT_NEVER_RETURNS_EMAILS = "projection_body_contains_no_email_addresses_only_opaque_contact_ids";
export const _PREFLIGHT_NEVER_UNSUPPRESSES = "no_bypass_no_override_no_unsuppress_no_clear_no_force_send_exported";
export const _PREFLIGHT_DETERMINISTIC_PRECEDENCE = "same_input_always_same_projection_first_matching_reason_wins";
export const _PREFLIGHT_HARD_BOUNCE_HIGHEST_PRECEDENCE = "hard_bounced_matched_first_before_all_other_reasons_never_overridden";

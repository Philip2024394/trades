// src/lib/nex-native/family-links/pressure-signal-service.ts
//
// NEX Family Links · FS-2 · HQ-only pressure signal.
//
// Server-only. Thin pg wrapper around nex.family_link_pressure_report
// (migration 200). Implements decision D2 · 2A · bidirectional pressure
// signal:
//
//   · Either side of the link may file (child OR guardian).
//   · The counterparty is NEVER notified. This service writes to the
//     HQ queue only; the service never emits a notification side-effect
//     to the reported account. Enforced by: having no notification
//     side-effect in the code path at all.
//   · On a PENDING invitation, filing a signal auto-rejects the link
//     via sealed family-link-service.revokeLink with
//     reason='pressure_signal'. We COMPOSE the sealed revokeLink; we
//     do NOT modify it.
//   · On an ACTIVE link, filing a signal does NOT auto-revoke · the
//     child retains normal product behaviour until HQ Safety Operations
//     acts.
//   · simulated=TRUE always · Phase 1 pilot gate.
//
// Doctrine references:
//   · docs/doctrine/nex-family-links-decisions-adopted-2026-10-10.md · D2
//   · docs/doctrine/nex-family-links-ui-spec-2026-10-10.md · §3c
//   · docs/doctrine/nex-family-links-retention-policy-draft-2026-10-10.md

import "server-only";

import { withClient } from "@/lib/nex/db";
import { getLinkById, revokeLink } from "./family-link-service";
import type { FamilyLinkRow } from "./types";

export const PRESSURE_REASON_CODES = [
  "coerced",
  "threatened",
  "unknown_inviter",
  "not_my_family",
  "other",
] as const;
export type PressureReasonCode = (typeof PRESSURE_REASON_CODES)[number];

export function isPressureReasonCode(v: unknown): v is PressureReasonCode {
  return (
    typeof v === "string" &&
    (PRESSURE_REASON_CODES as readonly string[]).includes(v)
  );
}

export const PRESSURE_REPORT_STATES = [
  "open",
  "under_review",
  "resolved_safe",
  "resolved_unsafe",
  "withdrawn",
] as const;
export type PressureReportState = (typeof PRESSURE_REPORT_STATES)[number];

export const PRESSURE_SIGNAL_ERROR_CODES = {
  INVALID_LINK_ID: "pressure_signal.invalid_link_id",
  INVALID_ACTOR: "pressure_signal.invalid_actor",
  INVALID_REASON_CODE: "pressure_signal.invalid_reason_code",
  INVALID_REASON_NOTES: "pressure_signal.invalid_reason_notes",
  LINK_NOT_FOUND: "pressure_signal.link_not_found",
  NOT_A_PARTY: "pressure_signal.actor_not_a_party_to_link",
  LINK_TERMINAL: "pressure_signal.link_is_terminal",
  DUPLICATE_OPEN_REPORT: "pressure_signal.duplicate_open_report",
  DB_UNAVAILABLE: "pressure_signal.db_unavailable",
} as const;
export type PressureSignalErrorCode =
  (typeof PRESSURE_SIGNAL_ERROR_CODES)[keyof typeof PRESSURE_SIGNAL_ERROR_CODES];

export interface PressureReportRow {
  readonly reportId: string;
  readonly linkId: string;
  readonly reporterAccountId: string;
  readonly reasonCode: PressureReasonCode;
  readonly reasonNotes: string | null;
  readonly reportedAgainstAccountId: string;
  readonly state: PressureReportState;
  readonly simulated: boolean;
  readonly reportedAt: string;
  readonly resolvedAt: string | null;
}

export interface IssuePressureSignalArgs {
  readonly linkId: string;
  readonly actorAccountId: string;
  readonly reasonCode: PressureReasonCode;
  readonly reasonNotes?: string;
}

export interface IssuePressureSignalResult {
  readonly report: PressureReportRow;
  /** `true` when the signal auto-rejected a pending invitation. */
  readonly autoRejectedPending: boolean;
  /** The sealed family_link row AFTER the composed revoke (if any). */
  readonly linkAfter: FamilyLinkRow;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}
function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}
function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function mapRow(r: Record<string, unknown>): PressureReportRow {
  const reasonCode = String(r.reason_code ?? "");
  const state = String(r.state ?? "");
  if (!isPressureReasonCode(reasonCode)) {
    throw new Error(
      `pressure_signal.unknown_reason_code · got '${reasonCode}' · migration drift`,
    );
  }
  if (!(PRESSURE_REPORT_STATES as readonly string[]).includes(state)) {
    throw new Error(
      `pressure_signal.unknown_state · got '${state}' · migration drift`,
    );
  }
  return {
    reportId: String(r.report_id),
    linkId: String(r.link_id),
    reporterAccountId: String(r.reporter_account_id),
    reasonCode,
    reasonNotes: toStringOrNull(r.reason_notes),
    reportedAgainstAccountId: String(r.reported_against_account_id),
    state: state as PressureReportState,
    simulated: Boolean(r.simulated),
    reportedAt: toIso(r.reported_at),
    resolvedAt: toIsoOrNull(r.resolved_at),
  };
}

function requireNonEmptyString(v: unknown, label: string): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`pressure_signal.invalid_${label}`);
  }
  return v;
}

function validateNotes(notes: string | undefined): string | null {
  if (notes === undefined || notes === null) return null;
  if (typeof notes !== "string" || notes.length < 1 || notes.length > 500) {
    throw new Error(PRESSURE_SIGNAL_ERROR_CODES.INVALID_REASON_NOTES);
  }
  return notes;
}

/**
 * File a pressure signal against the counterparty on this family link.
 *
 * Decision D2 · 2A:
 *   · bidirectional (child OR guardian can file)
 *   · HQ-only · the counterparty is NEVER notified
 *   · on PENDING · auto-rejects the invitation (sealed revokeLink with
 *     reason='pressure_signal') before returning
 *   · on ACTIVE · HQ queue only; link stays active until HQ acts
 *   · on terminal (revoked / expired) · rejected with LINK_TERMINAL
 *
 * The code path contains NO notification side-effects to the reported
 * counterparty. The service never writes a `nex_notification` /
 * `nex_push` / email / anything addressed to
 * `reported_against_account_id`. This is an architectural guarantee of
 * the signal.
 */
export async function issuePressureSignal(
  args: IssuePressureSignalArgs,
): Promise<IssuePressureSignalResult> {
  const linkId = requireNonEmptyString(args.linkId, "link_id");
  const actorId = requireNonEmptyString(args.actorAccountId, "actor_account_id");
  if (!isPressureReasonCode(args.reasonCode)) {
    throw new Error(PRESSURE_SIGNAL_ERROR_CODES.INVALID_REASON_CODE);
  }
  const notes = validateNotes(args.reasonNotes);

  const link = await getLinkById(linkId);
  if (!link) {
    throw new Error(PRESSURE_SIGNAL_ERROR_CODES.LINK_NOT_FOUND);
  }

  // Only parties to the link may file.
  if (
    actorId !== link.guardianAccountId &&
    actorId !== link.childAccountId
  ) {
    throw new Error(PRESSURE_SIGNAL_ERROR_CODES.NOT_A_PARTY);
  }

  // Terminal links cannot receive new pressure signals.
  if (link.state === "revoked" || link.state === "expired") {
    throw new Error(PRESSURE_SIGNAL_ERROR_CODES.LINK_TERMINAL);
  }

  // Who is reported against? The other party.
  const reportedAgainst =
    actorId === link.guardianAccountId
      ? link.childAccountId
      : link.guardianAccountId;

  const inserted = await withClient(async (client) => {
    try {
      const ins = await client.query(
        `INSERT INTO nex.family_link_pressure_report (
           link_id,
           reporter_account_id,
           reason_code,
           reason_notes,
           reported_against_account_id,
           state,
           simulated
         ) VALUES ($1, $2, $3, $4, $5, 'open', TRUE)
         RETURNING *`,
        [linkId, actorId, args.reasonCode, notes, reportedAgainst],
      );
      if (ins.rowCount !== 1 || !ins.rows[0]) {
        throw new Error("pressure_signal.insert_failed");
      }
      return mapRow(ins.rows[0]);
    } catch (err) {
      // The partial-unique index enforces one open report per
      // (link, reporter). We surface a stable error code.
      const msg = err instanceof Error ? err.message : String(err);
      if (/family_link_pressure_report_reporter_open_uq/i.test(msg)) {
        throw new Error(PRESSURE_SIGNAL_ERROR_CODES.DUPLICATE_OPEN_REPORT);
      }
      throw err;
    }
  });

  if (inserted === null) {
    throw new Error(PRESSURE_SIGNAL_ERROR_CODES.DB_UNAVAILABLE);
  }

  // If the link is pending, auto-reject via the sealed revokeLink.
  // The reason string is 'pressure_signal' per sealed spec §3c and
  // retention bucket `pressure_signal_outcome`.
  let autoRejectedPending = false;
  let linkAfter: FamilyLinkRow = link;
  if (link.state === "pending") {
    linkAfter = await revokeLink({
      linkId,
      actorAccountId: actorId,
      reason: "pressure_signal",
    });
    autoRejectedPending = true;
  }

  return { report: inserted, autoRejectedPending, linkAfter };
}

/**
 * Read reports filed BY this reporter · used so the Accept panel can
 * surface "you have already flagged this invitation" state. HQ-only
 * reports; this reader intentionally cannot be used to see reports
 * filed AGAINST you (that would leak the HQ queue).
 */
export async function listReportsByReporter(
  reporterAccountId: string,
): Promise<readonly PressureReportRow[]> {
  const id = requireNonEmptyString(reporterAccountId, "reporter_account_id");
  const rows = await withClient(async (client) => {
    const res = await client.query(
      `SELECT * FROM nex.family_link_pressure_report
         WHERE reporter_account_id = $1
         ORDER BY reported_at DESC`,
      [id],
    );
    return res.rows;
  });
  if (rows === null) return [];
  return rows.map(mapRow);
}

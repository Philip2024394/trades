// src/lib/nex-legal/transport-legal-model.ts
//
// TRANSPORT LEGAL MODEL · Stage-B gate check.
//
// Doctrine anchors:
//   - Legal Boundary First (2026-08-23 CONSTITUTIONAL): NEX MUST NOT dispatch
//     drivers under a legal model that has not been researched, documented, and
//     approved for the jurisdiction. Absence of an approved row = dispatch
//     REFUSED.
//   - Truth Invariant (2026-08-22): T&Cs cannot override statutory allocation.
//     This module rejects a bare "approved: true" — it requires effective_from
//     to be past, effective_to to be null or future, AND status = 'approved'.
//   - Reputation Non-Weapon (2026-08-23): the legal model is stored as evidence
//     · never a marketing claim.
//
// Pure logic. No live DB dependency in this file · a reader is provided that
// takes an already-loaded array of rows (production code loads them via the
// standard NEX pool).

export type TransportLegalModelStatus =
  | "researching"
  | "pending_approval"
  | "approved"
  | "suspended"
  | "rejected";

export type NexTransportRole =
  | "undetermined"
  | "technology_provider"
  | "intermediary"
  | "marketplace"
  | "booking_platform"
  | "transport_operator"
  | "other_regulated_role";

export type BookingArrangementKind =
  | "dispatch_authorised"
  | "direct_contact"
  | "self_arranged";

export interface TransportLegalModelRow {
  legalModelId: string;
  jurisdiction: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  nexRole: NexTransportRole;
  driverRole: string | null;
  operatorLicenceRef: string | null;
  insuranceRequirements: Record<string, unknown>;
  applicableRegulations: string[];
  documentReference: string | null;
  status: TransportLegalModelStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  notes: string | null;
}

export interface LegalGateOK {
  status: "APPROVED";
  jurisdiction: string;
  legalModelId: string;
  nexRole: NexTransportRole;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  approvedAt: Date;
  approvedBy: string;
  applicableRegulations: string[];
  documentReference: string | null;
}

export interface LegalGateRefused {
  status: "REFUSED";
  reason:
    | "NO_ROW_FOR_JURISDICTION"
    | "STATUS_NOT_APPROVED"
    | "NOT_YET_EFFECTIVE"
    | "EXPIRED"
    | "NEX_ROLE_UNDETERMINED"
    | "MISSING_APPROVAL_METADATA";
  detail: string;
  candidateStatus?: TransportLegalModelStatus;
}

export type LegalGateResult = LegalGateOK | LegalGateRefused;

/**
 * Check whether Stage-B dispatch may proceed for a jurisdiction at a given
 * time. Returns APPROVED only if the legal model row exists, is approved,
 * carries the approval metadata, is currently effective, AND has a determinate
 * nex_role. Anything less is REFUSED with a specific reason.
 */
export function checkLegalGate(
  jurisdiction: string,
  now: Date,
  rows: TransportLegalModelRow[],
): LegalGateResult {
  const candidates = rows
    .filter((r) => r.jurisdiction === jurisdiction)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

  if (candidates.length === 0) {
    return {
      status: "REFUSED",
      reason: "NO_ROW_FOR_JURISDICTION",
      detail: `No transport_legal_model row exists for jurisdiction ${jurisdiction}. Stage-B dispatch is not permitted here until an approved legal model is recorded.`,
    };
  }

  // Take the row whose effective window covers `now`, preferring the most recent effective_from.
  const inWindow = candidates.find(
    (r) =>
      r.effectiveFrom.getTime() <= now.getTime() &&
      (r.effectiveTo == null || r.effectiveTo.getTime() > now.getTime()),
  );
  const chosen = inWindow ?? candidates[0];

  if (chosen.status !== "approved") {
    return {
      status: "REFUSED",
      reason: "STATUS_NOT_APPROVED",
      detail: `Legal model for ${jurisdiction} has status '${chosen.status}'. Stage-B dispatch requires status 'approved'.`,
      candidateStatus: chosen.status,
    };
  }

  if (chosen.effectiveFrom.getTime() > now.getTime()) {
    return {
      status: "REFUSED",
      reason: "NOT_YET_EFFECTIVE",
      detail: `Legal model for ${jurisdiction} becomes effective at ${chosen.effectiveFrom.toISOString()}.`,
      candidateStatus: chosen.status,
    };
  }
  if (chosen.effectiveTo && chosen.effectiveTo.getTime() <= now.getTime()) {
    return {
      status: "REFUSED",
      reason: "EXPIRED",
      detail: `Legal model for ${jurisdiction} expired at ${chosen.effectiveTo.toISOString()}.`,
      candidateStatus: chosen.status,
    };
  }

  if (chosen.nexRole === "undetermined") {
    return {
      status: "REFUSED",
      reason: "NEX_ROLE_UNDETERMINED",
      detail: `Legal model for ${jurisdiction} has nex_role 'undetermined'. NEX's legal role must be explicitly determined before dispatch.`,
      candidateStatus: chosen.status,
    };
  }

  if (!chosen.approvedBy || !chosen.approvedAt) {
    return {
      status: "REFUSED",
      reason: "MISSING_APPROVAL_METADATA",
      detail: `Legal model for ${jurisdiction} lacks approved_by / approved_at. Approval must be attributable.`,
      candidateStatus: chosen.status,
    };
  }

  return {
    status: "APPROVED",
    jurisdiction,
    legalModelId: chosen.legalModelId,
    nexRole: chosen.nexRole,
    effectiveFrom: chosen.effectiveFrom,
    effectiveTo: chosen.effectiveTo,
    approvedAt: chosen.approvedAt,
    approvedBy: chosen.approvedBy,
    applicableRegulations: chosen.applicableRegulations,
    documentReference: chosen.documentReference,
  };
}

/**
 * Legal-gate check tailored to a specific booking arrangement. Only
 * `dispatch_authorised` requires the Stage-B legal-model check. The two lower-
 * risk arrangements (direct_contact · self_arranged) do not require it because
 * NEX is not the one dispatching the transport.
 */
export function checkLegalGateForArrangement(
  arrangement: BookingArrangementKind,
  jurisdiction: string,
  now: Date,
  rows: TransportLegalModelRow[],
): LegalGateResult | { status: "NOT_APPLICABLE"; arrangement: BookingArrangementKind } {
  if (arrangement === "dispatch_authorised") {
    return checkLegalGate(jurisdiction, now, rows);
  }
  return { status: "NOT_APPLICABLE", arrangement };
}

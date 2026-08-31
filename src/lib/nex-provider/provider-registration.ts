// src/lib/nex-provider/provider-registration.ts
//
// DRIVER REGISTRATION STATE MACHINE.
//
// Pure functions modelling the legal driver lifecycle:
//
//   registered ─(uploadFirstDocument)→ documents_pending
//   documents_pending ─(verifyAllDocuments)→ documents_verified
//   documents_pending ─(rejectDocument)→ documents_pending (stays pending)
//   documents_verified ─(rejectDocument or expireDocument)→ documents_pending
//   any-state ─(suspend)→ suspended
//   suspended ─(reinstate)→ documents_pending (must re-verify)
//
// Doctrine anchors:
//   - Driver Network authorised-only design (2026-08-23)
//   - Truth Invariant: no verified status without every REQUIRED document being verified
//   - Stage A / Stage B split: THIS module runs Stage A. Actual live-dispatch
//     activation is gated at src/lib/nex-provider/dispatch.ts by NEX_DRIVER_DISPATCH_ENABLED.
//
// Rules enforced:
//   1. A driver becomes `documents_verified` ONLY when every REQUIRED document
//      kind has state='verified' AND vehicle_kind is set.
//   2. Any single document rejection or expiry demotes a verified driver back to pending.
//   3. Illegal state transitions throw. No silent no-op.
//   4. Suspension writes suspended_at + suspended_reason together.

import type {
  DriverStatus,
  DriverDocumentKind,
  DriverDocumentState,
} from "./provider-network-types";

export interface DriverSnapshot {
  driverId: string;
  status: DriverStatus;
  vehicleKind: string | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  documents: DocumentSnapshot[];
}

export interface DocumentSnapshot {
  documentId: string;
  kind: DriverDocumentKind;
  state: DriverDocumentState;
  uploadedAt: Date;
  verifiedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Document kinds that are ALWAYS required before verification. Additional kinds
 * (health_declaration · operator_permit) become required by jurisdiction · that
 * lookup lives in a separate module because it is jurisdiction-specific evidence.
 */
export const UNIVERSAL_REQUIRED_DOCUMENTS: DriverDocumentKind[] = [
  "national_id",
  "driver_licence",
  "vehicle_registration",
  "vehicle_insurance",
];

export interface StateTransitionError {
  code:
    | "ILLEGAL_TRANSITION"
    | "SUSPENDED_REQUIRES_REASON"
    | "VERIFY_REQUIRES_ALL_DOCUMENTS"
    | "VERIFY_REQUIRES_VEHICLE";
  detail: string;
}

export class DriverStateError extends Error {
  code: StateTransitionError["code"];
  constructor(err: StateTransitionError) {
    super(err.detail);
    this.name = "DriverStateError";
    this.code = err.code;
  }
}

/**
 * Move a driver forward when a new document is uploaded.
 * `registered` → `documents_pending`. `documents_pending` stays. `documents_verified`
 * becomes `documents_pending` because a new document must be verified first.
 */
export function onDocumentUploaded(driver: DriverSnapshot): DriverSnapshot {
  if (driver.status === "suspended") {
    throw new DriverStateError({
      code: "ILLEGAL_TRANSITION",
      detail: "Suspended drivers cannot upload documents until reinstated.",
    });
  }
  return {
    ...driver,
    status: "documents_pending",
  };
}

/**
 * Attempt to promote a driver to `documents_verified`. Only succeeds when EVERY
 * universally-required document kind has state='verified' AND vehicle_kind is set.
 * Otherwise the driver stays wherever it was.
 */
export function attemptVerifyDriver(
  driver: DriverSnapshot,
  extraRequiredDocuments: DriverDocumentKind[] = [],
): DriverSnapshot {
  if (driver.status === "suspended") {
    throw new DriverStateError({
      code: "ILLEGAL_TRANSITION",
      detail: "Suspended drivers cannot be verified until reinstated.",
    });
  }
  const required = new Set<DriverDocumentKind>([
    ...UNIVERSAL_REQUIRED_DOCUMENTS,
    ...extraRequiredDocuments,
  ]);
  const verifiedKinds = new Set(
    driver.documents.filter((d) => d.state === "verified").map((d) => d.kind),
  );
  for (const kind of required) {
    if (!verifiedKinds.has(kind)) {
      throw new DriverStateError({
        code: "VERIFY_REQUIRES_ALL_DOCUMENTS",
        detail: `Cannot verify driver ${driver.driverId}: missing verified document ${kind}.`,
      });
    }
  }
  if (!driver.vehicleKind) {
    throw new DriverStateError({
      code: "VERIFY_REQUIRES_VEHICLE",
      detail: `Cannot verify driver ${driver.driverId}: vehicle_kind is not set.`,
    });
  }
  return {
    ...driver,
    status: "documents_verified",
  };
}

/**
 * A document was rejected or expired. If the driver was verified, demote them back
 * to documents_pending. Otherwise the state is unchanged (still pending or registered).
 */
export function onDocumentInvalidated(driver: DriverSnapshot): DriverSnapshot {
  if (driver.status === "documents_verified") {
    return { ...driver, status: "documents_pending" };
  }
  return driver;
}

export function suspendDriver(
  driver: DriverSnapshot,
  reason: string,
): DriverSnapshot {
  if (!reason || reason.trim().length === 0) {
    throw new DriverStateError({
      code: "SUSPENDED_REQUIRES_REASON",
      detail: "Suspension requires a non-empty reason for audit.",
    });
  }
  return {
    ...driver,
    status: "suspended",
    suspendedAt: new Date(),
    suspendedReason: reason,
  };
}

export function reinstateDriver(driver: DriverSnapshot): DriverSnapshot {
  if (driver.status !== "suspended") {
    throw new DriverStateError({
      code: "ILLEGAL_TRANSITION",
      detail: `Cannot reinstate driver in state ${driver.status}.`,
    });
  }
  return {
    ...driver,
    status: "documents_pending",   // must re-verify after any suspension
    suspendedAt: null,
    suspendedReason: null,
  };
}

/**
 * True if the driver is eligible to appear in dispatch matching. This does NOT
 * bypass the Stage B activation flag · the dispatch layer applies that check
 * separately.
 */
export function isDriverEligibleForDispatch(driver: DriverSnapshot): boolean {
  return driver.status === "documents_verified";
}

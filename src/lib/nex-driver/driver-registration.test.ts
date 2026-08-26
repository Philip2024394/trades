// src/lib/nex-driver/driver-registration.test.ts

import { describe, it, expect } from "vitest";
import {
  onDocumentUploaded,
  attemptVerifyDriver,
  onDocumentInvalidated,
  suspendDriver,
  reinstateDriver,
  isDriverEligibleForDispatch,
  UNIVERSAL_REQUIRED_DOCUMENTS,
  DriverStateError,
  type DriverSnapshot,
  type DocumentSnapshot,
} from "./driver-registration";
import type { DriverDocumentKind } from "./driver-network-types";

function mkDriver(overrides: Partial<DriverSnapshot> = {}): DriverSnapshot {
  return {
    driverId: "d-1",
    status: "registered",
    vehicleKind: null,
    suspendedAt: null,
    suspendedReason: null,
    documents: [],
    ...overrides,
  };
}

function mkDoc(kind: DriverDocumentKind, state: DocumentSnapshot["state"] = "verified"): DocumentSnapshot {
  return {
    documentId: `doc-${kind}`,
    kind,
    state,
    uploadedAt: new Date("2026-08-01T00:00:00Z"),
    verifiedAt: state === "verified" ? new Date("2026-08-05T00:00:00Z") : null,
    expiresAt: null,
  };
}

describe("Registration · onDocumentUploaded moves registered → documents_pending", () => {
  it("registered → documents_pending", () => {
    const after = onDocumentUploaded(mkDriver({ status: "registered" }));
    expect(after.status).toBe("documents_pending");
  });

  it("documents_verified → documents_pending (re-verification required)", () => {
    const after = onDocumentUploaded(mkDriver({ status: "documents_verified" }));
    expect(after.status).toBe("documents_pending");
  });

  it("throws for suspended drivers", () => {
    expect(() => onDocumentUploaded(mkDriver({ status: "suspended" }))).toThrow(DriverStateError);
  });
});

describe("Registration · attemptVerifyDriver requires every required document AND vehicle_kind", () => {
  it("throws when a required document is missing", () => {
    const missing: DriverSnapshot = mkDriver({
      vehicleKind: "motorbike",
      documents: UNIVERSAL_REQUIRED_DOCUMENTS.slice(0, -1).map((k) => mkDoc(k)),
    });
    expect(() => attemptVerifyDriver(missing)).toThrow(DriverStateError);
  });

  it("throws when a required document is not yet verified", () => {
    const notYet: DriverSnapshot = mkDriver({
      vehicleKind: "motorbike",
      documents: UNIVERSAL_REQUIRED_DOCUMENTS.map((k) =>
        mkDoc(k, k === "vehicle_insurance" ? "uploaded" : "verified"),
      ),
    });
    expect(() => attemptVerifyDriver(notYet)).toThrow(DriverStateError);
  });

  it("throws when vehicle_kind is null even with all documents verified", () => {
    const noVehicle: DriverSnapshot = mkDriver({
      vehicleKind: null,
      documents: UNIVERSAL_REQUIRED_DOCUMENTS.map((k) => mkDoc(k, "verified")),
    });
    expect(() => attemptVerifyDriver(noVehicle)).toThrow(/vehicle_kind/i);
  });

  it("succeeds when all universal docs verified + vehicle set", () => {
    const ok: DriverSnapshot = mkDriver({
      vehicleKind: "motorbike",
      documents: UNIVERSAL_REQUIRED_DOCUMENTS.map((k) => mkDoc(k, "verified")),
    });
    const after = attemptVerifyDriver(ok);
    expect(after.status).toBe("documents_verified");
  });

  it("enforces additional jurisdiction-required documents", () => {
    const missingHealthDecl: DriverSnapshot = mkDriver({
      vehicleKind: "motorbike",
      documents: UNIVERSAL_REQUIRED_DOCUMENTS.map((k) => mkDoc(k, "verified")),
    });
    expect(() => attemptVerifyDriver(missingHealthDecl, ["health_declaration"])).toThrow(DriverStateError);
  });

  it("throws when driver is suspended", () => {
    expect(() =>
      attemptVerifyDriver(
        mkDriver({
          status: "suspended",
          vehicleKind: "car",
          documents: UNIVERSAL_REQUIRED_DOCUMENTS.map((k) => mkDoc(k, "verified")),
        }),
      ),
    ).toThrow(DriverStateError);
  });
});

describe("Registration · onDocumentInvalidated demotes verified drivers back to pending", () => {
  it("verified → pending", () => {
    const after = onDocumentInvalidated(mkDriver({ status: "documents_verified" }));
    expect(after.status).toBe("documents_pending");
  });

  it("pending stays pending", () => {
    const after = onDocumentInvalidated(mkDriver({ status: "documents_pending" }));
    expect(after.status).toBe("documents_pending");
  });
});

describe("Registration · suspension + reinstatement", () => {
  it("suspend requires a non-empty reason", () => {
    expect(() => suspendDriver(mkDriver(), "")).toThrow(/reason/i);
    expect(() => suspendDriver(mkDriver(), "   ")).toThrow(/reason/i);
  });

  it("suspend writes suspended_at + reason together", () => {
    const after = suspendDriver(mkDriver({ status: "documents_verified" }), "safety complaint");
    expect(after.status).toBe("suspended");
    expect(after.suspendedAt).toBeTruthy();
    expect(after.suspendedReason).toBe("safety complaint");
  });

  it("reinstate from suspended → documents_pending (must re-verify)", () => {
    const suspended = suspendDriver(mkDriver({ status: "documents_verified" }), "test");
    const after = reinstateDriver(suspended);
    expect(after.status).toBe("documents_pending");
    expect(after.suspendedAt).toBeNull();
    expect(after.suspendedReason).toBeNull();
  });

  it("reinstate throws when driver is not suspended", () => {
    expect(() => reinstateDriver(mkDriver({ status: "documents_verified" }))).toThrow(DriverStateError);
  });
});

describe("Registration · isDriverEligibleForDispatch only true when verified", () => {
  it("verified → true", () => {
    expect(isDriverEligibleForDispatch(mkDriver({ status: "documents_verified" }))).toBe(true);
  });
  it("registered / pending / suspended → false", () => {
    expect(isDriverEligibleForDispatch(mkDriver({ status: "registered" }))).toBe(false);
    expect(isDriverEligibleForDispatch(mkDriver({ status: "documents_pending" }))).toBe(false);
    expect(isDriverEligibleForDispatch(mkDriver({ status: "suspended" }))).toBe(false);
  });
});

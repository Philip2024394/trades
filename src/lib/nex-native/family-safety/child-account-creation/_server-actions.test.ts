// src/lib/nex-native/family-safety/child-account-creation/_server-actions.test.ts
//
// Unit tests for the Child Account Creation server actions. Mocks the
// session boundary + all four services so each action's gating logic
// is verified without touching real DB or Supabase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────
// Mocks · session + services. All vi.mock factories must be
// self-contained (no top-level var references) because they are
// hoisted before module-level code runs.
// ─────────────────────────────────────────────────────────────────────

const sessionState: { current: { account: { id: string } } | null } = {
  current: null,
};

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: async () => sessionState.current,
}));

const callLog: Array<{ fn: string; args: unknown }> = [];

function record(fn: string, args: unknown): void {
  callLog.push({ fn, args });
}

vi.mock("./child-account-creation-service", () => {
  const dummyRequest = {
    requestId: "req-1",
    parentAccountId: "parent-1",
    childDisplayName: "Kid",
    childDeclaredDateOfBirth: "2015-05-10",
    idSubmissionId: null,
    state: "draft" as const,
    createdChildAccountId: null,
    rejectionReason: null,
    rejectionReasonCode: null,
    createdAt: "2026-10-10T10:00:00.000Z",
    expiresAt: "2026-11-09T10:00:00.000Z",
    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    simulated: true,
  };
  return {
    createChildCreationRequest: (args: unknown) => {
      callLog.push({ fn: "createChildCreationRequest", args });
      return Promise.resolve(dummyRequest);
    },
    attachIdSubmission: (args: unknown) => {
      callLog.push({ fn: "attachIdSubmission", args });
      return Promise.resolve({
        ...dummyRequest,
        state: "id_pending_verification",
        idSubmissionId: "sub-1",
      });
    },
    transitionCreationState: (args: unknown) => {
      callLog.push({ fn: "transitionCreationState", args });
      return Promise.resolve({ ...dummyRequest, state: "cancelled" });
    },
    cancelRequest: (requestId: string, actorAccountId: string, reason?: string) => {
      callLog.push({ fn: "cancelRequest", args: { requestId, actorAccountId, reason } });
      return Promise.resolve({ ...dummyRequest, state: "cancelled" });
    },
    getRequestById: (requestId: string, viewerAccountId: string) => {
      callLog.push({ fn: "getRequestById", args: { requestId, viewerAccountId } });
      return Promise.resolve(dummyRequest);
    },
    listRequestsForParent: (parentAccountId: string) => {
      callLog.push({ fn: "listRequestsForParent", args: { parentAccountId } });
      return Promise.resolve([dummyRequest]);
    },
    materialiseChildAccount: (args: unknown) => {
      callLog.push({ fn: "materialiseChildAccount", args });
      return Promise.resolve({
        ...dummyRequest,
        state: "awaiting_legal_clearance",
      });
    },
  };
});

vi.mock("../custody/parent-custody-service", () => {
  const dummyCustody = {
    custodyId: "cus-1",
    parentAccountId: "parent-1",
    childAccountId: "child-1",
    linkType: "created_minor" as const,
    isMinor: true,
    createdAt: "2026-10-10T10:00:00.000Z",
    autoTransferAt: "2031-05-10T00:00:00.000Z",
    transferredAt: null,
    revokedAt: null,
    revokedReason: null,
    simulated: true,
  };
  return {
    listCustodiesForParent: (parentAccountId: string) => {
      callLog.push({ fn: "listCustodiesForParent", args: { parentAccountId } });
      return Promise.resolve([dummyCustody]);
    },
    getCustodyById: (custodyId: string, viewerAccountId: string) => {
      callLog.push({ fn: "getCustodyById", args: { custodyId, viewerAccountId } });
      return Promise.resolve(dummyCustody);
    },
    revokeCustody: (custodyId: string, actorAccountId: string, reason: string) => {
      callLog.push({ fn: "revokeCustody", args: { custodyId, actorAccountId, reason } });
      return Promise.resolve({
        ...dummyCustody,
        revokedAt: "2026-10-10T11:00:00.000Z",
      });
    },
    requestPasswordResetForChild: (args: unknown) => {
      callLog.push({ fn: "requestPasswordResetForChild", args });
      return Promise.resolve({
        resetTokenRefOpaque: "nex-child-reset:x",
        expiresAt: "2026-10-10T11:00:00.000Z",
      });
    },
    completePasswordResetForChild: (args: unknown) => {
      callLog.push({ fn: "completePasswordResetForChild", args });
      return Promise.resolve(undefined);
    },
  };
});

vi.mock("../custody/parent-custody-audit-log-service", () => ({
  appendAuditEntry: (args: unknown) => {
    callLog.push({ fn: "appendAuditEntry", args });
    return Promise.resolve({});
  },
  readRecentForCustody: (custodyId: string, viewerAccountId: string, limit?: number) => {
    callLog.push({ fn: "readRecentForCustody", args: { custodyId, viewerAccountId, limit } });
    return Promise.resolve([]);
  },
}));

vi.mock("../id-verifier/id-verification-storage", () => ({
  submitDocument: (args: unknown) => {
    callLog.push({ fn: "submitDocument", args });
    return Promise.resolve({
      submissionId: "sub-1",
      storageRef: "nex-id-blob:sub-1",
      sha256: "a".repeat(64),
    });
  },
}));

// Import AFTER mocks.
import {
  cancelRequestAction,
  createChildCreationRequestAction,
  getCustodyByIdAction,
  getRequestByIdAction,
  isChildCreateLiveModeEnabledAction,
  listCustodiesForParentAction,
  listRequestsForParentAction,
  materialiseChildAccountAction,
  readRecentAuditForCustodyAction,
  requestPasswordResetForChildAction,
  revokeCustodyAction,
  transitionCreationStateAction,
  uploadIdDocumentAction,
} from "./_server-actions";
import { CHILD_CREATION_ERROR_CODES } from "./types";

const UI_FLAG = "NEX_FAMILY_SAFETY_CHILD_CREATE_UI_ENABLED";
const LIVE_FLAG = "NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE";

let originalUi: string | undefined;
let originalLive: string | undefined;

beforeEach(() => {
  callLog.length = 0;
  sessionState.current = { account: { id: "parent-1" } };
  originalUi = process.env[UI_FLAG];
  originalLive = process.env[LIVE_FLAG];
  delete process.env[UI_FLAG];
  delete process.env[LIVE_FLAG];
});

afterEach(() => {
  if (originalUi === undefined) delete process.env[UI_FLAG];
  else process.env[UI_FLAG] = originalUi;
  if (originalLive === undefined) delete process.env[LIVE_FLAG];
  else process.env[LIVE_FLAG] = originalLive;
});

// ─────────────────────────────────────────────────────────────────────
// Session gating
// ─────────────────────────────────────────────────────────────────────

describe("session gating", () => {
  it("returns unauthenticated when there is no session", async () => {
    sessionState.current = null;
    const result = await createChildCreationRequestAction({
      childDisplayName: "Kid",
      childDeclaredDateOfBirth: "2015-05-10",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("child-creation.unauthenticated");
  });

  it("returns ui_disabled when the UI flag is OFF", async () => {
    process.env[UI_FLAG] = "false";
    const result = await createChildCreationRequestAction({
      childDisplayName: "Kid",
      childDeclaredDateOfBirth: "2015-05-10",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("child-creation.ui_disabled");
  });

  it("list / get actions do NOT require the UI flag", async () => {
    process.env[UI_FLAG] = "false";
    const result = await listRequestsForParentAction();
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Actor derivation
// ─────────────────────────────────────────────────────────────────────

describe("actor derivation", () => {
  it("createChildCreationRequestAction forces actor = resolved viewer", async () => {
    await createChildCreationRequestAction({
      childDisplayName: "Kid",
      childDeclaredDateOfBirth: "2015-05-10",
    });
    const call = callLog.find((c) => c.fn === "createChildCreationRequest");
    expect(call).toBeTruthy();
    const args = call?.args as Record<string, string>;
    expect(args.parentAccountId).toBe("parent-1");
    expect(args.actorAccountId).toBe("parent-1");
  });

  it("transitionCreationStateAction passes actorAccountId from session", async () => {
    await transitionCreationStateAction({
      requestId: "req-1",
      nextState: "cancelled",
    });
    const call = callLog.find((c) => c.fn === "transitionCreationState");
    expect((call?.args as Record<string, unknown>).actorAccountId).toBe("parent-1");
  });

  it("revokeCustodyAction forwards resolved actor positionally", async () => {
    const result = await revokeCustodyAction({
      custodyId: "cus-1",
      reason: "parent asked",
    });
    expect(result.ok).toBe(true);
    const call = callLog.find((c) => c.fn === "revokeCustody");
    const args = call?.args as Record<string, string>;
    expect(args.custodyId).toBe("cus-1");
    expect(args.actorAccountId).toBe("parent-1");
    expect(args.reason).toBe("parent asked");
  });

  it("requestPasswordResetForChildAction uses the resolved actor", async () => {
    const result = await requestPasswordResetForChildAction({ custodyId: "cus-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resetTokenRefOpaque.startsWith("nex-child-reset:")).toBe(true);
      expect("password" in result.value).toBe(false);
      expect("plaintext" in result.value).toBe(false);
    }
    const call = callLog.find((c) => c.fn === "requestPasswordResetForChild");
    expect((call?.args as Record<string, unknown>).actorAccountId).toBe("parent-1");
  });
});

// ─────────────────────────────────────────────────────────────────────
// uploadIdDocumentAction
// ─────────────────────────────────────────────────────────────────────

describe("uploadIdDocumentAction", () => {
  it("normalises UI document type to DB token", async () => {
    const result = await uploadIdDocumentAction({
      requestId: "req-1",
      documentType: "kk",
      documentBytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      idempotencyKey: "idem-1",
    });
    expect(result.ok).toBe(true);
    const call = callLog.find((c) => c.fn === "submitDocument");
    expect((call?.args as Record<string, unknown>).documentType).toBe("indonesian_kk");
  });

  it("returns submissionId + updated request to the UI", async () => {
    const result = await uploadIdDocumentAction({
      requestId: "req-1",
      documentType: "passport",
      documentBytes: new Uint8Array([9]),
      mimeType: "image/png",
      idempotencyKey: "idem-2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.submissionId).toBe("sub-1");
      expect(result.value.request.idSubmissionId).toBe("sub-1");
    }
  });

  it("maps 'akta' UI token to 'indonesian_akta' DB token", async () => {
    await uploadIdDocumentAction({
      requestId: "req-1",
      documentType: "akta",
      documentBytes: new Uint8Array([1]),
      mimeType: "image/png",
      idempotencyKey: "idem-akta",
    });
    const call = callLog.find((c) => c.fn === "submitDocument");
    expect((call?.args as Record<string, unknown>).documentType).toBe("indonesian_akta");
  });

  it("maps 'birth_certificate' UI token to DB token", async () => {
    await uploadIdDocumentAction({
      requestId: "req-1",
      documentType: "birth_certificate",
      documentBytes: new Uint8Array([1]),
      mimeType: "image/png",
      idempotencyKey: "idem-bc",
    });
    const call = callLog.find((c) => c.fn === "submitDocument");
    expect((call?.args as Record<string, unknown>).documentType).toBe(
      "indonesian_birth_certificate",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Flag introspection
// ─────────────────────────────────────────────────────────────────────

describe("isChildCreateLiveModeEnabledAction", () => {
  it("returns FALSE by default", async () => {
    const result = await isChildCreateLiveModeEnabledAction();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(false);
  });

  it("returns TRUE when the env flag is literal 'true'", async () => {
    process.env[LIVE_FLAG] = "true";
    const result = await isChildCreateLiveModeEnabledAction();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Read-only passthroughs (shape checks)
// ─────────────────────────────────────────────────────────────────────

describe("read-only passthroughs", () => {
  it("getRequestByIdAction returns the service result", async () => {
    const result = await getRequestByIdAction({ requestId: "req-1" });
    expect(result.ok).toBe(true);
  });

  it("listCustodiesForParentAction returns the service result", async () => {
    const result = await listCustodiesForParentAction();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBe(1);
  });

  it("getCustodyByIdAction returns the service result", async () => {
    const result = await getCustodyByIdAction({ custodyId: "cus-1" });
    expect(result.ok).toBe(true);
  });

  it("readRecentAuditForCustodyAction returns [] by default", async () => {
    const result = await readRecentAuditForCustodyAction({
      custodyId: "cus-1",
      limit: 10,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("cancelRequestAction forwards to cancelRequest", async () => {
    const result = await cancelRequestAction({ requestId: "req-1", reason: "r" });
    expect(result.ok).toBe(true);
    const call = callLog.find((c) => c.fn === "cancelRequest");
    expect(call).toBeTruthy();
  });

  it("materialiseChildAccountAction forwards to materialiseChildAccount", async () => {
    const result = await materialiseChildAccountAction({ requestId: "req-1" });
    expect(result.ok).toBe(true);
    const call = callLog.find((c) => c.fn === "materialiseChildAccount");
    expect(call).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Error mapping
// ─────────────────────────────────────────────────────────────────────

describe("error mapping", () => {
  it("maps unknown errors to child-creation.internal_error", async () => {
    const svc = await import("./child-account-creation-service");
    vi.spyOn(svc, "createChildCreationRequest").mockRejectedValueOnce(
      new Error("boom · unexpected"),
    );
    const result = await createChildCreationRequestAction({
      childDisplayName: "Kid",
      childDeclaredDateOfBirth: "2015-05-10",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("child-creation.internal_error");
  });

  it("passes through known CHILD_CREATION_ERROR_CODES verbatim", async () => {
    const svc = await import("./child-account-creation-service");
    vi.spyOn(svc, "createChildCreationRequest").mockRejectedValueOnce(
      new Error(CHILD_CREATION_ERROR_CODES.INVALID_DISPLAY_NAME),
    );
    const result = await createChildCreationRequestAction({
      childDisplayName: "",
      childDeclaredDateOfBirth: "2015-05-10",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(
      CHILD_CREATION_ERROR_CODES.INVALID_DISPLAY_NAME,
    );
  });
});

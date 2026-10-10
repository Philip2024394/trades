// src/lib/nex-native/family-safety/child-account-creation/child-account-creation-service.test.ts
//
// Unit tests for the Child Account Creation request service. Mocks
// @/lib/nex/db · never touches a real database.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResponder = (
  sql: string,
  params: readonly unknown[],
) => { rows: Record<string, unknown>[]; rowCount: number };

let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponder: QueryResponder | null;
let withClientUnavailable: boolean;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    if (withClientUnavailable) return null;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        withClientCalls.push({ sql, params: params ?? [] });
        if (withClientResponder) return withClientResponder(sql, params ?? []);
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

// Import AFTER mocks.
import {
  createChildCreationRequest,
  attachIdSubmission,
  transitionCreationState,
  getRequestById,
  listRequestsForParent,
  cancelRequest,
  materialiseChildAccount,
} from "./child-account-creation-service";
import { CHILD_CREATION_ERROR_CODES } from "./types";

const PARENT = "parent-11111111-1111-4111-8111-111111111111";
const OTHER = "other-22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const SUBMISSION_ID = "44444444-4444-4444-4444-444444444444";
const CHILD_NAME = "Testing Smith";
const DOB = "2015-05-10"; // 10 y old
const LIVE_FLAG = "NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    request_id: REQUEST_ID,
    parent_account_id: PARENT,
    child_display_name: CHILD_NAME,
    child_declared_date_of_birth: new Date(`${DOB}T00:00:00Z`),
    id_submission_id: null,
    state: "draft",
    created_child_account_id: null,
    rejection_reason: null,
    rejection_reason_code: null,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    verified_at: null,
    approved_at: null,
    rejected_at: null,
    cancelled_at: null,
    expires_at: new Date("2026-11-09T10:00:00Z"),
    ...overrides,
  };
}

let originalLive: string | undefined;
beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
  originalLive = process.env[LIVE_FLAG];
  delete process.env[LIVE_FLAG];
});

afterEach(() => {
  if (originalLive === undefined) delete process.env[LIVE_FLAG];
  else process.env[LIVE_FLAG] = originalLive;
});

describe("createChildCreationRequest", () => {
  it("inserts a row with state=draft and simulated=TRUE", async () => {
    withClientResponder = () => ({ rows: [row()], rowCount: 1 });
    const result = await createChildCreationRequest({
      parentAccountId: PARENT,
      actorAccountId: PARENT,
      childDisplayName: CHILD_NAME,
      childDeclaredDateOfBirth: DOB,
    });
    expect(result.state).toBe("draft");
    expect(result.simulated).toBe(true);
    expect(result.parentAccountId).toBe(PARENT);
    expect(withClientCalls[0].sql).toMatch(/INSERT\s+INTO\s+nex\.child_account_creation_request/i);
    expect(withClientCalls[0].sql).toMatch(/'draft'/);
    expect(withClientCalls[0].sql).toMatch(/TRUE\)/);
  });

  it("throws ACTOR_NOT_PARENT when actor != parent", async () => {
    withClientResponder = () => ({ rows: [row()], rowCount: 1 });
    await expect(
      createChildCreationRequest({
        parentAccountId: PARENT,
        actorAccountId: OTHER,
        childDisplayName: CHILD_NAME,
        childDeclaredDateOfBirth: DOB,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });

  it("throws INVALID_DISPLAY_NAME when name is empty", async () => {
    await expect(
      createChildCreationRequest({
        parentAccountId: PARENT,
        actorAccountId: PARENT,
        childDisplayName: "   ",
        childDeclaredDateOfBirth: DOB,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_DISPLAY_NAME);
  });

  it("throws INVALID_DISPLAY_NAME when name > 60 chars", async () => {
    await expect(
      createChildCreationRequest({
        parentAccountId: PARENT,
        actorAccountId: PARENT,
        childDisplayName: "x".repeat(61),
        childDeclaredDateOfBirth: DOB,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_DISPLAY_NAME);
  });

  it("throws INVALID_DOB on malformed input", async () => {
    await expect(
      createChildCreationRequest({
        parentAccountId: PARENT,
        actorAccountId: PARENT,
        childDisplayName: CHILD_NAME,
        childDeclaredDateOfBirth: "2015/05/10",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  });

  it("throws INVALID_DOB on future dates", async () => {
    await expect(
      createChildCreationRequest({
        parentAccountId: PARENT,
        actorAccountId: PARENT,
        childDisplayName: CHILD_NAME,
        childDeclaredDateOfBirth: "2099-01-01",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  });

  it("throws INVALID_DOB on dates before 1900-01-02", async () => {
    await expect(
      createChildCreationRequest({
        parentAccountId: PARENT,
        actorAccountId: PARENT,
        childDisplayName: CHILD_NAME,
        childDeclaredDateOfBirth: "1899-12-31",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  });

  it("throws INVALID_PARENT when parent id is empty", async () => {
    await expect(
      createChildCreationRequest({
        parentAccountId: "",
        actorAccountId: "",
        childDisplayName: CHILD_NAME,
        childDeclaredDateOfBirth: DOB,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_PARENT);
  });
});

describe("attachIdSubmission", () => {
  it("transitions draft → id_pending_verification + attaches submission", async () => {
    const calls: string[] = [];
    withClientResponder = (sql) => {
      calls.push(sql);
      if (/SELECT \*/.test(sql)) {
        return { rows: [row({ state: "draft" })], rowCount: 1 };
      }
      // UPDATE
      return {
        rows: [row({ state: "id_pending_verification", id_submission_id: SUBMISSION_ID })],
        rowCount: 1,
      };
    };
    const result = await attachIdSubmission({
      requestId: REQUEST_ID,
      submissionId: SUBMISSION_ID,
      actorAccountId: PARENT,
    });
    expect(result.state).toBe("id_pending_verification");
    expect(result.idSubmissionId).toBe(SUBMISSION_ID);
    expect(calls.some((s) => /UPDATE\s+nex\.child_account_creation_request/i.test(s))).toBe(
      true,
    );
  });

  it("throws REQUEST_NOT_FOUND when request absent", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      attachIdSubmission({
        requestId: REQUEST_ID,
        submissionId: SUBMISSION_ID,
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.REQUEST_NOT_FOUND);
  });

  it("throws ACTOR_NOT_PARENT when actor is not the parent", async () => {
    withClientResponder = () => ({ rows: [row({ state: "draft" })], rowCount: 1 });
    await expect(
      attachIdSubmission({
        requestId: REQUEST_ID,
        submissionId: SUBMISSION_ID,
        actorAccountId: OTHER,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });

  it("rejects attachment on a terminal state", async () => {
    withClientResponder = () => ({ rows: [row({ state: "cancelled" })], rowCount: 1 });
    await expect(
      attachIdSubmission({
        requestId: REQUEST_ID,
        submissionId: SUBMISSION_ID,
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  });
});

describe("transitionCreationState", () => {
  it("allows id_pending_verification → id_verified", async () => {
    withClientResponder = (sql) => {
      if (/SELECT \*/.test(sql)) {
        return { rows: [row({ state: "id_pending_verification" })], rowCount: 1 };
      }
      return { rows: [row({ state: "id_verified" })], rowCount: 1 };
    };
    const result = await transitionCreationState({
      requestId: REQUEST_ID,
      nextState: "id_verified",
      actorAccountId: PARENT,
    });
    expect(result.state).toBe("id_verified");
  });

  it("refuses id_rejected → id_verified (terminal state)", async () => {
    withClientResponder = () => ({ rows: [row({ state: "id_rejected" })], rowCount: 1 });
    await expect(
      transitionCreationState({
        requestId: REQUEST_ID,
        nextState: "id_verified",
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  });

  it("refuses actor != parent", async () => {
    withClientResponder = () =>
      ({ rows: [row({ state: "id_pending_verification" })], rowCount: 1 });
    await expect(
      transitionCreationState({
        requestId: REQUEST_ID,
        nextState: "id_verified",
        actorAccountId: OTHER,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });

  it("stamps verified_at only for state=id_verified", async () => {
    const updateCalls: Array<readonly unknown[]> = [];
    withClientResponder = (sql, params) => {
      if (/UPDATE/.test(sql)) {
        updateCalls.push(params);
        return { rows: [row({ state: "id_verified" })], rowCount: 1 };
      }
      return { rows: [row({ state: "id_pending_verification" })], rowCount: 1 };
    };
    await transitionCreationState({
      requestId: REQUEST_ID,
      nextState: "id_verified",
      actorAccountId: PARENT,
    });
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0][1]).toBe("id_verified");
  });

  it("accepts rejection_reason_code for id_rejected", async () => {
    const updateCalls: Array<readonly unknown[]> = [];
    withClientResponder = (sql, params) => {
      if (/UPDATE/.test(sql)) {
        updateCalls.push(params);
        return {
          rows: [row({ state: "id_rejected", rejection_reason_code: "id_unreadable" })],
          rowCount: 1,
        };
      }
      return { rows: [row({ state: "id_pending_verification" })], rowCount: 1 };
    };
    const result = await transitionCreationState({
      requestId: REQUEST_ID,
      nextState: "id_rejected",
      actorAccountId: PARENT,
      reason: "ID blur",
      reasonCode: "id_unreadable",
    });
    expect(result.state).toBe("id_rejected");
    expect(result.rejectionReasonCode).toBe("id_unreadable");
    expect(updateCalls[0][3]).toBe("id_unreadable");
  });

  it("refuses an unknown next state", async () => {
    await expect(
      transitionCreationState({
        requestId: REQUEST_ID,
        // @ts-expect-error purposefully invalid
        nextState: "nope",
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  });
});

describe("getRequestById + listRequestsForParent", () => {
  it("returns null when viewer is not the parent", async () => {
    withClientResponder = () => ({ rows: [row()], rowCount: 1 });
    const result = await getRequestById(REQUEST_ID, OTHER);
    expect(result).toBeNull();
  });

  it("returns the row when viewer == parent", async () => {
    withClientResponder = () => ({ rows: [row()], rowCount: 1 });
    const result = await getRequestById(REQUEST_ID, PARENT);
    expect(result).not.toBeNull();
    expect(result?.requestId).toBe(REQUEST_ID);
  });

  it("returns null when no row matches", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const result = await getRequestById(REQUEST_ID, PARENT);
    expect(result).toBeNull();
  });

  it("listRequestsForParent returns [] when DB unavailable", async () => {
    withClientUnavailable = true;
    const result = await listRequestsForParent(PARENT);
    expect(result).toEqual([]);
  });

  it("listRequestsForParent maps rows", async () => {
    withClientResponder = () => ({
      rows: [row(), row({ state: "cancelled", request_id: "55555555-5555-4555-8555-555555555555" })],
      rowCount: 2,
    });
    const result = await listRequestsForParent(PARENT);
    expect(result.length).toBe(2);
    expect(result[0].parentAccountId).toBe(PARENT);
    expect(result[1].state).toBe("cancelled");
  });
});

describe("cancelRequest", () => {
  it("delegates to transitionCreationState with nextState=cancelled", async () => {
    withClientResponder = (sql) => {
      if (/SELECT \*/.test(sql)) return { rows: [row({ state: "draft" })], rowCount: 1 };
      return { rows: [row({ state: "cancelled" })], rowCount: 1 };
    };
    const result = await cancelRequest(REQUEST_ID, PARENT, "parent change of mind");
    expect(result.state).toBe("cancelled");
  });
});

describe("materialiseChildAccount · flag OFF path", () => {
  it("transitions id_verified → awaiting_legal_clearance when flag OFF", async () => {
    withClientResponder = (sql) => {
      if (/SELECT \*/.test(sql)) {
        return { rows: [row({ state: "id_verified" })], rowCount: 1 };
      }
      return {
        rows: [row({ state: "awaiting_legal_clearance" })],
        rowCount: 1,
      };
    };
    const result = await materialiseChildAccount({
      requestId: REQUEST_ID,
      actorAccountId: PARENT,
    });
    expect(result.state).toBe("awaiting_legal_clearance");
  });

  it("throws ALREADY_MATERIALISED when created_child_account_id already set", async () => {
    withClientResponder = () =>
      ({
        rows: [row({ state: "id_verified", created_child_account_id: "child-xyz" })],
        rowCount: 1,
      });
    await expect(
      materialiseChildAccount({ requestId: REQUEST_ID, actorAccountId: PARENT }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ALREADY_MATERIALISED);
  });

  it("throws ID_NOT_VERIFIED when state is draft", async () => {
    withClientResponder = () => ({ rows: [row({ state: "draft" })], rowCount: 1 });
    await expect(
      materialiseChildAccount({ requestId: REQUEST_ID, actorAccountId: PARENT }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ID_NOT_VERIFIED);
  });

  it("refuses actor != parent", async () => {
    withClientResponder = () => ({ rows: [row({ state: "id_verified" })], rowCount: 1 });
    await expect(
      materialiseChildAccount({ requestId: REQUEST_ID, actorAccountId: OTHER }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });
});

describe("materialiseChildAccount · flag ON path · HONEST GAP", () => {
  it("throws LIVE_MODE_DISABLED even when flag is TRUE (sealed account primitive gap)", async () => {
    process.env[LIVE_FLAG] = "true";
    withClientResponder = () => ({ rows: [row({ state: "id_verified" })], rowCount: 1 });
    await expect(
      materialiseChildAccount({ requestId: REQUEST_ID, actorAccountId: PARENT }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.LIVE_MODE_DISABLED);
  });
});

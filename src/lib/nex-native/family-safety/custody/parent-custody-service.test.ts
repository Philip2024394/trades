// src/lib/nex-native/family-safety/custody/parent-custody-service.test.ts
//
// Unit tests for the Parent Custody service.

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

import {
  computeSixteenthBirthdayIso,
  createCustody,
  getCustodyById,
  listCustodiesForParent,
  requestPasswordResetForChild,
  revokeCustody,
  completePasswordResetForChild,
} from "./parent-custody-service";
import { CHILD_CREATION_ERROR_CODES } from "../child-account-creation/types";

const PARENT = "parent-11111111-1111-4111-8111-111111111111";
const CHILD = "child-22222222-2222-4222-8222-222222222222";
const OTHER = "other-33333333-3333-4333-8333-333333333333";
const CUSTODY_ID = "44444444-4444-4444-4444-444444444444";
const DOB = "2015-05-10";

function custodyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    custody_id: CUSTODY_ID,
    parent_account_id: PARENT,
    child_account_id: CHILD,
    link_type: "created_minor",
    creation_request_id: null,
    auto_transfer_at: new Date("2031-05-10T00:00:00Z"),
    transferred_at: null,
    revoked_at: null,
    revoked_reason: null,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

// ─────────────────────────────────────────────────────────────────────
// computeSixteenthBirthdayIso
// ─────────────────────────────────────────────────────────────────────

describe("computeSixteenthBirthdayIso", () => {
  it("adds exactly 16 years", () => {
    expect(computeSixteenthBirthdayIso("2015-05-10")).toBe(
      "2031-05-10T00:00:00.000Z",
    );
  });

  it("maps leap-day (Feb 29) to Feb 28 in the target year", () => {
    expect(computeSixteenthBirthdayIso("2016-02-29")).toBe(
      "2032-02-28T00:00:00.000Z",
    );
  });

  it("throws on malformed input", () => {
    expect(() => computeSixteenthBirthdayIso("not-a-date")).toThrow(
      CHILD_CREATION_ERROR_CODES.INVALID_DOB,
    );
  });

  it("throws on impossible calendar day", () => {
    expect(() => computeSixteenthBirthdayIso("2015-13-45")).toThrow(
      CHILD_CREATION_ERROR_CODES.INVALID_DOB,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// createCustody
// ─────────────────────────────────────────────────────────────────────

describe("createCustody", () => {
  it("rejects actor != parent", async () => {
    await expect(
      createCustody({
        parentAccountId: PARENT,
        childAccountId: CHILD,
        linkType: "created_minor",
        declaredDateOfBirth: DOB,
        actorAccountId: OTHER,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });

  it("rejects parent == child (self-custody)", async () => {
    await expect(
      createCustody({
        parentAccountId: PARENT,
        childAccountId: PARENT,
        linkType: "created_minor",
        declaredDateOfBirth: DOB,
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.SELF_CUSTODY);
  });

  it("throws DUPLICATE_ACTIVE_CUSTODY when an active row already exists", async () => {
    withClientResponder = (sql) => {
      if (/SELECT custody_id/.test(sql)) {
        return { rows: [{ custody_id: "existing" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      createCustody({
        parentAccountId: PARENT,
        childAccountId: CHILD,
        linkType: "created_minor",
        declaredDateOfBirth: DOB,
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.DUPLICATE_ACTIVE_CUSTODY);
  });

  it("inserts with link_type and simulated=TRUE · emits audit entry + minor profile", async () => {
    withClientResponder = (sql) => {
      if (/SELECT custody_id/.test(sql)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO nex\.parent_custody_link/i.test(sql)) {
        return { rows: [custodyRow()], rowCount: 1 };
      }
      if (/INSERT INTO nex\.account_minor_profile/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/INSERT INTO nex\.parent_custody_audit_log/i.test(sql)) {
        return { rows: [{
          audit_id: "a-1",
          custody_id: CUSTODY_ID,
          parent_account_id: PARENT,
          child_account_id: CHILD,
          action: "custody_created",
          action_details_redacted: "link_type=created_minor",
          simulated: true,
          performed_at: new Date(),
        }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await createCustody({
      parentAccountId: PARENT,
      childAccountId: CHILD,
      linkType: "created_minor",
      declaredDateOfBirth: DOB,
      actorAccountId: PARENT,
    });
    expect(result.custodyId).toBe(CUSTODY_ID);
    expect(result.linkType).toBe("created_minor");
    expect(result.simulated).toBe(true);
    const sawInsert = withClientCalls.some((c) =>
      /INSERT INTO nex\.parent_custody_link/i.test(c.sql),
    );
    const sawMinor = withClientCalls.some((c) =>
      /INSERT INTO nex\.account_minor_profile/i.test(c.sql),
    );
    const sawAudit = withClientCalls.some((c) =>
      /INSERT INTO nex\.parent_custody_audit_log/i.test(c.sql),
    );
    expect(sawInsert).toBe(true);
    expect(sawMinor).toBe(true);
    expect(sawAudit).toBe(true);
  });

  it("rejects invalid DOB (malformed)", async () => {
    await expect(
      createCustody({
        parentAccountId: PARENT,
        childAccountId: CHILD,
        linkType: "created_minor",
        declaredDateOfBirth: "not-a-date",
        actorAccountId: PARENT,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_DOB);
  });
});

// ─────────────────────────────────────────────────────────────────────
// listCustodiesForParent + getCustodyById
// ─────────────────────────────────────────────────────────────────────

describe("listCustodiesForParent + getCustodyById", () => {
  it("listCustodiesForParent returns [] when no rows", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const result = await listCustodiesForParent(PARENT);
    expect(result).toEqual([]);
  });

  it("listCustodiesForParent maps rows", async () => {
    withClientResponder = () => ({
      rows: [custodyRow(), custodyRow({ custody_id: "other", revoked_at: new Date() })],
      rowCount: 2,
    });
    const result = await listCustodiesForParent(PARENT);
    expect(result.length).toBe(2);
    expect(result[0].parentAccountId).toBe(PARENT);
  });

  it("getCustodyById returns null when viewer != parent", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    const result = await getCustodyById(CUSTODY_ID, OTHER);
    expect(result).toBeNull();
  });

  it("getCustodyById returns the row for the parent", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    const result = await getCustodyById(CUSTODY_ID, PARENT);
    expect(result?.custodyId).toBe(CUSTODY_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────
// revokeCustody
// ─────────────────────────────────────────────────────────────────────

describe("revokeCustody", () => {
  it("stamps revoked_at + revoked_reason", async () => {
    withClientResponder = (sql) => {
      if (/SELECT \* FROM nex\.parent_custody_link/i.test(sql)) {
        return { rows: [custodyRow()], rowCount: 1 };
      }
      if (/UPDATE nex\.parent_custody_link/i.test(sql)) {
        return {
          rows: [custodyRow({ revoked_at: new Date(), revoked_reason: "parent asked" })],
          rowCount: 1,
        };
      }
      // audit
      return { rows: [{
        audit_id: "a-1",
        custody_id: CUSTODY_ID,
        parent_account_id: PARENT,
        child_account_id: CHILD,
        action: "custody_revoked",
        action_details_redacted: null,
        simulated: true,
        performed_at: new Date(),
      }], rowCount: 1 };
    };
    const result = await revokeCustody(CUSTODY_ID, PARENT, "parent asked");
    expect(result.revokedAt).not.toBeNull();
    expect(result.revokedReason).toBe("parent asked");
  });

  it("throws CUSTODY_NOT_FOUND when custody missing", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(revokeCustody(CUSTODY_ID, PARENT, "r")).rejects.toThrow(
      CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND,
    );
  });

  it("throws ACTOR_NOT_PARENT when actor is not parent", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    await expect(revokeCustody(CUSTODY_ID, OTHER, "r")).rejects.toThrow(
      CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT,
    );
  });

  it("throws CUSTODY_NOT_ACTIVE when already revoked", async () => {
    withClientResponder = () =>
      ({ rows: [custodyRow({ revoked_at: new Date() })], rowCount: 1 });
    await expect(revokeCustody(CUSTODY_ID, PARENT, "r")).rejects.toThrow(
      CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_ACTIVE,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// requestPasswordResetForChild
// ─────────────────────────────────────────────────────────────────────

describe("requestPasswordResetForChild", () => {
  it("returns an opaque token ref · never plaintext", async () => {
    withClientResponder = (sql) => {
      if (/SELECT \* FROM nex\.parent_custody_link/i.test(sql)) {
        return { rows: [custodyRow()], rowCount: 1 };
      }
      return { rows: [{
        audit_id: "a-1",
        custody_id: CUSTODY_ID,
        parent_account_id: PARENT,
        child_account_id: CHILD,
        action: "password_reset_requested",
        action_details_redacted: null,
        simulated: true,
        performed_at: new Date(),
      }], rowCount: 1 };
    };
    const result = await requestPasswordResetForChild({
      custodyId: CUSTODY_ID,
      actorAccountId: PARENT,
    });
    expect(result.resetTokenRefOpaque.startsWith("nex-child-reset:")).toBe(true);
    // Shape guard · the ticket exposes no password / plaintext field.
    expect("password" in result).toBe(false);
    expect("plaintext" in result).toBe(false);
    expect("newPassword" in result).toBe(false);
    const sawAudit = withClientCalls.some((c) =>
      /INSERT INTO nex\.parent_custody_audit_log/i.test(c.sql),
    );
    expect(sawAudit).toBe(true);
  });

  it("throws ACTOR_NOT_PARENT when actor != parent", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    await expect(
      requestPasswordResetForChild({ custodyId: CUSTODY_ID, actorAccountId: OTHER }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });

  it("throws CUSTODY_NOT_ACTIVE when custody is revoked", async () => {
    withClientResponder = () =>
      ({ rows: [custodyRow({ revoked_at: new Date() })], rowCount: 1 });
    await expect(
      requestPasswordResetForChild({ custodyId: CUSTODY_ID, actorAccountId: PARENT }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_ACTIVE);
  });

  it("throws CUSTODY_NOT_FOUND when no row matches", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      requestPasswordResetForChild({ custodyId: CUSTODY_ID, actorAccountId: PARENT }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  });
});

// ─────────────────────────────────────────────────────────────────────
// completePasswordResetForChild
// ─────────────────────────────────────────────────────────────────────

describe("completePasswordResetForChild", () => {
  it("writes an audit entry · never persists plaintext", async () => {
    withClientResponder = (sql) => {
      if (/SELECT custody_id, parent_account_id/.test(sql)) {
        return {
          rows: [{
            custody_id: CUSTODY_ID,
            parent_account_id: PARENT,
            child_account_id: CHILD,
            revoked_at: null,
          }],
          rowCount: 1,
        };
      }
      return { rows: [{
        audit_id: "a-1",
        custody_id: CUSTODY_ID,
        parent_account_id: PARENT,
        child_account_id: CHILD,
        action: "password_reset_completed",
        action_details_redacted: null,
        simulated: true,
        performed_at: new Date(),
      }], rowCount: 1 };
    };
    await completePasswordResetForChild({
      resetTokenRefOpaque: "nex-child-reset:x",
      actorAccountId: PARENT,
      custodyId: CUSTODY_ID,
    });
    const auditInsert = withClientCalls.find((c) =>
      /INSERT INTO nex\.parent_custody_audit_log/i.test(c.sql),
    );
    expect(auditInsert).toBeTruthy();
    // No INSERT or UPDATE touches a plaintext credential column.
    for (const c of withClientCalls) {
      expect(c.sql).not.toMatch(/password/i);
      expect(c.sql).not.toMatch(/plaintext/i);
    }
  });

  it("throws ACTOR_NOT_PARENT when actor != parent", async () => {
    withClientResponder = () => ({
      rows: [{
        custody_id: CUSTODY_ID,
        parent_account_id: PARENT,
        child_account_id: CHILD,
        revoked_at: null,
      }],
      rowCount: 1,
    });
    await expect(
      completePasswordResetForChild({
        resetTokenRefOpaque: "nex-child-reset:x",
        actorAccountId: OTHER,
        custodyId: CUSTODY_ID,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.ACTOR_NOT_PARENT);
  });

  it("throws CUSTODY_NOT_FOUND when no row matches", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      completePasswordResetForChild({
        resetTokenRefOpaque: "nex-child-reset:x",
        actorAccountId: PARENT,
        custodyId: CUSTODY_ID,
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  });
});

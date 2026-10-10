// src/lib/nex-native/family-safety/custody/parent-custody-audit-log-service.test.ts
//
// Unit tests for the Parent Custody Audit Log service.

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  appendAuditEntry,
  readRecentForCustody,
} from "./parent-custody-audit-log-service";
import { CHILD_CREATION_ERROR_CODES } from "../child-account-creation/types";

const CUSTODY = "11111111-1111-4111-8111-111111111111";
const PARENT = "parent-22222222-2222-4222-8222-222222222222";
const CHILD = "child-33333333-3333-4333-8333-333333333333";

function auditRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    audit_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    custody_id: CUSTODY,
    parent_account_id: PARENT,
    child_account_id: CHILD,
    action: "custody_created",
    action_details_redacted: null,
    simulated: true,
    performed_at: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

describe("appendAuditEntry", () => {
  it("inserts a row with simulated=TRUE", async () => {
    withClientResponder = () => ({ rows: [auditRow()], rowCount: 1 });
    const result = await appendAuditEntry({
      custodyId: CUSTODY,
      parentAccountId: PARENT,
      childAccountId: CHILD,
      action: "custody_created",
    });
    expect(result.simulated).toBe(true);
    expect(result.action).toBe("custody_created");
    expect(withClientCalls[0].sql).toMatch(/INSERT INTO nex\.parent_custody_audit_log/i);
    expect(withClientCalls[0].sql).toMatch(/TRUE\)/);
  });

  it("redacts email addresses in action_details_redacted", async () => {
    const calls: Array<readonly unknown[]> = [];
    withClientResponder = (_sql, params) => {
      calls.push(params);
      return { rows: [auditRow()], rowCount: 1 };
    };
    await appendAuditEntry({
      custodyId: CUSTODY,
      parentAccountId: PARENT,
      childAccountId: CHILD,
      action: "password_reset_requested",
      actionDetailsRedacted: "sent to parent@example.com",
    });
    const details = calls[0][5] as string;
    expect(details).not.toMatch(/parent@example\.com/);
    expect(details).toMatch(/\[redacted-email\]/);
  });

  it("redacts phone numbers in action_details_redacted", async () => {
    const calls: Array<readonly unknown[]> = [];
    withClientResponder = (_sql, params) => {
      calls.push(params);
      return { rows: [auditRow()], rowCount: 1 };
    };
    await appendAuditEntry({
      custodyId: CUSTODY,
      parentAccountId: PARENT,
      childAccountId: CHILD,
      action: "password_reset_requested",
      actionDetailsRedacted: "SMS sent to +6281234567890",
    });
    const details = calls[0][5] as string;
    expect(details).not.toMatch(/\+6281234567890/);
  });

  it("redacts password / secret / token / credential words", async () => {
    const calls: Array<readonly unknown[]> = [];
    withClientResponder = (_sql, params) => {
      calls.push(params);
      return { rows: [auditRow()], rowCount: 1 };
    };
    await appendAuditEntry({
      custodyId: CUSTODY,
      parentAccountId: PARENT,
      childAccountId: CHILD,
      action: "password_reset_requested",
      actionDetailsRedacted: "new password: hunter2 · secret token credential",
    });
    const details = (calls[0][5] as string).toLowerCase();
    expect(details).not.toMatch(/\bpassword\b/);
    expect(details).not.toMatch(/\bsecret\b/);
    expect(details).not.toMatch(/\btoken\b/);
    expect(details).not.toMatch(/\bcredential\b/);
  });

  it("clamps action_details_redacted to 1000 chars", async () => {
    const calls: Array<readonly unknown[]> = [];
    withClientResponder = (_sql, params) => {
      calls.push(params);
      return { rows: [auditRow()], rowCount: 1 };
    };
    await appendAuditEntry({
      custodyId: CUSTODY,
      parentAccountId: PARENT,
      childAccountId: CHILD,
      action: "custody_created",
      actionDetailsRedacted: "A".repeat(2000),
    });
    const details = calls[0][5] as string;
    expect(details.length).toBeLessThanOrEqual(1000);
  });

  it("stores NULL when actionDetailsRedacted is undefined", async () => {
    const calls: Array<readonly unknown[]> = [];
    withClientResponder = (_sql, params) => {
      calls.push(params);
      return { rows: [auditRow()], rowCount: 1 };
    };
    await appendAuditEntry({
      custodyId: CUSTODY,
      parentAccountId: PARENT,
      childAccountId: CHILD,
      action: "custody_revoked",
    });
    expect(calls[0][5]).toBeNull();
  });

  it("throws on invalid action token", async () => {
    await expect(
      appendAuditEntry({
        custodyId: CUSTODY,
        parentAccountId: PARENT,
        childAccountId: CHILD,
        // @ts-expect-error purposefully invalid
        action: "not-an-action",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.INVALID_STATE_TRANSITION);
  });

  it("throws when custodyId is empty", async () => {
    await expect(
      appendAuditEntry({
        custodyId: "",
        parentAccountId: PARENT,
        childAccountId: CHILD,
        action: "custody_created",
      }),
    ).rejects.toThrow(CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND);
  });
});

describe("readRecentForCustody", () => {
  it("enforces viewer == parent via JOIN on parent_custody_link", async () => {
    withClientResponder = () => ({
      rows: [auditRow(), auditRow({ action: "password_reset_requested" })],
      rowCount: 2,
    });
    const result = await readRecentForCustody(CUSTODY, PARENT, 10);
    expect(result.length).toBe(2);
    expect(withClientCalls[0].sql).toMatch(/JOIN\s+nex\.parent_custody_link/i);
    expect(withClientCalls[0].sql).toMatch(/l\.parent_account_id = \$2/i);
  });

  it("clamps limit to [1, 500]", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await readRecentForCustody(CUSTODY, PARENT, 10000);
    expect(withClientCalls[0].params[2]).toBe(500);
  });

  it("defaults limit to 50", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await readRecentForCustody(CUSTODY, PARENT);
    expect(withClientCalls[0].params[2]).toBe(50);
  });

  it("returns [] when DB unavailable", async () => {
    withClientUnavailable = true;
    const result = await readRecentForCustody(CUSTODY, PARENT);
    expect(result).toEqual([]);
  });

  it("throws when custodyId is empty", async () => {
    await expect(readRecentForCustody("", PARENT)).rejects.toThrow(
      CHILD_CREATION_ERROR_CODES.CUSTODY_NOT_FOUND,
    );
  });
});

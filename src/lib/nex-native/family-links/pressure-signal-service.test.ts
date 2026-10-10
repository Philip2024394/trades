// src/lib/nex-native/family-links/pressure-signal-service.test.ts
//
// Unit tests for FS-2 pressure-signal-service. Mocks @/lib/nex/db so
// the sealed revokeLink and getLinkById compositions can be exercised
// against responder-shaped SQL. No network, no DB.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────
// Mock the shared pg pool.
// ─────────────────────────────────────────────────────────────────────

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
        if (withClientResponder) {
          return withClientResponder(sql, params ?? []);
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  isPressureReasonCode,
  issuePressureSignal,
  listReportsByReporter,
  PRESSURE_REASON_CODES,
  PRESSURE_SIGNAL_ERROR_CODES,
} from "./pressure-signal-service";

const GUARDIAN = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-4444-444444444444";
const REPORT_ID = "66666666-6666-4666-8666-666666666666";

function linkRow(state: string, overrides: Record<string, unknown> = {}) {
  return {
    link_id: LINK_ID,
    guardian_account_id: GUARDIAN,
    child_account_id: CHILD,
    role: "guardian_primary",
    state,
    initiated_by: "guardian_invite",
    initiated_at: new Date("2026-10-10T10:00:00Z"),
    confirmed_at: state === "active" ? new Date("2026-10-10T10:05:00Z") : null,
    revoked_at: null,
    revoked_by: null,
    revoked_reason: null,
    expires_at: null,
    can_see_emergency_alerts: true,
    can_see_safety_summaries: false,
    can_see_location_when_shared: false,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  };
}

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    report_id: REPORT_ID,
    link_id: LINK_ID,
    reporter_account_id: CHILD,
    reason_code: "coerced",
    reason_notes: null,
    reported_against_account_id: GUARDIAN,
    state: "open",
    simulated: true,
    reported_at: new Date("2026-10-10T12:00:00Z"),
    resolved_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// Argument guards
// ─────────────────────────────────────────────────────────────────────

describe("issuePressureSignal · argument guards", () => {
  it("rejects empty linkId", async () => {
    await expect(
      issuePressureSignal({
        linkId: "",
        actorAccountId: CHILD,
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/invalid_link_id/);
  });

  it("rejects empty actor", async () => {
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: "",
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/invalid_actor_account_id/);
  });

  it("rejects unknown reasonCode", async () => {
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: CHILD,
        // @ts-expect-error · deliberately wrong
        reasonCode: "not-a-code",
      }),
    ).rejects.toThrow(/invalid_reason_code/);
  });

  it("accepts every sealed reason code", () => {
    for (const code of PRESSURE_REASON_CODES) {
      expect(isPressureReasonCode(code)).toBe(true);
    }
    expect(isPressureReasonCode("whatever")).toBe(false);
  });

  it("rejects reason notes outside 1..500", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: CHILD,
        reasonCode: "coerced",
        reasonNotes: "x".repeat(501),
      }),
    ).rejects.toThrow(/invalid_reason_notes/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────

describe("issuePressureSignal · authorization", () => {
  it("rejects when link not found", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: CHILD,
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/link_not_found/);
  });

  it("rejects when actor is not a party to the link", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: OUTSIDER,
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/not_a_party_to_link/);
  });

  it("rejects when the link is terminal (revoked)", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("revoked")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: CHILD,
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/link_is_terminal/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Bidirectional (child AND guardian can file)
// ─────────────────────────────────────────────────────────────────────

describe("issuePressureSignal · bidirectional (D2 · 2A)", () => {
  it("allows the child to file against the guardian (pending link)", async () => {
    const inserted: Array<{ sql: string; params: readonly unknown[] }> = [];
    withClientResponder = (sql: string, params) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_pressure_report/i.test(sql)) {
        inserted.push({ sql, params });
        return { rows: [reportRow()], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link/i.test(sql)) {
        return {
          rows: [
            linkRow("revoked", {
              revoked_at: new Date(),
              revoked_by: CHILD,
              revoked_reason: "pressure_signal",
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await issuePressureSignal({
      linkId: LINK_ID,
      actorAccountId: CHILD,
      reasonCode: "coerced",
    });
    expect(result.autoRejectedPending).toBe(true);
    expect(result.report.reporterAccountId).toBe(CHILD);
    expect(result.report.reportedAgainstAccountId).toBe(GUARDIAN);
    // Verify the INSERT fixed reported_against to the guardian · the
    // pressure signal path never writes anything to notify the
    // reported counterparty.
    expect(inserted.length).toBe(1);
    expect(inserted[0].params[4]).toBe(GUARDIAN); // reported_against_account_id
  });

  it("allows the guardian to file against the child (active link · no auto-reject)", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_pressure_report/i.test(sql)) {
        return {
          rows: [
            reportRow({
              reporter_account_id: GUARDIAN,
              reported_against_account_id: CHILD,
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await issuePressureSignal({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
      reasonCode: "unknown_inviter",
    });
    expect(result.autoRejectedPending).toBe(false);
    expect(result.linkAfter.state).toBe("active");
    expect(result.report.reporterAccountId).toBe(GUARDIAN);
    expect(result.report.reportedAgainstAccountId).toBe(CHILD);
  });
});

// ─────────────────────────────────────────────────────────────────────
// LOAD-BEARING INVARIANT · no notification side-effect fires to the
// reported counterparty. We prove this by inspecting EVERY query
// issued during the pressure path and asserting none of them target a
// notification/push/email surface addressed to the reported account.
// ─────────────────────────────────────────────────────────────────────

describe("issuePressureSignal · counterparty NEVER notified", () => {
  it("no SQL query references nex_notification / nex_push / email_outbox against the reported account", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_pressure_report/i.test(sql)) {
        return { rows: [reportRow()], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link/i.test(sql)) {
        return {
          rows: [
            linkRow("revoked", {
              revoked_at: new Date(),
              revoked_by: CHILD,
              revoked_reason: "pressure_signal",
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    await issuePressureSignal({
      linkId: LINK_ID,
      actorAccountId: CHILD,
      reasonCode: "coerced",
    });

    for (const call of withClientCalls) {
      expect(call.sql).not.toMatch(/nex_notification/i);
      expect(call.sql).not.toMatch(/nex_push/i);
      expect(call.sql).not.toMatch(/email_outbox/i);
      expect(call.sql).not.toMatch(/sms_outbox/i);
      // The only INSERT in the pressure path is into pressure_report
      // itself. Any INSERT elsewhere would be a notification side-effect.
      if (/^\s*INSERT\s+INTO/i.test(call.sql)) {
        expect(call.sql).toMatch(/nex\.family_link_pressure_report/i);
      }
      // Any parametrised value touching the reported counterparty is
      // reported_against_account_id in pressure_report (HQ visibility,
      // not notification).
      for (const p of call.params) {
        if (p === GUARDIAN) {
          // Guardian may appear in SELECT ... WHERE link_id as a value
          // read-back, in pressure insert (reported_against), and in
          // revokeLink audit · all of which are HQ/audit side, never
          // a notification channel. The guard is the SQL inspection
          // above.
        }
      }
    }
  });

  it("code path is free of notification-service imports", async () => {
    // Static import inspection · the pressure-signal-service module
    // should NOT import any notification/push/email service. We assert
    // this by reading the source file.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(__dirname, "pressure-signal-service.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/notification-service/i);
    expect(src).not.toMatch(/push-service/i);
    expect(src).not.toMatch(/email-service/i);
    expect(src).not.toMatch(/sms-service/i);
    expect(src).not.toMatch(/sendNotification/i);
    expect(src).not.toMatch(/enqueueNotification/i);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Duplicate open report · partial-unique collision
// ─────────────────────────────────────────────────────────────────────

describe("issuePressureSignal · duplicate open report", () => {
  it("surfaces DUPLICATE_OPEN_REPORT on partial-unique collision", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_pressure_report/i.test(sql)) {
        throw new Error(
          `duplicate key value violates unique constraint "family_link_pressure_report_reporter_open_uq"`,
        );
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: CHILD,
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/duplicate_open_report/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// DB unavailable
// ─────────────────────────────────────────────────────────────────────

describe("issuePressureSignal · DB unavailable", () => {
  it("surfaces DB_UNAVAILABLE when the pool is null", async () => {
    withClientUnavailable = true;
    await expect(
      issuePressureSignal({
        linkId: LINK_ID,
        actorAccountId: CHILD,
        reasonCode: "coerced",
      }),
    ).rejects.toThrow(/link_not_found|db_unavailable/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// listReportsByReporter
// ─────────────────────────────────────────────────────────────────────

describe("listReportsByReporter", () => {
  it("rejects empty id", async () => {
    await expect(listReportsByReporter("")).rejects.toThrow(
      /invalid_reporter_account_id/,
    );
  });

  it("returns rows for the given reporter in reverse chronological order", async () => {
    withClientResponder = (sql: string, params) => {
      if (
        /SELECT\s+\*\s+FROM\s+nex\.family_link_pressure_report/i.test(sql) &&
        params[0] === CHILD
      ) {
        return {
          rows: [
            reportRow({
              report_id: "r1",
              reported_at: new Date("2026-10-10T13:00:00Z"),
            }),
            reportRow({
              report_id: "r2",
              reported_at: new Date("2026-10-10T12:00:00Z"),
            }),
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const list = await listReportsByReporter(CHILD);
    expect(list.length).toBe(2);
    expect(list[0].reportId).toBe("r1");
    expect(list[1].reportId).toBe("r2");
  });

  it("returns [] when the pool is null", async () => {
    withClientUnavailable = true;
    const list = await listReportsByReporter(CHILD);
    expect(list).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Sanity: PRESSURE_SIGNAL_ERROR_CODES stability
// ─────────────────────────────────────────────────────────────────────

describe("PRESSURE_SIGNAL_ERROR_CODES", () => {
  it("exposes a stable set of codes", () => {
    expect(PRESSURE_SIGNAL_ERROR_CODES.LINK_NOT_FOUND).toMatch(
      /link_not_found/,
    );
    expect(PRESSURE_SIGNAL_ERROR_CODES.NOT_A_PARTY).toMatch(
      /not_a_party_to_link/,
    );
    expect(PRESSURE_SIGNAL_ERROR_CODES.LINK_TERMINAL).toMatch(
      /is_terminal/,
    );
    expect(PRESSURE_SIGNAL_ERROR_CODES.INVALID_REASON_CODE).toMatch(
      /invalid_reason_code/,
    );
  });
});

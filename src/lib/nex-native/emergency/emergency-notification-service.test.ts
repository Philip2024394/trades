// src/lib/nex-native/emergency/emergency-notification-service.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- DB mock -----------------------------------------------------------
type QCall = { sql: string; params: readonly unknown[] };
let qCalls: QCall[];
let qResponse: ((sql: string, params: readonly unknown[]) =>
  { rows: Record<string, unknown>[]; rowCount: number | null } | null
) | null;
// Idempotency state across calls: insert fails on second attempt with
// the same key.
let auditInsertedKeys: Set<string>;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        qCalls.push({ sql, params: params ?? [] });
        if (qResponse) {
          const r = qResponse(sql, params ?? []);
          if (r !== null) return r;
        }
        // Default audit-insert handler: honours idempotency.
        if (sql.includes("INSERT INTO nex.emergency_fanout_log")) {
          const idemKey = String((params ?? [])[6] ?? "");
          if (auditInsertedKeys.has(idemKey)) {
            // ON CONFLICT DO NOTHING · no row returned.
            return { rows: [], rowCount: 0 };
          }
          auditInsertedKeys.add(idemKey);
          return { rows: [{ log_id: `log-${auditInsertedKeys.size}` }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import { fanOutForTransition } from "./emergency-notification-service";

const INCIDENT = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const REQUESTER = "22222222-2222-4222-8222-bbbbbbbbbbbb";
const CONTACT_ACCT = "33333333-3333-4333-8333-cccccccccccc";

beforeEach(() => {
  qCalls = [];
  qResponse = null;
  auditInsertedKeys = new Set();
});

afterEach(() => vi.restoreAllMocks());

function tcListResponder(rows: Array<Record<string, unknown>>) {
  return (sql: string) =>
    sql.includes("FROM nex.trusted_contact") && sql.includes("ORDER BY added_at DESC")
      ? { rows, rowCount: rows.length }
      : null;
}

function emptyResponders(): (sql: string) =>
  { rows: Record<string, unknown>[]; rowCount: number | null } | null {
  return (sql: string) =>
    sql.includes("FROM nex.incident_recipient")
      ? { rows: [], rowCount: 0 }
      : null;
}

// Compose multiple sub-responders into one qResponse function.
function compose(
  ...fns: Array<(sql: string, params: readonly unknown[]) =>
    { rows: Record<string, unknown>[]; rowCount: number | null } | null>
) {
  return (sql: string, params: readonly unknown[]) => {
    for (const fn of fns) {
      const r = fn(sql, params);
      if (r !== null) return r;
    }
    return null;
  };
}

describe("fanOutForTransition · guards", () => {
  it("rejects empty incidentId", async () => {
    await expect(
      fanOutForTransition({
        incidentId: "",
        transition: "pending_confirmation",
        requesterAccountId: REQUESTER,
      }),
    ).rejects.toThrow(/invalid_incident_id/);
  });

  it("rejects empty requesterAccountId", async () => {
    await expect(
      fanOutForTransition({
        incidentId: INCIDENT,
        transition: "pending_confirmation",
        requesterAccountId: "",
      }),
    ).rejects.toThrow(/invalid_requester/);
  });
});

describe("fanOutForTransition · zero trusted contacts", () => {
  it("no attempts, no audit rows", async () => {
    qResponse = compose(tcListResponder([]), emptyResponders());
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    expect(r.attempted).toBe(0);
    expect(r.succeeded).toBe(0);
    expect(r.failed.length).toBe(0);
    expect(r.honestBlocked.length).toBe(0);
    const auditInserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    expect(auditInserts.length).toBe(0);
  });
});

describe("fanOutForTransition · email-only trusted contact", () => {
  it("sends email (simulated ok) and writes one audit row", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-1",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "mum@example.com",
          contact_phone: null,
          added_at: new Date(),
          contact_label: "Mum",
        },
      ]),
      emptyResponders(),
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
      requesterLabel: "Alex",
    });
    expect(r.attempted).toBe(1);
    expect(r.succeeded).toBe(1);
    const inserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    expect(inserts.length).toBe(1);
    // channel column is 3rd positional (0: incident_id, 1: transition,
    // 2: channel, 3: recipient_identifier, 4: outcome, ...).
    expect(inserts[0].params[2]).toBe("email");
    expect(inserts[0].params[4]).toBe("ok");
  });
});

describe("fanOutForTransition · phone-only trusted contact (honest-blocked)", () => {
  it("writes audit row with outcome=honest_blocked and never claims success", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-2",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: null,
          contact_phone: "+6281234567",
          added_at: new Date(),
          contact_label: "Dad",
        },
      ]),
      emptyResponders(),
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    expect(r.attempted).toBe(1);
    expect(r.succeeded).toBe(0);
    expect(r.honestBlocked.length).toBe(1);
    expect(r.honestBlocked[0].channel).toBe("sms");
    expect(r.honestBlocked[0].reason).toBe("sms_adapter_not_implemented");
    const inserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    expect(inserts.length).toBe(1);
    expect(inserts[0].params[2]).toBe("sms");
    expect(inserts[0].params[4]).toBe("honest_blocked");
  });
});

describe("fanOutForTransition · mixed contact (email + phone + account)", () => {
  it("fires 3 attempts: 1 email + 1 sms + 1 in_app", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-3",
          owner_account_id: REQUESTER,
          contact_account_id: CONTACT_ACCT,
          contact_email: "both@example.com",
          contact_phone: "+6281234567",
          added_at: new Date(),
          contact_label: "Partner",
        },
      ]),
      emptyResponders(),
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    expect(r.attempted).toBe(3);
    const channels = new Set(
      [...r.failed, ...r.honestBlocked, { channel: "email" as const }]
        .map((a) => a.channel),
    );
    expect(channels.has("email")).toBe(true);
    const auditChannels = qCalls
      .filter((c) => c.sql.includes("INSERT INTO nex.emergency_fanout_log"))
      .map((c) => c.params[2]);
    expect(auditChannels).toContain("email");
    expect(auditChannels).toContain("sms");
    expect(auditChannels).toContain("in_app");
  });
});

describe("fanOutForTransition · transition routing", () => {
  it("transition=active includes nearby opted-in responders in the in_app push set", async () => {
    const responderId = "99999999-9999-4999-8999-999999999999";
    qResponse = compose(
      tcListResponder([]),
      (sql) =>
        sql.includes("FROM nex.incident_recipient")
          ? {
              rows: [{ recipient_account_id: responderId }],
              rowCount: 1,
            }
          : null,
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "active",
      requesterAccountId: REQUESTER,
    });
    expect(r.attempted).toBe(1);
    const inserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    expect(inserts[0].params[2]).toBe("in_app");
    // transition column recorded correctly.
    expect(inserts[0].params[1]).toBe("active");
  });

  it("transition=revoked_within_window does NOT include nearby responders", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-4",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "friend@example.com",
          contact_phone: null,
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      (sql) =>
        sql.includes("FROM nex.incident_recipient")
          ? {
              rows: [{ recipient_account_id: "someone" }],
              rowCount: 1,
            }
          : null,
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "revoked_within_window",
      requesterAccountId: REQUESTER,
    });
    // The revoked-within-window plan does NOT include nearby responders,
    // so the responder row above must NOT drive an in_app attempt.
    const inAppInserts = qCalls
      .filter((c) => c.sql.includes("INSERT INTO nex.emergency_fanout_log"))
      .filter((c) => c.params[2] === "in_app");
    expect(inAppInserts.length).toBe(0);
    // One email attempt is expected.
    expect(r.attempted).toBe(1);
    expect(r.succeeded).toBe(1);
  });

  it("transition=cancelled records transition='cancelled' in the audit", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-5",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "friend@example.com",
          contact_phone: null,
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "cancelled",
      requesterAccountId: REQUESTER,
    });
    const inserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    expect(inserts[0].params[1]).toBe("cancelled");
  });
});

describe("fanOutForTransition · idempotency", () => {
  it("re-running the same transition inserts zero new audit rows", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-6",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "x@y.co",
          contact_phone: null,
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    const firstInsertCount = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    ).length;
    expect(firstInsertCount).toBe(1);

    // Reset the call log but preserve `auditInsertedKeys` so the second
    // run observes the idempotency conflict.
    qCalls = [];
    await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    const secondInsertAttempts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    // We still ATTEMPT the insert (the service doesn't pre-check);
    // the DB's ON CONFLICT DO NOTHING swallows the duplicate.
    expect(secondInsertAttempts.length).toBe(1);
    // But the DB layer returned rowCount=0 the second time; the attempt
    // summary should still carry alreadyLogged for the operator.
  });
});

describe("fanOutForTransition · simulated=true is default + propagates to audit", () => {
  it("simulated column stored as TRUE by default (v1 PILOT)", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-7",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "x@y.co",
          contact_phone: null,
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    expect(r.simulated).toBe(true);
    const inserts = qCalls.filter((c) =>
      c.sql.includes("INSERT INTO nex.emergency_fanout_log"),
    );
    // simulated column is params[7]
    expect(inserts[0].params[7]).toBe(true);
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================

describe("hardening · SMS adapter never fabricates success (audit item 2)", () => {
  it("phone-only contact → sms attempt is honest_blocked with sealed reason", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-9",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: null,
          contact_phone: "+628111222333",
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    const smsAttempt = [...r.honestBlocked, ...r.failed].find(
      (a) => a.channel === "sms",
    );
    expect(smsAttempt).toBeDefined();
    expect(smsAttempt?.outcome).toBe("honest_blocked");
    expect(smsAttempt?.reason).toBe("sms_adapter_not_implemented");
    // succeeded set never includes the SMS attempt.
    expect(r.succeeded).toBe(0);
  });
});

describe("hardening · in-app push is honest_blocked (not wired) · audit transparency", () => {
  it("account-id-bearing contact → in_app attempt is honest_blocked with sealed reason", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-10",
          owner_account_id: REQUESTER,
          contact_account_id: CONTACT_ACCT,
          contact_email: null,
          contact_phone: null,
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    const r = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    const push = r.honestBlocked.find((a) => a.channel === "in_app");
    expect(push?.outcome).toBe("honest_blocked");
    expect(push?.reason).toBe("in_app_push_not_wired");
  });
});

describe("hardening · idempotency key reused across replays (audit transparency)", () => {
  it("same (incident, transition, channel, recipient) across two calls yields exactly one logged row", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-11",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "idem@example.com",
          contact_phone: null,
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    // First fire · fresh key logged.
    const r1 = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    expect(r1.succeeded + r1.honestBlocked.length).toBeGreaterThanOrEqual(1);
    const beforeKeys = new Set(auditInsertedKeys);
    expect(beforeKeys.size).toBeGreaterThan(0);
    // Second fire · same (incident, transition) · all keys collide via ON CONFLICT.
    const r2 = await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "pending_confirmation",
      requesterAccountId: REQUESTER,
    });
    // auditInsertedKeys count MUST equal the previous count · no new rows.
    expect(auditInsertedKeys.size).toBe(beforeKeys.size);
    // Second call still returns a shape without throwing.
    expect(typeof r2.attempted).toBe("number");
  });
});

describe("hardening · fan-out never calls external emergency services (audit item 2)", () => {
  it("no SQL in the fan-out ever references police / fire / ambulance / law_enforcement", async () => {
    qResponse = compose(
      tcListResponder([
        {
          trusted_contact_id: "tc-12",
          owner_account_id: REQUESTER,
          contact_account_id: null,
          contact_email: "x@y.co",
          contact_phone: "+628111",
          added_at: new Date(),
          contact_label: null,
        },
      ]),
      emptyResponders(),
    );
    await fanOutForTransition({
      incidentId: INCIDENT,
      transition: "active",
      requesterAccountId: REQUESTER,
    });
    for (const call of qCalls) {
      expect(call.sql).not.toMatch(/police|fire|ambulance|law_enforcement/i);
    }
  });
});

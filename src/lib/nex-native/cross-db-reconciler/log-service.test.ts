// src/lib/nex-native/cross-db-reconciler/log-service.test.ts
//
// NEX Directory · Cross-DB Reconciler · log-service tests.
//
// Scope
//   - Argument guards (invalid event_type, idempotency_key length,
//     attempt_number bounds, error_detail length, error_code length,
//     affected_rows negatives)
//   - SQL shape · the INSERT is parameterised, uses ON CONFLICT DO
//     NOTHING, selects log_id on RETURNING
//   - Idempotency: a second recordReconcileEvent with the same
//     (idempotency_key, attempt_number) returns alreadyRecorded=true
//     and the pre-existing log_id
//   - Degraded mode: withClient returning null yields the sentinel
//     logId + alreadyRecorded=false (no throw)
//   - Read-side: readRecentReconcileEvents rejects out-of-range limit,
//     projects rows to the typed shape, and returns [] when pool is
//     unavailable
//
// This test file does NOT:
//   - Touch the real DB. We mock @/lib/nex/db.withClient.
//   - Touch Supabase. The log-service knows nothing about Supabase.
//
// NB: the production module declares `import "server-only"`. The
// vitest config aliases that to src/test/emptyModule.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the shared pg pool · captured-calls API lets each test assert
// SQL text + params and inject per-test responses.
let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponder:
  | ((sql: string, params: readonly unknown[]) => { rows: Record<string, unknown>[]; rowCount: number | null })
  | null;
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

// Import AFTER mocks.
import {
  recordReconcileEvent,
  readRecentReconcileEvents,
  RECORD_UNAVAILABLE_SENTINEL,
} from "./log-service";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const UUID_LOG = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =====================================================================
// Argument guards
// =====================================================================

describe("recordReconcileEvent · argument guards", () => {
  it("rejects an unknown event_type", async () => {
    await expect(
      // @ts-expect-error · deliberately wrong type
      recordReconcileEvent({ eventType: "nope", idempotencyKey: "k" }),
    ).rejects.toThrow(/invalid_event_type/);
  });

  it("rejects an empty idempotency_key", async () => {
    await expect(
      recordReconcileEvent({ eventType: "sweep_run", idempotencyKey: "" }),
    ).rejects.toThrow(/invalid_idempotency_key/);
  });

  it("rejects an idempotency_key longer than 64 chars", async () => {
    await expect(
      recordReconcileEvent({
        eventType: "sweep_run",
        idempotencyKey: "a".repeat(65),
      }),
    ).rejects.toThrow(/invalid_idempotency_key/);
  });

  it("rejects attempt_number = 0", async () => {
    await expect(
      recordReconcileEvent({
        eventType: "sweep_run",
        idempotencyKey: "k",
        attemptNumber: 0,
      }),
    ).rejects.toThrow(/invalid_attempt_number/);
  });

  it("rejects attempt_number = 11", async () => {
    await expect(
      recordReconcileEvent({
        eventType: "sweep_run",
        idempotencyKey: "k",
        attemptNumber: 11,
      }),
    ).rejects.toThrow(/invalid_attempt_number/);
  });

  it("rejects negative affected_rows", async () => {
    await expect(
      recordReconcileEvent({
        eventType: "link_attempted",
        idempotencyKey: "k",
        affectedRows: -1,
      }),
    ).rejects.toThrow(/invalid_affected_rows/);
  });

  it("rejects error_detail longer than 2000 chars", async () => {
    await expect(
      recordReconcileEvent({
        eventType: "link_failed",
        idempotencyKey: "k",
        errorDetail: "x".repeat(2001),
      }),
    ).rejects.toThrow(/invalid_error_detail/);
  });

  it("rejects error_code longer than 64 chars", async () => {
    await expect(
      recordReconcileEvent({
        eventType: "link_failed",
        idempotencyKey: "k",
        errorCode: "x".repeat(65),
      }),
    ).rejects.toThrow(/invalid_error_code/);
  });
});

// =====================================================================
// Happy path · fresh insert
// =====================================================================

describe("recordReconcileEvent · fresh insert", () => {
  it("emits a parameterised INSERT with ON CONFLICT DO NOTHING RETURNING log_id", async () => {
    withClientResponder = () => ({ rows: [{ log_id: UUID_LOG }], rowCount: 1 });

    const res = await recordReconcileEvent({
      eventType: "link_attempted",
      claimId: UUID_A,
      canonicalBusinessId: UUID_B,
      supabaseAccountId: UUID_C,
      idempotencyKey: "idem-1",
    });

    expect(res.logId).toBe(UUID_LOG);
    expect(res.alreadyRecorded).toBe(false);

    expect(withClientCalls.length).toBe(1);
    const call = withClientCalls[0];
    expect(call.sql).toMatch(/INSERT\s+INTO\s+nex\.cross_db_reconcile_log/i);
    expect(call.sql).toMatch(/ON\s+CONFLICT\s*\(\s*idempotency_key\s*,\s*attempt_number\s*\)\s+DO\s+NOTHING/i);
    expect(call.sql).toMatch(/RETURNING\s+log_id/i);
    // 10 bind params in INSERT order.
    expect(call.params.length).toBe(10);
    expect(call.params[0]).toBe("link_attempted");
    expect(call.params[1]).toBe(UUID_A);
    expect(call.params[2]).toBe(UUID_B);
    expect(call.params[3]).toBe(UUID_C);
    expect(call.params[7]).toBe("idem-1");
    expect(call.params[8]).toBe(true); // simulated defaults true
    expect(call.params[9]).toBe(1);    // attempt_number defaults 1
  });

  it("defaults simulated=true when omitted", async () => {
    withClientResponder = () => ({ rows: [{ log_id: UUID_LOG }], rowCount: 1 });
    await recordReconcileEvent({
      eventType: "sweep_run",
      idempotencyKey: "sweep-1",
    });
    expect(withClientCalls[0].params[8]).toBe(true);
  });

  it("honours an explicit simulated=false", async () => {
    withClientResponder = () => ({ rows: [{ log_id: UUID_LOG }], rowCount: 1 });
    await recordReconcileEvent({
      eventType: "link_succeeded",
      idempotencyKey: "idem-live-1",
      simulated: false,
    });
    expect(withClientCalls[0].params[8]).toBe(false);
  });

  it("honours an explicit attempt_number", async () => {
    withClientResponder = () => ({ rows: [{ log_id: UUID_LOG }], rowCount: 1 });
    await recordReconcileEvent({
      eventType: "retry_scheduled",
      idempotencyKey: "idem-retry",
      attemptNumber: 3,
    });
    expect(withClientCalls[0].params[9]).toBe(3);
  });
});

// =====================================================================
// Idempotent dedup path
// =====================================================================

describe("recordReconcileEvent · idempotent dedup", () => {
  it("returns alreadyRecorded=true and the pre-existing log_id on conflict", async () => {
    withClientResponder = (sql) => {
      if (/INSERT/i.test(sql)) {
        // ON CONFLICT fired, RETURNING yields zero rows.
        return { rows: [], rowCount: 0 };
      }
      if (/SELECT\s+log_id/i.test(sql)) {
        return { rows: [{ log_id: UUID_LOG }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    const res = await recordReconcileEvent({
      eventType: "link_attempted",
      idempotencyKey: "idem-dup",
    });

    expect(res.alreadyRecorded).toBe(true);
    expect(res.logId).toBe(UUID_LOG);
    expect(withClientCalls.length).toBe(2);
    expect(withClientCalls[0].sql).toMatch(/INSERT/i);
    expect(withClientCalls[1].sql).toMatch(/SELECT\s+log_id/i);
    expect(withClientCalls[1].params).toEqual(["idem-dup", 1]);
  });
});

// =====================================================================
// Degraded mode · pool unavailable
// =====================================================================

describe("recordReconcileEvent · pool unavailable", () => {
  it("returns the sentinel logId when NEX_POSTGRES_URL is absent", async () => {
    withClientUnavailable = true;
    const res = await recordReconcileEvent({
      eventType: "sweep_run",
      idempotencyKey: "k",
    });
    expect(res.logId).toBe(RECORD_UNAVAILABLE_SENTINEL);
    expect(res.alreadyRecorded).toBe(false);
    expect(withClientCalls.length).toBe(0);
  });
});

// =====================================================================
// readRecentReconcileEvents
// =====================================================================

describe("readRecentReconcileEvents", () => {
  it("rejects a limit of 0", async () => {
    await expect(readRecentReconcileEvents(0)).rejects.toThrow(/invalid_limit/);
  });

  it("rejects a limit > 500", async () => {
    await expect(readRecentReconcileEvents(501)).rejects.toThrow(/invalid_limit/);
  });

  it("rejects a non-integer limit", async () => {
    await expect(readRecentReconcileEvents(1.5)).rejects.toThrow(/invalid_limit/);
  });

  it("returns [] when the pool is unavailable", async () => {
    withClientUnavailable = true;
    const res = await readRecentReconcileEvents(10);
    expect(res).toEqual([]);
  });

  it("projects rows to the typed shape", async () => {
    const createdAt = new Date("2026-10-10T12:00:00Z");
    withClientResponder = () => ({
      rows: [
        {
          log_id: UUID_LOG,
          event_type: "link_succeeded",
          claim_id: UUID_A,
          canonical_business_id: UUID_B,
          supabase_account_id: UUID_C,
          affected_rows: 1,
          error_code: null,
          error_detail: null,
          idempotency_key: "idem-1",
          simulated: true,
          attempt_number: 1,
          created_at: createdAt,
        },
      ],
      rowCount: 1,
    });
    const res = await readRecentReconcileEvents(5);
    expect(res.length).toBe(1);
    expect(res[0]).toEqual({
      logId: UUID_LOG,
      eventType: "link_succeeded",
      claimId: UUID_A,
      canonicalBusinessId: UUID_B,
      supabaseAccountId: UUID_C,
      affectedRows: 1,
      errorCode: null,
      errorDetail: null,
      idempotencyKey: "idem-1",
      simulated: true,
      attemptNumber: 1,
      createdAt,
    });
    const call = withClientCalls[0];
    expect(call.sql).toMatch(/ORDER\s+BY\s+created_at\s+DESC/i);
    expect(call.sql).toMatch(/LIMIT\s+\$1/i);
    expect(call.params).toEqual([5]);
  });
});

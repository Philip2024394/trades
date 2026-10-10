// src/lib/nex-native/cross-db-reconciler/reconciler.test.ts
//
// NEX Directory · Cross-DB Reconciler · service tests.
//
// Scope
//   - Feature flag OFF → feature_disabled, zero log writes
//   - Simulate-only ON → one simulated log row + simulation_only
//   - Live mode: UPDATE affects 1 row → linked_existing
//   - Live mode: UPDATE affects 0 → INSERT affects 1 → stubbed_new
//   - Live mode: UPDATE affects >1 → ambiguous_multiple_profiles
//   - Live mode: INSERT raises 23505 → ambiguous_multiple_profiles
//   - Live mode: client factory returns null → supabase_error
//   - Live mode: factory throws → supabase_error
//   - Live mode: generic rejection → supabase_error with sanitised detail
//   - Idempotency key is stable + 64 hex chars
//   - Idempotent re-run of recordReconcileEvent returns alreadyRecorded
//   - Backoff ms: 1000 / 5000 / 25000 / caps
//
// This test file does NOT:
//   - Touch the real DB. We mock @/lib/nex/db.withClient (via log-service).
//   - Touch Supabase. We inject a mock ReconcilerSupabaseClient via opts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture every pg call made via the log-service's withClient.
let pgCalls: Array<{ sql: string; params: readonly unknown[] }>;
let pgResponder:
  | ((sql: string, params: readonly unknown[]) => { rows: Record<string, unknown>[]; rowCount: number | null })
  | null;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        pgCalls.push({ sql, params: params ?? [] });
        if (pgResponder) return pgResponder(sql, params ?? []);
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  reconcileVerifiedClaim,
  computeIdempotencyKey,
  backoffMs,
  type ReconcilerSupabaseClient,
} from "./reconciler";

const CLAIM = "11111111-1111-4111-8111-111111111111";
const CANON = "22222222-2222-4222-8222-222222222222";
const ACC = "33333333-3333-4333-8333-333333333333";
const LOG_UUID = "44444444-4444-4444-4444-444444444444";

// Default pg responder that mimics "fresh insert succeeds".
function respondFreshInsert() {
  pgResponder = (sql) => {
    if (/INSERT\s+INTO\s+nex\.cross_db_reconcile_log/i.test(sql)) {
      return { rows: [{ log_id: LOG_UUID }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
}

function makeMockClient(partial: Partial<ReconcilerSupabaseClient>): ReconcilerSupabaseClient {
  return {
    updateExistingLink: async () => ({ rowCount: 0 }),
    insertStubLink: async () => ({ rowCount: 0 }),
    ...partial,
  };
}

const SAVED_ENV = { ...process.env };

beforeEach(() => {
  pgCalls = [];
  pgResponder = null;
  // Reset to safe defaults for every test.
  delete process.env.NEX_CROSS_DB_RECONCILER_ENABLED;
  delete process.env.NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY;
});

afterEach(() => {
  vi.restoreAllMocks();
  // Restore env in case a test set it.
  process.env = { ...SAVED_ENV };
});

// =====================================================================
// Idempotency key + backoff · pure helpers
// =====================================================================

describe("computeIdempotencyKey", () => {
  it("is deterministic for the same tuple", () => {
    const a = computeIdempotencyKey({ claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC });
    const b = computeIdempotencyKey({ claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC });
    expect(a).toBe(b);
  });

  it("differs when any field differs", () => {
    const a = computeIdempotencyKey({ claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC });
    const b = computeIdempotencyKey({ claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: "different" });
    expect(a).not.toBe(b);
  });

  it("is exactly 64 lowercase hex chars", () => {
    const key = computeIdempotencyKey({ claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("backoffMs", () => {
  it("1s / 5s / 25s for attempts 1,2,3", () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(5000);
    expect(backoffMs(3)).toBe(25000);
  });

  it("caps at attempt 3 for larger inputs", () => {
    expect(backoffMs(4)).toBe(25000);
    expect(backoffMs(99)).toBe(25000);
  });

  it("floors non-positive inputs at 1s", () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(-1)).toBe(1000);
  });
});

// =====================================================================
// Feature flag OFF
// =====================================================================

describe("reconcileVerifiedClaim · feature flag OFF", () => {
  it("returns feature_disabled with no log writes when env var is unset", async () => {
    const res = await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    });
    expect(res).toEqual({ ok: false, outcome: "feature_disabled", logId: null });
    expect(pgCalls.length).toBe(0);
  });

  it("returns feature_disabled when env var is literally 'false'", async () => {
    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "false";
    const res = await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    });
    expect(res.outcome).toBe("feature_disabled");
    expect(pgCalls.length).toBe(0);
  });

  it("rejects non-'true' values like '1' or 'TRUE'", async () => {
    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "1";
    expect((await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    })).outcome).toBe("feature_disabled");

    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "TRUE";
    expect((await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    })).outcome).toBe("feature_disabled");
  });
});

// =====================================================================
// Simulate-only
// =====================================================================

describe("reconcileVerifiedClaim · simulate-only (default)", () => {
  it("writes one simulated log row and returns simulation_only", async () => {
    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "true";
    // SIMULATE_ONLY unset → defaults TRUE.
    respondFreshInsert();
    const res = await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    });
    expect(res.ok).toBe(false);
    expect(res.outcome).toBe("simulation_only");
    expect("logId" in res ? res.logId : null).toBe(LOG_UUID);
    expect(pgCalls.length).toBe(1);
    expect(pgCalls[0].sql).toMatch(/INSERT\s+INTO\s+nex\.cross_db_reconcile_log/i);
    // event_type = link_attempted
    expect(pgCalls[0].params[0]).toBe("link_attempted");
    // simulated = true
    expect(pgCalls[0].params[8]).toBe(true);
  });

  it("stays in simulate-only when SIMULATE_ONLY is anything other than 'false'", async () => {
    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "true";
    process.env.NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY = "FALSE"; // not literal "false"
    respondFreshInsert();
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => { throw new Error("live client must not be summoned"); } },
    );
    expect(res.outcome).toBe("simulation_only");
  });
});

// =====================================================================
// Live mode
// =====================================================================

describe("reconcileVerifiedClaim · live mode (SIMULATE_ONLY=false)", () => {
  beforeEach(() => {
    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "true";
    process.env.NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY = "false";
  });

  it("UPDATE affecting 1 row → linked_existing", async () => {
    respondFreshInsert();
    const client = makeMockClient({
      updateExistingLink: async () => ({ rowCount: 1 }),
    });
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => client },
    );
    expect(res).toMatchObject({ ok: true, outcome: "linked_existing", affectedRows: 1 });
    expect(pgCalls.length).toBe(1);
    expect(pgCalls[0].params[0]).toBe("link_updated_existing");
    expect(pgCalls[0].params[8]).toBe(false); // simulated = false
  });

  it("UPDATE 0 then INSERT 1 → stubbed_new", async () => {
    respondFreshInsert();
    const client = makeMockClient({
      updateExistingLink: async () => ({ rowCount: 0 }),
      insertStubLink: async () => ({ rowCount: 1 }),
    });
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => client },
    );
    expect(res).toMatchObject({ ok: true, outcome: "stubbed_new", affectedRows: 1 });
    expect(pgCalls[0].params[0]).toBe("link_created_stub");
  });

  it("UPDATE affecting 2 rows → ambiguous_multiple_profiles", async () => {
    respondFreshInsert();
    const client = makeMockClient({
      updateExistingLink: async () => ({ rowCount: 2 }),
    });
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => client },
    );
    expect(res.ok).toBe(false);
    expect(res.outcome).toBe("ambiguous_multiple_profiles");
    if (res.outcome === "ambiguous_multiple_profiles") {
      expect(res.affectedRows).toBe(2);
    }
    expect(pgCalls[0].params[0]).toBe("link_ambiguous");
  });

  it("INSERT raising 23505 → ambiguous_multiple_profiles", async () => {
    respondFreshInsert();
    const client = makeMockClient({
      updateExistingLink: async () => ({ rowCount: 0 }),
      insertStubLink: async () => {
        const e = new Error("duplicate key value violates unique constraint");
        (e as unknown as { code: string }).code = "23505";
        throw e;
      },
    });
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => client },
    );
    expect(res.outcome).toBe("ambiguous_multiple_profiles");
    expect(pgCalls[0].params[0]).toBe("link_ambiguous");
    expect(pgCalls[0].params[5]).toBe("unique_violation"); // error_code
  });

  it("client factory returning null → supabase_error with client_unavailable", async () => {
    respondFreshInsert();
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => null },
    );
    expect(res.ok).toBe(false);
    expect(res.outcome).toBe("supabase_error");
    if (res.outcome === "supabase_error") {
      expect(res.errorCode).toBe("client_unavailable");
      expect(res.retryAfterMs).toBe(1000);
    }
    expect(pgCalls[0].params[0]).toBe("link_failed");
    expect(pgCalls[0].params[5]).toBe("client_unavailable");
  });

  it("client factory throwing → supabase_error (treated as unavailable)", async () => {
    respondFreshInsert();
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => { throw new Error("boom"); } },
    );
    expect(res.outcome).toBe("supabase_error");
  });

  it("generic rejection → supabase_error with sanitised error_detail", async () => {
    respondFreshInsert();
    const client = makeMockClient({
      updateExistingLink: async () => {
        throw new Error("connection refused · postgres://user:secret@host/db · password='hunter2'");
      },
    });
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => client },
    );
    expect(res.outcome).toBe("supabase_error");
    const detail = String(pgCalls[0].params[6]); // error_detail
    expect(detail).not.toMatch(/secret/);
    expect(detail).not.toMatch(/hunter2/);
    expect(detail).toMatch(/\[redacted\]/);
  });

  it("passes attemptNumber through to the audit row + into retryAfterMs backoff", async () => {
    respondFreshInsert();
    const client = makeMockClient({
      updateExistingLink: async () => { throw new Error("transient 500"); },
    });
    const res = await reconcileVerifiedClaim(
      { claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC },
      { clientFactory: async () => client, attemptNumber: 2 },
    );
    expect(res.outcome).toBe("supabase_error");
    expect(pgCalls[0].params[9]).toBe(2); // attempt_number
    if (res.outcome === "supabase_error") {
      expect(res.retryAfterMs).toBe(5000); // attempt 2 → 5s
    }
  });
});

// =====================================================================
// Idempotent re-run via alreadyRecorded path
// =====================================================================

describe("reconcileVerifiedClaim · idempotent dedup", () => {
  it("second call for the same key + attempt resolves to alreadyRecorded via log-service", async () => {
    process.env.NEX_CROSS_DB_RECONCILER_ENABLED = "true";
    // simulate-only path uses only the audit log, so it's the cleanest
    // place to exercise the dedup round trip.

    // First call: fresh insert.
    pgResponder = (sql) => {
      if (/INSERT/i.test(sql)) return { rows: [{ log_id: LOG_UUID }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    };
    const first = await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    });
    expect(first.outcome).toBe("simulation_only");
    expect("logId" in first ? first.logId : null).toBe(LOG_UUID);

    // Reset pg call log and respond with ON CONFLICT DO NOTHING on insert,
    // then SELECT returns the existing row.
    pgCalls = [];
    pgResponder = (sql) => {
      if (/INSERT/i.test(sql)) return { rows: [], rowCount: 0 };
      if (/SELECT\s+log_id/i.test(sql)) return { rows: [{ log_id: LOG_UUID }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    };
    const second = await reconcileVerifiedClaim({
      claimId: CLAIM, canonicalBusinessId: CANON, supabaseAccountId: ACC,
    });
    expect(second.outcome).toBe("simulation_only");
    expect("logId" in second ? second.logId : null).toBe(LOG_UUID);
    // 2 pg calls: INSERT (no-op) then SELECT.
    expect(pgCalls.length).toBe(2);
    expect(pgCalls[0].sql).toMatch(/INSERT/i);
    expect(pgCalls[1].sql).toMatch(/SELECT\s+log_id/i);
  });
});

// src/lib/nex-native/family-safety/age-transition-service.test.ts
//
// CC-3 · Age-transition workflow tests. Mocks `@/lib/nex/db` · the
// service never touches a real database in test. 20+ scenarios cover:
//   · pure DOB → auto_transfer_at computation (incl. leap-year)
//   · daysUntil helper
//   · listUpcomingTransitions (default 30-day window)
//   · requestChildConfirmation (parent-only)
//   · confirmChildHandover (child-only · atomic transfer)
//   · sweepPendingTransitions (idempotent · deadline-gated)
//   · atomic failure rollback

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
  AGE_TRANSITION_ERROR_CODES,
  computeAutoTransferAt,
  confirmChildHandover,
  daysUntil,
  listUpcomingTransitions,
  requestChildConfirmation,
  sweepPendingTransitions,
} from "./age-transition-service";

const PARENT = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const CUSTODY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function custodyRow(overrides: Record<string, unknown> = {}) {
  return {
    custody_id: CUSTODY,
    parent_account_id: PARENT,
    child_account_id: CHILD,
    auto_transfer_at: "2027-04-01T00:00:00.000Z",
    transferred_at: null,
    revoked_at: null,
    simulated: true,
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
// §1 · computeAutoTransferAt
// ─────────────────────────────────────────────────────────────────────

describe("computeAutoTransferAt", () => {
  it("adds exactly 16 years to a normal DOB", () => {
    expect(computeAutoTransferAt("2011-04-01")).toBe(
      "2027-04-01T00:00:00.000Z",
    );
  });

  it("handles a January-1 DOB", () => {
    expect(computeAutoTransferAt("2010-01-01")).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("handles a December-31 DOB", () => {
    expect(computeAutoTransferAt("2010-12-31")).toBe(
      "2026-12-31T00:00:00.000Z",
    );
  });

  it("throws INVALID_DOB on empty input", () => {
    expect(() => computeAutoTransferAt("")).toThrow(
      AGE_TRANSITION_ERROR_CODES.INVALID_DOB,
    );
  });

  it("throws INVALID_DOB on malformed input", () => {
    expect(() => computeAutoTransferAt("1 April 2011")).toThrow(
      AGE_TRANSITION_ERROR_CODES.INVALID_DOB,
    );
    expect(() => computeAutoTransferAt("2011/04/01")).toThrow(
      AGE_TRANSITION_ERROR_CODES.INVALID_DOB,
    );
    expect(() => computeAutoTransferAt("2011-04")).toThrow(
      AGE_TRANSITION_ERROR_CODES.INVALID_DOB,
    );
  });

  it("throws INVALID_DOB on nonsense month/day", () => {
    expect(() => computeAutoTransferAt("2011-13-01")).toThrow(
      AGE_TRANSITION_ERROR_CODES.INVALID_DOB,
    );
    expect(() => computeAutoTransferAt("2011-04-32")).toThrow(
      AGE_TRANSITION_ERROR_CODES.INVALID_DOB,
    );
  });

  it("accepts a leap-year DOB and returns a valid ISO string", () => {
    const iso = computeAutoTransferAt("2008-02-29");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    // 2024 is a leap year so 2024-02-29 is valid · pinned expectation.
    expect(iso.startsWith("2024-02-29") || iso.startsWith("2024-03-01")).toBe(
      true,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// §2 · daysUntil
// ─────────────────────────────────────────────────────────────────────

describe("daysUntil", () => {
  it("returns 0 when target equals now", () => {
    expect(daysUntil("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
  });

  it("returns 30 when target is 30 days later", () => {
    expect(daysUntil("2026-01-31T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(30);
  });

  it("returns a negative value when target is in the past", () => {
    expect(daysUntil("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(-31);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §3 · listUpcomingTransitions
// ─────────────────────────────────────────────────────────────────────

describe("listUpcomingTransitions", () => {
  it("returns an entry when the custody is within the 30-day window", async () => {
    withClientResponder = () => ({
      rows: [custodyRow({ auto_transfer_at: "2026-02-01T00:00:00.000Z" })],
      rowCount: 1,
    });
    const r = await listUpcomingTransitions(
      PARENT,
      30,
      "2026-01-15T00:00:00.000Z",
    );
    expect(r.length).toBe(1);
    expect(r[0]!.custodyId).toBe(CUSTODY);
    expect(r[0]!.daysUntilTransfer).toBe(17);
    expect(r[0]!.state).toBe("scheduled");
    expect(r[0]!.simulated).toBe(true);
  });

  it("returns empty when parent id is empty", async () => {
    const r = await listUpcomingTransitions("");
    expect(r).toEqual([]);
    expect(withClientCalls.length).toBe(0);
  });

  it("returns empty on DB unavailable (fail-closed)", async () => {
    withClientUnavailable = true;
    const r = await listUpcomingTransitions(PARENT);
    expect(r).toEqual([]);
  });

  it("passes the window end timestamp to the SQL as a parameter", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await listUpcomingTransitions(PARENT, 30, "2026-01-01T00:00:00.000Z");
    expect(withClientCalls[0]!.params[0]).toBe(PARENT);
    expect(String(withClientCalls[0]!.params[1])).toMatch(
      /^2026-01-31T00:00:00/,
    );
  });

  it("filters out transferred / revoked rows via SQL (clause present)", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await listUpcomingTransitions(PARENT);
    expect(withClientCalls[0]!.sql).toMatch(/transferred_at IS NULL/i);
    expect(withClientCalls[0]!.sql).toMatch(/revoked_at IS NULL/i);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §4 · requestChildConfirmation
// ─────────────────────────────────────────────────────────────────────

describe("requestChildConfirmation", () => {
  it("records the request when actor is the parent", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    const r = await requestChildConfirmation(
      CUSTODY,
      PARENT,
      "2026-01-15T00:00:00.000Z",
    );
    expect(r.ok).toBe(true);
    expect(r.action).toBe("child_confirmation_requested");
    expect(r.audit).not.toBeNull();
    expect(r.audit?.actorAccountId).toBe(PARENT);
    expect(r.audit?.simulated).toBe(true);
  });

  it("denies when actor is not the parent", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    const r = await requestChildConfirmation(CUSTODY, OTHER);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("denies when custody not found", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await requestChildConfirmation(CUSTODY, PARENT);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.CUSTODY_NOT_FOUND);
  });

  it("denies when custody is already transferred", async () => {
    withClientResponder = () => ({
      rows: [custodyRow({ transferred_at: "2026-01-01T00:00:00.000Z" })],
      rowCount: 1,
    });
    const r = await requestChildConfirmation(CUSTODY, PARENT);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.ALREADY_TRANSFERRED);
  });

  it("denies on invalid custodyId", async () => {
    const r = await requestChildConfirmation("", PARENT);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.INVALID_CUSTODY_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §5 · confirmChildHandover · atomic transfer
// ─────────────────────────────────────────────────────────────────────

describe("confirmChildHandover", () => {
  function okResponder() {
    let step = 0;
    return () => {
      step += 1;
      switch (step) {
        case 1:
          return { rows: [custodyRow()], rowCount: 1 };
        case 2:
          return { rows: [], rowCount: 0 }; // BEGIN
        case 3:
          return { rows: [], rowCount: 1 }; // UPDATE custody
        case 4:
          return { rows: [], rowCount: 1 }; // UPDATE minor_profile
        default:
          return { rows: [], rowCount: 0 }; // COMMIT
      }
    };
  }

  it("transitions atomically when child confirms", async () => {
    withClientResponder = okResponder();
    const r = await confirmChildHandover(
      CUSTODY,
      CHILD,
      "2027-04-02T12:00:00.000Z",
    );
    expect(r.ok).toBe(true);
    expect(r.action).toBe("child_confirmed");
    expect(r.completedAt).toBe("2027-04-02T12:00:00.000Z");
    expect(r.audit?.actorAccountId).toBe(CHILD);
    // Expect BEGIN · UPDATE · UPDATE · COMMIT.
    const sqls = withClientCalls.map((c) => c.sql.toUpperCase().trim());
    expect(sqls.some((s) => s.startsWith("BEGIN"))).toBe(true);
    expect(sqls.some((s) => s.startsWith("COMMIT"))).toBe(true);
    expect(
      sqls.filter((s) => s.includes("UPDATE NEX.PARENT_CUSTODY_LINK")).length,
    ).toBe(1);
    expect(
      sqls.filter((s) => s.includes("UPDATE NEX.ACCOUNT_MINOR_PROFILE")).length,
    ).toBe(1);
  });

  it("rolls back on partial failure when custody UPDATE affects 0 rows", async () => {
    let step = 0;
    withClientResponder = () => {
      step += 1;
      switch (step) {
        case 1:
          return { rows: [custodyRow()], rowCount: 1 };
        case 2:
          return { rows: [], rowCount: 0 }; // BEGIN
        case 3:
          return { rows: [], rowCount: 0 }; // UPDATE custody · race lost
        default:
          return { rows: [], rowCount: 0 };
      }
    };
    const r = await confirmChildHandover(CUSTODY, CHILD);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.TRANSITION_ATOMIC_FAILURE);
    const sqls = withClientCalls.map((c) => c.sql.toUpperCase().trim());
    expect(sqls.some((s) => s.startsWith("ROLLBACK"))).toBe(true);
  });

  it("rolls back when minor_profile UPDATE affects 0 rows", async () => {
    let step = 0;
    withClientResponder = () => {
      step += 1;
      switch (step) {
        case 1:
          return { rows: [custodyRow()], rowCount: 1 };
        case 2:
          return { rows: [], rowCount: 0 };
        case 3:
          return { rows: [], rowCount: 1 };
        case 4:
          return { rows: [], rowCount: 0 }; // missing minor profile row
        default:
          return { rows: [], rowCount: 0 };
      }
    };
    const r = await confirmChildHandover(CUSTODY, CHILD);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.TRANSITION_ATOMIC_FAILURE);
  });

  it("denies when actor is not the child", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    const r = await confirmChildHandover(CUSTODY, OTHER);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("denies when actor is the parent (parent cannot confirm for child)", async () => {
    withClientResponder = () => ({ rows: [custodyRow()], rowCount: 1 });
    const r = await confirmChildHandover(CUSTODY, PARENT);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("denies when custody is already transferred", async () => {
    withClientResponder = () => ({
      rows: [custodyRow({ transferred_at: "2027-05-01T00:00:00.000Z" })],
      rowCount: 1,
    });
    const r = await confirmChildHandover(CUSTODY, CHILD);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.ALREADY_TRANSFERRED);
  });

  it("denies when custody is revoked", async () => {
    withClientResponder = () => ({
      rows: [custodyRow({ revoked_at: "2027-05-01T00:00:00.000Z" })],
      rowCount: 1,
    });
    const r = await confirmChildHandover(CUSTODY, CHILD);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(AGE_TRANSITION_ERROR_CODES.ALREADY_REVOKED);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §6 · sweepPendingTransitions
// ─────────────────────────────────────────────────────────────────────

describe("sweepPendingTransitions", () => {
  it("transfers each due custody and reports counts", async () => {
    let step = 0;
    withClientResponder = (sql) => {
      step += 1;
      if (step === 1) {
        // Candidate list.
        return {
          rows: [{ custody_id: CUSTODY }],
          rowCount: 1,
        };
      }
      // Each custody runs: SELECT · BEGIN · UPDATE · UPDATE · COMMIT.
      const trimmed = sql.toUpperCase().trim();
      if (trimmed.startsWith("SELECT"))
        return { rows: [custodyRow()], rowCount: 1 };
      if (trimmed.startsWith("BEGIN")) return { rows: [], rowCount: 0 };
      if (trimmed.startsWith("UPDATE")) return { rows: [], rowCount: 1 };
      if (trimmed.startsWith("COMMIT")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    };
    const r = await sweepPendingTransitions("2027-04-02T00:00:00.000Z");
    expect(r.scanned).toBe(1);
    expect(r.transferred).toBe(1);
    expect(r.failures).toBe(0);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0]!.action).toBe("age_transfer_completed_auto");
    expect(r.entries[0]!.actorAccountId).toBeNull();
  });

  it("is idempotent · a second run after transfer finds nothing", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await sweepPendingTransitions("2027-04-02T00:00:00.000Z");
    expect(r.scanned).toBe(0);
    expect(r.transferred).toBe(0);
    expect(r.failures).toBe(0);
  });

  it("skips custodies that are not yet due", async () => {
    let step = 0;
    withClientResponder = (sql) => {
      step += 1;
      if (step === 1) {
        return {
          rows: [{ custody_id: CUSTODY }],
          rowCount: 1,
        };
      }
      const trimmed = sql.toUpperCase().trim();
      if (trimmed.startsWith("SELECT")) {
        // Not due · auto_transfer_at is in the future relative to nowIso.
        return {
          rows: [
            custodyRow({ auto_transfer_at: "2099-01-01T00:00:00.000Z" }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await sweepPendingTransitions("2027-04-02T00:00:00.000Z");
    expect(r.scanned).toBe(1);
    expect(r.transferred).toBe(0);
    expect(r.failures).toBe(1);
  });

  it("returns empty when nowIso is invalid", async () => {
    const r = await sweepPendingTransitions("not-a-date");
    expect(r).toEqual({
      scanned: 0,
      transferred: 0,
      failures: 0,
      entries: [],
    });
  });
});

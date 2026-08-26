// Regression tests for scripts/nex-worker/cost-oracle.mjs
// Philip 2026-08-26 · Discovery Fabric P8 · Foundation C.

import { describe, it, expect } from "vitest";
import {
  checkBudget,
  recordSpend,
  resetDailyIfNeeded,
  COST_ORACLE_REASONS,
} from "./cost-oracle.mjs";

/**
 * Minimal pg-Pool mock. Every test constructs its own with a scripted list of
 * (matcher, response) tuples. Matcher is a regex over the SQL text. First
 * match wins and is consumed.
 */
function makeMockPool(script) {
  const remaining = [...script];
  const clientQueries = [];
  return {
    query: async (sql /*, params */) => {
      const idx = remaining.findIndex(([re]) => re.test(sql));
      if (idx === -1) throw new Error(`mock pool: unmatched SQL: ${sql}`);
      const [, response] = remaining.splice(idx, 1)[0];
      return typeof response === "function" ? response() : response;
    },
    connect: async () => ({
      query: async (sql /*, params */) => {
        clientQueries.push(sql);
        const idx = remaining.findIndex(([re]) => re.test(sql));
        if (idx === -1) {
          // BEGIN / COMMIT / ROLLBACK may not be scripted · treat as no-ops.
          if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) {
            return { rows: [], rowCount: 0 };
          }
          throw new Error(`mock pool client: unmatched SQL: ${sql}`);
        }
        const [, response] = remaining.splice(idx, 1)[0];
        return typeof response === "function" ? response() : response;
      },
      release: () => {},
    }),
    _remaining: remaining,
    _clientQueries: clientQueries,
  };
}

describe("checkBudget", () => {
  it("allowed=true when spent+projected < cap", async () => {
    const pool = makeMockPool([
      [/FROM nex\.cost_budget WHERE branch/,
        { rows: [{ branch: "food", daily_cap_usd: "10.0000", spent_today_usd: "1.000000", circuit_open_at: null }], rowCount: 1 }],
      [/FROM nex\.provider_registry WHERE provider_id/,
        { rows: [{ cost_per_request_usd: "0.017000" }], rowCount: 1 }],
    ]);
    const r = await checkBudget(pool, "food", "google-places", 10);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe(COST_ORACLE_REASONS.OK);
    expect(r.spentUsd).toBe(1);
    expect(r.capUsd).toBe(10);
    expect(r.projectedSpendUsd).toBeCloseTo(0.17, 6);
    expect(r.remainingUsd).toBeCloseTo(9, 6);
  });

  it("allowed=false with CAP_EXCEEDED_PROJECTED when spent+projected > cap", async () => {
    const pool = makeMockPool([
      [/FROM nex\.cost_budget/,
        { rows: [{ branch: "food", daily_cap_usd: "10.0000", spent_today_usd: "9.900000", circuit_open_at: null }], rowCount: 1 }],
      [/FROM nex\.provider_registry/,
        { rows: [{ cost_per_request_usd: "0.017000" }], rowCount: 1 }],
    ]);
    const r = await checkBudget(pool, "food", "google-places", 20);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(COST_ORACLE_REASONS.CAP_EXCEEDED_PROJECTED);
  });

  it("allowed=false with CIRCUIT_OPEN_TODAY when circuit_open_at is set", async () => {
    const pool = makeMockPool([
      [/FROM nex\.cost_budget/,
        { rows: [{ branch: "food", daily_cap_usd: "10.0000", spent_today_usd: "10.500000", circuit_open_at: new Date().toISOString() }], rowCount: 1 }],
      [/FROM nex\.provider_registry/,
        { rows: [{ cost_per_request_usd: "0.017000" }], rowCount: 1 }],
    ]);
    const r = await checkBudget(pool, "food", "google-places", 1);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(COST_ORACLE_REASONS.CIRCUIT_OPEN_TODAY);
  });

  it("UNKNOWN_BRANCH when cost_budget row is missing", async () => {
    const pool = makeMockPool([
      [/FROM nex\.cost_budget/, { rows: [], rowCount: 0 }],
    ]);
    const r = await checkBudget(pool, "unknown", "google-places");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(COST_ORACLE_REASONS.UNKNOWN_BRANCH);
  });

  it("UNKNOWN_PROVIDER when provider_registry row is missing", async () => {
    const pool = makeMockPool([
      [/FROM nex\.cost_budget/,
        { rows: [{ branch: "food", daily_cap_usd: "10.0000", spent_today_usd: "0.000000", circuit_open_at: null }], rowCount: 1 }],
      [/FROM nex\.provider_registry/, { rows: [], rowCount: 0 }],
    ]);
    const r = await checkBudget(pool, "food", "nope");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(COST_ORACLE_REASONS.UNKNOWN_PROVIDER);
  });
});

describe("recordSpend", () => {
  it("increments spent_today_usd atomically (no circuit opened when below cap)", async () => {
    const pool = makeMockPool([
      [/^\s*BEGIN ISOLATION LEVEL SERIALIZABLE/i, { rows: [], rowCount: 0 }],
      [/SELECT daily_cap_usd/,
        { rows: [{ daily_cap_usd: "10.0000", spent_today_usd: "1.000000", circuit_open_at: null }], rowCount: 1 }],
      [/UPDATE nex\.cost_budget[\s\S]*SET spent_today_usd = \$1,[\s\S]*updated_at/,
        { rows: [], rowCount: 1 }],
      [/^\s*COMMIT/i, { rows: [], rowCount: 0 }],
    ]);
    const r = await recordSpend(pool, "food", "google-places", 100, 1.7);
    expect(r.newSpentUsd).toBeCloseTo(2.7, 6);
    expect(r.capUsd).toBe(10);
    expect(r.circuitOpenedNow).toBe(false);
  });

  it("sets circuit_open_at when new spent >= cap", async () => {
    let updateCapturedSql = "";
    const pool = makeMockPool([
      [/^\s*BEGIN ISOLATION LEVEL SERIALIZABLE/i, { rows: [], rowCount: 0 }],
      [/SELECT daily_cap_usd/,
        { rows: [{ daily_cap_usd: "10.0000", spent_today_usd: "9.500000", circuit_open_at: null }], rowCount: 1 }],
      [/UPDATE nex\.cost_budget[\s\S]*circuit_open_at\s*=\s*now\(\)/,
        () => { updateCapturedSql = "circuit"; return { rows: [], rowCount: 1 }; }],
      [/^\s*COMMIT/i, { rows: [], rowCount: 0 }],
    ]);
    const r = await recordSpend(pool, "food", "google-places", 100, 1.0);
    expect(r.circuitOpenedNow).toBe(true);
    expect(r.newSpentUsd).toBeCloseTo(10.5, 6);
    expect(updateCapturedSql).toBe("circuit");
  });

  it("does NOT re-stamp circuit when already open (idempotent)", async () => {
    const pool = makeMockPool([
      [/^\s*BEGIN ISOLATION LEVEL SERIALIZABLE/i, { rows: [], rowCount: 0 }],
      [/SELECT daily_cap_usd/,
        { rows: [{ daily_cap_usd: "10.0000", spent_today_usd: "12.000000", circuit_open_at: new Date().toISOString() }], rowCount: 1 }],
      [/UPDATE nex\.cost_budget[\s\S]*SET spent_today_usd = \$1,[\s\S]*updated_at/,
        { rows: [], rowCount: 1 }],
      [/^\s*COMMIT/i, { rows: [], rowCount: 0 }],
    ]);
    const r = await recordSpend(pool, "food", "google-places", 100, 1.0);
    expect(r.circuitOpenedNow).toBe(false);
    expect(r.newSpentUsd).toBeCloseTo(13.0, 6);
  });

  it("throws on unknown branch", async () => {
    const pool = makeMockPool([
      [/^\s*BEGIN ISOLATION LEVEL SERIALIZABLE/i, { rows: [], rowCount: 0 }],
      [/SELECT daily_cap_usd/, { rows: [], rowCount: 0 }],
      [/^\s*ROLLBACK/i, { rows: [], rowCount: 0 }],
    ]);
    await expect(recordSpend(pool, "unknown", "google-places", 1, 0.1)).rejects.toThrow(/unknown branch/);
  });

  it("throws on negative cost", async () => {
    const pool = makeMockPool([]);
    await expect(recordSpend(pool, "food", "google-places", 1, -0.1)).rejects.toThrow(/actualCostUsd must be >= 0/);
  });
});

describe("resetDailyIfNeeded", () => {
  it("resets when last_reset_at is on a previous day", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const newReset = new Date().toISOString();

    const pool = makeMockPool([
      [/SELECT last_reset_at FROM nex\.cost_budget/,
        { rows: [{ last_reset_at: yesterday.toISOString() }], rowCount: 1 }],
      [/UPDATE nex\.cost_budget[\s\S]*spent_today_usd = 0[\s\S]*circuit_open_at = NULL/,
        { rows: [{ last_reset_at: newReset }], rowCount: 1 }],
    ]);
    const r = await resetDailyIfNeeded(pool, "food");
    expect(r.reset).toBe(true);
    expect(r.newLastResetAt).toBe(newReset);
  });

  it("no-op when last_reset_at is same day (UTC)", async () => {
    const now = new Date();
    const pool = makeMockPool([
      [/SELECT last_reset_at FROM nex\.cost_budget/,
        { rows: [{ last_reset_at: now.toISOString() }], rowCount: 1 }],
    ]);
    const r = await resetDailyIfNeeded(pool, "food");
    expect(r.reset).toBe(false);
    expect(r.newLastResetAt).toBe(now.toISOString());
  });

  it("returns reset=false when branch is missing", async () => {
    const pool = makeMockPool([
      [/SELECT last_reset_at FROM nex\.cost_budget/, { rows: [], rowCount: 0 }],
    ]);
    const r = await resetDailyIfNeeded(pool, "unknown");
    expect(r.reset).toBe(false);
    expect(r.newLastResetAt).toBeNull();
  });
});

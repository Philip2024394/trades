// src/lib/nex-native/family-safety/minor-safechat-enforcer.test.ts
//
// CC-3 · Minor SafeChat enforcer tests. Mocks `@/lib/nex/db` · the
// enforcer never touches a real database in test. 15+ scenarios cover
// the enforcement condition, the global-flag fallthrough, the Phase 1
// ceiling on `userFacingEnabled`, and the sealed "parent cannot flip
// the always-on flag to FALSE" guardrail.

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
  MINOR_SAFECHAT_ENFORCER_ERROR_CODES,
  isSafeChatEnforcedForAccount,
  preventFlagFlipByParent,
  resolveSafeChatFlagsForAccount,
} from "./minor-safechat-enforcer";

const ORIGINAL_ENV = { ...process.env };
const PARENT = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";

function minorRow(overrides: Record<string, unknown> = {}) {
  return {
    account_id: CHILD,
    is_minor: true,
    safechat_always_on: true,
    parent_custody_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED;
  delete process.env.NEX_SAFECHAT_USER_FACING_ENABLED;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

// ─────────────────────────────────────────────────────────────────────
// §1 · isSafeChatEnforcedForAccount
// ─────────────────────────────────────────────────────────────────────

describe("isSafeChatEnforcedForAccount", () => {
  it("returns TRUE when account is minor + safechat_always_on", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    const r = await isSafeChatEnforcedForAccount(CHILD);
    expect(r).toBe(true);
  });

  it("returns FALSE when the profile row is absent", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await isSafeChatEnforcedForAccount(CHILD);
    expect(r).toBe(false);
  });

  it("returns FALSE when is_minor is FALSE", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ is_minor: false })],
      rowCount: 1,
    });
    const r = await isSafeChatEnforcedForAccount(CHILD);
    expect(r).toBe(false);
  });

  it("returns FALSE when safechat_always_on is FALSE", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ safechat_always_on: false })],
      rowCount: 1,
    });
    const r = await isSafeChatEnforcedForAccount(CHILD);
    expect(r).toBe(false);
  });

  it("returns FALSE when accountId is empty", async () => {
    const r = await isSafeChatEnforcedForAccount("");
    expect(r).toBe(false);
    expect(withClientCalls.length).toBe(0);
  });

  it("returns FALSE and never throws when the DB pool is unavailable", async () => {
    withClientUnavailable = true;
    const r = await isSafeChatEnforcedForAccount(CHILD);
    expect(r).toBe(false);
  });

  it("queries nex.account_minor_profile exactly once per call", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    await isSafeChatEnforcedForAccount(CHILD);
    expect(withClientCalls.length).toBe(1);
    expect(withClientCalls[0]!.sql).toMatch(/nex\.account_minor_profile/i);
    expect(withClientCalls[0]!.params[0]).toBe(CHILD);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §2 · resolveSafeChatFlagsForAccount · minor path
// ─────────────────────────────────────────────────────────────────────

describe("resolveSafeChatFlagsForAccount · minor accounts", () => {
  it("returns loggingEnabled=TRUE + userFacingEnabled=TRUE + enforcedForMinor=TRUE for a minor", async () => {
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    const r = await resolveSafeChatFlagsForAccount(CHILD);
    expect(r.loggingEnabled).toBe(true);
    expect(r.userFacingEnabled).toBe(true);
    expect(r.enforcedForMinor).toBe(true);
  });

  it("enforces TRUE even when global env flags are OFF (default)", async () => {
    // Explicit · no env vars set.
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    const r = await resolveSafeChatFlagsForAccount(CHILD);
    expect(r.loggingEnabled).toBe(true);
    expect(r.userFacingEnabled).toBe(true);
  });

  it("enforces TRUE even when global env flags are explicitly OFF", async () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "false";
    process.env.NEX_SAFECHAT_USER_FACING_ENABLED = "false";
    withClientResponder = () => ({ rows: [minorRow()], rowCount: 1 });
    const r = await resolveSafeChatFlagsForAccount(CHILD);
    expect(r.loggingEnabled).toBe(true);
    expect(r.userFacingEnabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §3 · resolveSafeChatFlagsForAccount · non-minor path
// ─────────────────────────────────────────────────────────────────────

describe("resolveSafeChatFlagsForAccount · non-minor accounts", () => {
  it("honours the global default (both OFF) when no minor profile exists", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolveSafeChatFlagsForAccount(CHILD);
    expect(r.loggingEnabled).toBe(false);
    expect(r.userFacingEnabled).toBe(false);
    expect(r.enforcedForMinor).toBe(false);
  });

  it("honours NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED=true for a non-minor", async () => {
    process.env.NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED = "true";
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolveSafeChatFlagsForAccount(CHILD);
    expect(r.loggingEnabled).toBe(true);
    expect(r.userFacingEnabled).toBe(false);
    expect(r.enforcedForMinor).toBe(false);
  });

  it("treats a transferred (is_minor=false) account as non-minor", async () => {
    withClientResponder = () => ({
      rows: [minorRow({ is_minor: false })],
      rowCount: 1,
    });
    const r = await resolveSafeChatFlagsForAccount(CHILD);
    expect(r.enforcedForMinor).toBe(false);
    expect(r.loggingEnabled).toBe(false);
    expect(r.userFacingEnabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §4 · preventFlagFlipByParent · the sealed guardrail
// ─────────────────────────────────────────────────────────────────────

describe("preventFlagFlipByParent · parent cannot disable SafeChat", () => {
  it("throws PARENT_CANNOT_DISABLE when parent flips safechat_always_on=FALSE", () => {
    expect(() =>
      preventFlagFlipByParent(PARENT, CHILD, {
        field: "safechat_always_on",
        nextValue: false,
      }),
    ).toThrow(
      MINOR_SAFECHAT_ENFORCER_ERROR_CODES.PARENT_CANNOT_DISABLE,
    );
  });

  it("does not throw when parent sets safechat_always_on=TRUE (no-op)", () => {
    expect(() =>
      preventFlagFlipByParent(PARENT, CHILD, {
        field: "safechat_always_on",
        nextValue: true,
      }),
    ).not.toThrow();
  });

  it("throws UNAUTHORIZED_ACTOR when parentAccountId is empty", () => {
    expect(() =>
      preventFlagFlipByParent("", CHILD, {
        field: "safechat_always_on",
        nextValue: false,
      }),
    ).toThrow(MINOR_SAFECHAT_ENFORCER_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("throws INVALID_ACCOUNT_ID when childAccountId is empty", () => {
    expect(() =>
      preventFlagFlipByParent(PARENT, "", {
        field: "safechat_always_on",
        nextValue: false,
      }),
    ).toThrow(MINOR_SAFECHAT_ENFORCER_ERROR_CODES.INVALID_ACCOUNT_ID);
  });

  it("throws INVALID_ACCOUNT_ID when parent and child are the same account", () => {
    expect(() =>
      preventFlagFlipByParent(PARENT, PARENT, {
        field: "safechat_always_on",
        nextValue: false,
      }),
    ).toThrow(MINOR_SAFECHAT_ENFORCER_ERROR_CODES.INVALID_ACCOUNT_ID);
  });

  it("error codes do not include account ids or content tokens", () => {
    const values = Object.values(MINOR_SAFECHAT_ENFORCER_ERROR_CODES).join("|");
    expect(values).not.toMatch(/[0-9a-f]{8}-/i);
    expect(values).not.toMatch(/\bmessage\b|\bciphertext\b|\bplaintext\b/i);
  });
});

// src/lib/nex-native/__tests__/vault-rate-limit.test.ts
//
// Vault Phase A · Commit A.2 · PIN + recovery rate-limit tests.
//
// Deterministic. Uses the same tiny in-memory Supabase mock pattern as
// vault-step-up.test.ts, scoped to the two append-only tables the
// rate-limit service touches (nex_vault_pin_attempt,
// nex_vault_recovery_attempt).
//
// Policy under test (locked at design §H):
//   PIN:
//     · 5 failures / 15 min window per (account, device) → window_exceeded
//     · 10 failures / 24 h scope per (account, device)   → escalated_lockout
//   Recovery:
//     · 5 failures / 1 h window per account              → cooldown_active
//     · 24 h cooldown after breach

import { describe, test, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
const store: {
  nex_vault_pin_attempt: Row[];
  nex_vault_recovery_attempt: Row[];
} = {
  nex_vault_pin_attempt: [],
  nex_vault_recovery_attempt: [],
};

function makeSelect(table: keyof typeof store) {
  const filters: Row = {};
  const gteFilters: Record<string, string> = {};
  let orderCol: string | null = null;
  let orderAscending = true;
  const builder: Record<string, unknown> = {
    select() {
      return builder;
    },
    eq(col: string, val: unknown) {
      filters[col] = val;
      return builder;
    },
    gte(col: string, val: string) {
      gteFilters[col] = val;
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderAscending = opts?.ascending !== false;
      return builder;
    },
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      let rows = store[table].filter((r) => {
        for (const [col, want] of Object.entries(filters)) {
          if (r[col] !== want) return false;
        }
        for (const [col, iso] of Object.entries(gteFilters)) {
          const t = new Date(r[col] as string).getTime();
          if (t < new Date(iso).getTime()) return false;
        }
        return true;
      });
      if (orderCol) {
        rows = [...rows].sort((a, b) => {
          const ta = new Date(a[orderCol!] as string).getTime();
          const tb = new Date(b[orderCol!] as string).getTime();
          return orderAscending ? ta - tb : tb - ta;
        });
      }
      resolve({ data: rows, error: null });
    },
  };
  return builder;
}

function makeInsert(table: keyof typeof store, row: Row) {
  return {
    then(resolve: (v: { error: null }) => void) {
      store[table].push({ ...row });
      resolve({ error: null });
    },
  };
}

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return {
        select: () => makeSelect(table as keyof typeof store),
        insert: (row: Row) => makeInsert(table as keyof typeof store, row),
      };
    },
  },
}));

import {
  PIN_WINDOW_SECONDS,
  PIN_MAX_ATTEMPTS_IN_WINDOW,
  PIN_LOCKOUT_SECONDS,
  PIN_ESCALATION_WINDOW_SECONDS,
  RECOVERY_WINDOW_SECONDS,
  RECOVERY_MAX_ATTEMPTS_IN_WINDOW,
  RECOVERY_COOLDOWN_SECONDS,
  recordPinAttempt,
  checkPinRateLimit,
  recordRecoveryAttempt,
  checkRecoveryRateLimit,
} from "../vault/pin-rate-limit";

const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DEVICE_X = "device-xxxx-01";
const DEVICE_Y = "device-yyyy-02";

beforeEach(() => {
  store.nex_vault_pin_attempt.length = 0;
  store.nex_vault_recovery_attempt.length = 0;
});

// ---------------------------------------------------------------------------
// Policy constants locked at Phase A birth
// ---------------------------------------------------------------------------
describe("rate-limit · policy constants", () => {
  test("PIN window is 15 min", () => {
    expect(PIN_WINDOW_SECONDS).toBe(900);
  });
  test("PIN max attempts in window is 5", () => {
    expect(PIN_MAX_ATTEMPTS_IN_WINDOW).toBe(5);
  });
  test("PIN lockout is 1h", () => {
    expect(PIN_LOCKOUT_SECONDS).toBe(3600);
  });
  test("PIN escalation window is 24h", () => {
    expect(PIN_ESCALATION_WINDOW_SECONDS).toBe(86400);
  });
  test("Recovery window is 1h", () => {
    expect(RECOVERY_WINDOW_SECONDS).toBe(3600);
  });
  test("Recovery max attempts is 5", () => {
    expect(RECOVERY_MAX_ATTEMPTS_IN_WINDOW).toBe(5);
  });
  test("Recovery cooldown is 24h", () => {
    expect(RECOVERY_COOLDOWN_SECONDS).toBe(86400);
  });
});

// ---------------------------------------------------------------------------
// recordPinAttempt + checkPinRateLimit
// ---------------------------------------------------------------------------
describe("rate-limit · PIN · fresh account allowed", () => {
  test("no history → allowed", async () => {
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
    });
    expect(v.allowed).toBe(true);
    expect(v.reason).toBeNull();
    expect(v.diagnostics.failuresInWindow).toBe(0);
  });

  test("1 failure → still allowed", async () => {
    await recordPinAttempt({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      success: false,
    });
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
    });
    expect(v.allowed).toBe(true);
    expect(v.diagnostics.failuresInWindow).toBe(1);
  });

  test("4 failures → still allowed", async () => {
    for (let i = 0; i < 4; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
      });
    }
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
    });
    expect(v.allowed).toBe(true);
    expect(v.diagnostics.failuresInWindow).toBe(4);
  });
});

describe("rate-limit · PIN · 5 failures triggers window_exceeded", () => {
  test("5 failures within 15 min window → not allowed, window_exceeded", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
        at: new Date(now.getTime() - (14 - i * 2) * 60 * 1000),
      });
    }
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now,
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("window_exceeded");
    expect(v.retryAfterSeconds).toBeGreaterThan(0);
    expect(v.retryAfterSeconds).toBeLessThanOrEqual(PIN_LOCKOUT_SECONDS);
  });

  test("Retry-After seconds decreases as time passes", async () => {
    const base = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
        at: new Date(base.getTime() - i * 60 * 1000),
      });
    }
    const vEarly = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now: new Date(base.getTime() + 10 * 60 * 1000),
    });
    const vLate = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now: new Date(base.getTime() + 50 * 60 * 1000),
    });
    expect(vEarly.retryAfterSeconds).toBeGreaterThan(vLate.retryAfterSeconds);
  });
});

describe("rate-limit · PIN · 10 failures in 24h triggers escalated_lockout", () => {
  test("10 failures spread over 24h → escalated_lockout", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 10; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
        // Scatter: half old, half within last 15 min
        at: new Date(now.getTime() - (i < 5 ? 20 * 60 * 60 : 5 * 60) * 1000),
      });
    }
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now,
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("escalated_lockout");
  });
});

describe("rate-limit · PIN · success does not count against the limit", () => {
  test("5 successes in window → still allowed", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: true,
        at: new Date(now.getTime() - i * 60 * 1000),
      });
    }
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now,
    });
    expect(v.allowed).toBe(true);
    expect(v.diagnostics.failuresInWindow).toBe(0);
  });
});

describe("rate-limit · PIN · scope isolation", () => {
  test("account A's failures do not affect account B", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
        at: new Date(now.getTime() - i * 60 * 1000),
      });
    }
    const va = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now,
    });
    const vb = await checkPinRateLimit({
      accountId: ACCOUNT_B,
      deviceId: DEVICE_X,
      now,
    });
    expect(va.allowed).toBe(false);
    expect(vb.allowed).toBe(true);
  });

  test("device X's failures do not affect device Y (same account)", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
        at: new Date(now.getTime() - i * 60 * 1000),
      });
    }
    const vx = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now,
    });
    const vy = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_Y,
      now,
    });
    expect(vx.allowed).toBe(false);
    expect(vy.allowed).toBe(true);
  });
});

describe("rate-limit · PIN · old failures roll out", () => {
  test("5 failures that are all 20 min old → allowed again", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordPinAttempt({
        accountId: ACCOUNT_A,
        deviceId: DEVICE_X,
        success: false,
        at: new Date(now.getTime() - (20 * 60 + i * 60) * 1000),
      });
    }
    const v = await checkPinRateLimit({
      accountId: ACCOUNT_A,
      deviceId: DEVICE_X,
      now,
    });
    expect(v.diagnostics.failuresInWindow).toBe(0);
    expect(v.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// recordRecoveryAttempt + checkRecoveryRateLimit
// ---------------------------------------------------------------------------
describe("rate-limit · recovery · policy", () => {
  test("no history → allowed", async () => {
    const v = await checkRecoveryRateLimit({ accountId: ACCOUNT_A });
    expect(v.allowed).toBe(true);
    expect(v.reason).toBeNull();
  });

  test("4 failures in window → still allowed", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 4; i++) {
      await recordRecoveryAttempt({
        accountId: ACCOUNT_A,
        success: false,
        at: new Date(now.getTime() - i * 5 * 60 * 1000),
      });
    }
    const v = await checkRecoveryRateLimit({ accountId: ACCOUNT_A, now });
    expect(v.allowed).toBe(true);
  });

  test("5 failures in 1h window → cooldown_active, 24h retry", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordRecoveryAttempt({
        accountId: ACCOUNT_A,
        success: false,
        at: new Date(now.getTime() - i * 5 * 60 * 1000),
      });
    }
    const v = await checkRecoveryRateLimit({ accountId: ACCOUNT_A, now });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("cooldown_active");
    expect(v.retryAfterSeconds).toBeGreaterThan(0);
    expect(v.retryAfterSeconds).toBeLessThanOrEqual(RECOVERY_COOLDOWN_SECONDS);
  });

  test("cooldown expires after 24h", async () => {
    const base = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordRecoveryAttempt({
        accountId: ACCOUNT_A,
        success: false,
        at: new Date(base.getTime() - i * 60 * 1000),
      });
    }
    const vDuring = await checkRecoveryRateLimit({
      accountId: ACCOUNT_A,
      now: new Date(base.getTime() + 10 * 60 * 60 * 1000),
    });
    const vAfter = await checkRecoveryRateLimit({
      accountId: ACCOUNT_A,
      now: new Date(base.getTime() + 25 * 60 * 60 * 1000),
    });
    expect(vDuring.allowed).toBe(false);
    expect(vAfter.allowed).toBe(true);
  });

  test("success in window does not count as failure", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordRecoveryAttempt({
        accountId: ACCOUNT_A,
        success: true,
        at: new Date(now.getTime() - i * 5 * 60 * 1000),
      });
    }
    const v = await checkRecoveryRateLimit({ accountId: ACCOUNT_A, now });
    expect(v.allowed).toBe(true);
  });

  test("account scoping · A's failures do not affect B", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await recordRecoveryAttempt({
        accountId: ACCOUNT_A,
        success: false,
        at: new Date(now.getTime() - i * 60 * 1000),
      });
    }
    const va = await checkRecoveryRateLimit({ accountId: ACCOUNT_A, now });
    const vb = await checkRecoveryRateLimit({ accountId: ACCOUNT_B, now });
    expect(va.allowed).toBe(false);
    expect(vb.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Architecture guard · zero commercial references
// ---------------------------------------------------------------------------
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

describe("rate-limit · architecture guard", () => {
  test("source code does not reference commercial terms", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.resolve(__dirname, "../vault/pin-rate-limit.ts"),
      "utf8",
    );
    const code = stripComments(raw).toLowerCase();
    const banned = [
      "bisnis",
      "subscription",
      "entitlement",
      "quota",
      "allowance",
      "effectivetier",
      "tier-gate",
    ];
    for (const token of banned) {
      expect(code.includes(token), token).toBe(false);
    }
  });
});

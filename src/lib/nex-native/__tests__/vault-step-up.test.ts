// src/lib/nex-native/__tests__/vault-step-up.test.ts
//
// Vault Phase A · Commit A.2 · step-up freshness matrix tests.
//
// Deterministic. The service imports supabase-admin which cannot
// bootstrap in a test environment, so we mock it with a tiny in-memory
// query builder that only implements the chain the service actually
// uses: .from(table).select(...).eq(...).maybeSingle() /
// .from(table).update(...).eq(...).is(...). This proves the policy
// logic (freshness windows, missing factors, password-reset sweep)
// without touching a real DB.

import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal fake Supabase client that captures reads/writes
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const store: { nex_session: Row[] } = { nex_session: [] };
const writeLog: Array<{ table: string; op: string; patch?: Row; filters: Row }> = [];

function matches(row: Row, filters: Row): boolean {
  for (const [col, want] of Object.entries(filters)) {
    if (want === "__NULL__") {
      if (row[col] !== null && row[col] !== undefined) return false;
    } else if (row[col] !== want) {
      return false;
    }
  }
  return true;
}

function makeQuery(table: keyof typeof store) {
  const filters: Row = {};
  const builder: Record<string, unknown> = {
    select() {
      return builder;
    },
    eq(col: string, val: unknown) {
      filters[col] = val;
      return builder;
    },
    is(col: string, val: unknown) {
      if (val === null) filters[col] = "__NULL__";
      return builder;
    },
    async maybeSingle() {
      const row = store[table].find((r) => matches(r, filters));
      return { data: row ?? null, error: null };
    },
    async single() {
      const row = store[table].find((r) => matches(r, filters));
      if (!row) return { data: null, error: { message: "row not found" } };
      return { data: row, error: null };
    },
  };
  return builder;
}

function makeUpdate(table: keyof typeof store, patch: Row) {
  const filters: Row = {};
  const builder: Record<string, unknown> = {
    eq(col: string, val: unknown) {
      filters[col] = val;
      return builder;
    },
    is(col: string, val: unknown) {
      if (val === null) filters[col] = "__NULL__";
      return builder;
    },
    then(resolve: (v: { error: null }) => void) {
      const rows = store[table].filter((r) => matches(r, filters));
      for (const r of rows) Object.assign(r, patch);
      writeLog.push({ table, op: "update", patch, filters: { ...filters } });
      resolve({ error: null });
    },
  };
  return builder;
}

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return {
        select: () => makeQuery(table as keyof typeof store),
        update: (patch: Row) => makeUpdate(table as keyof typeof store, patch),
        insert() {
          throw new Error("step-up service should not INSERT nex_session rows");
        },
        delete() {
          throw new Error("step-up service should not DELETE nex_session rows");
        },
      };
    },
  },
}));

import {
  FRESH_PASSWORD_SECONDS,
  FRESH_WEBAUTHN_SECONDS,
  FRESH_VAULT_UNLOCK_SECONDS,
  requireStepUp,
  markPasswordVerified,
  markWebauthnVerified,
  markVaultUnlocked,
  clearAllStepUpForAccount,
  clearVaultUnlockForSession,
} from "../vault/step-up-service";

const SESSION_ID = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function seedSession(partial: Partial<Row> = {}) {
  store.nex_session.length = 0;
  store.nex_session.push({
    id: SESSION_ID,
    account_id: ACCOUNT_ID,
    last_password_verified_at: null,
    last_webauthn_verified_at: null,
    last_vault_unlock_at: null,
    revoked_at: null,
    ...partial,
  });
}

beforeEach(() => {
  store.nex_session.length = 0;
  writeLog.length = 0;
});

// ---------------------------------------------------------------------------
// Freshness windows locked at design §H
// ---------------------------------------------------------------------------
describe("step-up · freshness windows", () => {
  test("password window is 10 min", () => {
    expect(FRESH_PASSWORD_SECONDS).toBe(600);
  });
  test("WebAuthn window is 10 min", () => {
    expect(FRESH_WEBAUTHN_SECONDS).toBe(600);
  });
  test("Vault unlock window is 5 min", () => {
    expect(FRESH_VAULT_UNLOCK_SECONDS).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// requireStepUp · no requirement = pass
// ---------------------------------------------------------------------------
describe("step-up · no requirement passes", () => {
  test("empty requirement → ok, missing is empty", async () => {
    seedSession();
    const v = await requireStepUp(SESSION_ID, {});
    expect(v.ok).toBe(true);
    expect(v.missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// requireStepUp · null timestamps
// ---------------------------------------------------------------------------
describe("step-up · null freshness fails", () => {
  test("webauthn:'fresh' with null timestamp → missing webauthn", async () => {
    seedSession();
    const v = await requireStepUp(SESSION_ID, { webauthn: "fresh" });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(["webauthn"]);
    expect(v.freshness.webauthn?.ageSeconds).toBeNull();
    expect(v.freshness.webauthn?.fresh).toBe(false);
  });

  test("password:'fresh' with null timestamp → missing password", async () => {
    seedSession();
    const v = await requireStepUp(SESSION_ID, { password: "fresh" });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(["password"]);
  });

  test("vault_unlock:'fresh' with null timestamp → missing vault_unlock", async () => {
    seedSession();
    const v = await requireStepUp(SESSION_ID, { vault_unlock: "fresh" });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(["vault_unlock"]);
  });

  test("multi-factor requirement reports every missing factor", async () => {
    seedSession();
    const v = await requireStepUp(SESSION_ID, {
      password: "fresh",
      webauthn: "fresh",
    });
    expect(v.ok).toBe(false);
    expect(v.missing.sort()).toEqual(["password", "webauthn"]);
  });
});

// ---------------------------------------------------------------------------
// requireStepUp · stale vs fresh
// ---------------------------------------------------------------------------
describe("step-up · stale timestamps fail, fresh ones pass", () => {
  test("WebAuthn verified 599s ago is still fresh", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const ago = new Date(now.getTime() - 599 * 1000);
    seedSession({ last_webauthn_verified_at: ago.toISOString() });
    const v = await requireStepUp(SESSION_ID, { webauthn: "fresh" }, { now });
    expect(v.ok).toBe(true);
  });

  test("WebAuthn verified 601s ago is stale", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const ago = new Date(now.getTime() - 601 * 1000);
    seedSession({ last_webauthn_verified_at: ago.toISOString() });
    const v = await requireStepUp(SESSION_ID, { webauthn: "fresh" }, { now });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(["webauthn"]);
  });

  test("Vault unlock 299s ago is fresh (5 min window)", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const ago = new Date(now.getTime() - 299 * 1000);
    seedSession({ last_vault_unlock_at: ago.toISOString() });
    const v = await requireStepUp(
      SESSION_ID,
      { vault_unlock: "fresh" },
      { now },
    );
    expect(v.ok).toBe(true);
  });

  test("Vault unlock 301s ago is stale", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const ago = new Date(now.getTime() - 301 * 1000);
    seedSession({ last_vault_unlock_at: ago.toISOString() });
    const v = await requireStepUp(
      SESSION_ID,
      { vault_unlock: "fresh" },
      { now },
    );
    expect(v.ok).toBe(false);
  });

  test("mixed: webauthn fresh + vault_unlock stale → fail on vault_unlock only", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const webauthnOk = new Date(now.getTime() - 60 * 1000);
    const unlockStale = new Date(now.getTime() - 1000 * 1000);
    seedSession({
      last_webauthn_verified_at: webauthnOk.toISOString(),
      last_vault_unlock_at: unlockStale.toISOString(),
    });
    const v = await requireStepUp(
      SESSION_ID,
      { webauthn: "fresh", vault_unlock: "fresh" },
      { now },
    );
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(["vault_unlock"]);
    expect(v.freshness.webauthn?.fresh).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requireStepUp · session absent / revoked
// ---------------------------------------------------------------------------
describe("step-up · session absent or revoked", () => {
  test("session not found → every required factor missing", async () => {
    seedSession(); // id doesn't match
    const v = await requireStepUp("ffffffff-ffff-ffff-ffff-ffffffffffff", {
      webauthn: "fresh",
      password: "fresh",
    });
    expect(v.ok).toBe(false);
    expect(v.missing.sort()).toEqual(["password", "webauthn"]);
  });

  test("session with revoked_at set → every required factor missing", async () => {
    seedSession({
      last_webauthn_verified_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(),
    });
    const v = await requireStepUp(SESSION_ID, { webauthn: "fresh" });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(["webauthn"]);
  });
});

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------
describe("step-up · writers", () => {
  test("markWebauthnVerified sets last_webauthn_verified_at and respects revoked_at IS NULL", async () => {
    seedSession();
    const at = new Date("2026-10-06T12:00:00Z");
    await markWebauthnVerified({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_ID,
      at,
    });
    expect(store.nex_session[0]!.last_webauthn_verified_at).toBe(
      at.toISOString(),
    );
    expect(writeLog.at(-1)?.filters.revoked_at).toBe("__NULL__");
  });

  test("markPasswordVerified sets last_password_verified_at", async () => {
    seedSession();
    const at = new Date("2026-10-06T13:00:00Z");
    await markPasswordVerified({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_ID,
      at,
    });
    expect(store.nex_session[0]!.last_password_verified_at).toBe(
      at.toISOString(),
    );
  });

  test("markVaultUnlocked sets last_vault_unlock_at", async () => {
    seedSession();
    const at = new Date("2026-10-06T14:00:00Z");
    await markVaultUnlocked({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_ID,
      at,
    });
    expect(store.nex_session[0]!.last_vault_unlock_at).toBe(at.toISOString());
  });

  test("writers scope by (sessionId AND accountId) · defend against cross-account write", async () => {
    seedSession();
    const at = new Date();
    await markWebauthnVerified({
      sessionId: SESSION_ID,
      accountId: "wrong-account",
      at,
    });
    // No matching row → nothing updated.
    expect(store.nex_session[0]!.last_webauthn_verified_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Password-reset lock sweep (design §G.1)
// ---------------------------------------------------------------------------
describe("step-up · clearAllStepUpForAccount (password-reset lock)", () => {
  test("clears all three timestamps across every session of the account", async () => {
    store.nex_session.push(
      {
        id: "11111111-1111-1111-1111-111111111111",
        account_id: ACCOUNT_ID,
        last_password_verified_at: new Date().toISOString(),
        last_webauthn_verified_at: new Date().toISOString(),
        last_vault_unlock_at: new Date().toISOString(),
        revoked_at: null,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        account_id: ACCOUNT_ID,
        last_password_verified_at: new Date().toISOString(),
        last_webauthn_verified_at: new Date().toISOString(),
        last_vault_unlock_at: new Date().toISOString(),
        revoked_at: null,
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        account_id: "another-account",
        last_password_verified_at: new Date().toISOString(),
        last_webauthn_verified_at: new Date().toISOString(),
        last_vault_unlock_at: new Date().toISOString(),
        revoked_at: null,
      },
    );
    await clearAllStepUpForAccount(ACCOUNT_ID);
    expect(store.nex_session[0]!.last_webauthn_verified_at).toBeNull();
    expect(store.nex_session[0]!.last_vault_unlock_at).toBeNull();
    expect(store.nex_session[1]!.last_vault_unlock_at).toBeNull();
    // Other account's session is untouched.
    expect(store.nex_session[2]!.last_vault_unlock_at).not.toBeNull();
  });

  test("preserves envelopes and other fields · no destructive side-effect visible here", async () => {
    seedSession({
      last_vault_unlock_at: new Date().toISOString(),
    });
    await clearAllStepUpForAccount(ACCOUNT_ID);
    // id and account_id unchanged
    expect(store.nex_session[0]!.id).toBe(SESSION_ID);
    expect(store.nex_session[0]!.account_id).toBe(ACCOUNT_ID);
  });
});

describe("step-up · clearVaultUnlockForSession", () => {
  test("clears last_vault_unlock_at only on the one session", async () => {
    store.nex_session.push(
      {
        id: SESSION_ID,
        account_id: ACCOUNT_ID,
        last_webauthn_verified_at: new Date().toISOString(),
        last_vault_unlock_at: new Date().toISOString(),
        revoked_at: null,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        account_id: ACCOUNT_ID,
        last_webauthn_verified_at: new Date().toISOString(),
        last_vault_unlock_at: new Date().toISOString(),
        revoked_at: null,
      },
    );
    await clearVaultUnlockForSession({
      sessionId: SESSION_ID,
      accountId: ACCOUNT_ID,
    });
    expect(store.nex_session[0]!.last_vault_unlock_at).toBeNull();
    // Only session 1 touched; webauthn freshness untouched.
    expect(store.nex_session[0]!.last_webauthn_verified_at).not.toBeNull();
    // Session 2 unchanged.
    expect(store.nex_session[1]!.last_vault_unlock_at).not.toBeNull();
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

describe("step-up · architecture guard", () => {
  test("source code does not reference commercial terms", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.resolve(__dirname, "../vault/step-up-service.ts"),
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

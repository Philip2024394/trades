// src/lib/nex-native/__tests__/vault-routes.test.ts
//
// Vault Phase A · Commit A.3 · route behaviour tests (deterministic).
//
// Covers the four A.3 routes: setup / status / unlock-materials /
// unlock-attempt / lock. Mocks the session resolver, Supabase admin
// client, and the three A.2 services so each test exercises one
// branch at a time.
//
// What these tests prove:
//   · session enforcement (401 on no session)
//   · owner-scope enforcement (device must belong to caller account)
//   · body shape validation (reject invalid inputs that would violate
//     migration 141/142 CHECKs)
//   · PIN rate-limit enforcement before envelope materials are returned
//     (429 with Retry-After, NO envelope leak on blocked attempts)
//   · unlock-attempt honestly records what the client claims and
//     exposes the refreshed rate verdict on failure
//   · lock is idempotent and does not sign the user out
//   · setup is one-shot per account (409 on double)
//
// What these tests do NOT prove (requires A.3b real-browser E2E):
//   · the client-side VMK generation + wrap round-trip
//   · the Argon2id-derived KEK unwraps VMK correctly
//   · network-level evidence that PIN/VMK/KEK never cross the boundary
//   · the password-reset lock sweep end-to-end in Playwright
//   · WebAuthn PRF unlock (deferred · no virtual authenticator infra)

import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Shared in-memory store + fake Supabase client
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const store: {
  nex_account_device_key: Row[];
  nex_session: Row[];
  nex_vault_setup: Row[];
  nex_vault_key_envelope: Row[];
  nex_vault_pin_attempt: Row[];
  nex_vault_recovery_attempt: Row[];
  nex_sign_in_event: Row[];
} = {
  nex_account_device_key: [],
  nex_session: [],
  nex_vault_setup: [],
  nex_vault_key_envelope: [],
  nex_vault_pin_attempt: [],
  nex_vault_recovery_attempt: [],
  nex_sign_in_event: [],
};

const sessionResolver: {
  session: { supabaseUserId: string; email: string | null; account: Row } | null;
} = { session: null };

function resetStore() {
  for (const k of Object.keys(store) as Array<keyof typeof store>) {
    store[k].length = 0;
  }
  sessionResolver.session = null;
}

function matches(row: Row, filters: Row): boolean {
  for (const [col, want] of Object.entries(filters)) {
    if (want === "__NULL__") {
      if (row[col] !== null && row[col] !== undefined) return false;
    } else if (want === "__NOT_NULL__") {
      if (row[col] === null || row[col] === undefined) return false;
    } else if (
      typeof want === "object" &&
      want !== null &&
      (want as { __gte?: string }).__gte !== undefined
    ) {
      const t = new Date(row[col] as string).getTime();
      const w = new Date((want as { __gte: string }).__gte).getTime();
      if (!(t >= w)) return false;
    } else if (row[col] !== want) {
      return false;
    }
  }
  return true;
}

function makeQuery(table: keyof typeof store) {
  const filters: Row = {};
  let selected: string | null = null;
  let orderCol: string | null = null;
  let orderDesc = false;
  const q: Record<string, unknown> = {
    select(cols: string) {
      selected = cols;
      return q;
    },
    eq(col: string, val: unknown) {
      filters[col] = val;
      return q;
    },
    is(col: string, val: unknown) {
      if (val === null) filters[col] = "__NULL__";
      return q;
    },
    gte(col: string, val: string) {
      filters[col] = { __gte: val };
      return q;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderDesc = opts?.ascending === false;
      return q;
    },
    async maybeSingle() {
      const rows = store[table].filter((r) => matches(r, filters));
      return { data: rows[0] ?? null, error: null };
    },
    async single() {
      const rows = store[table].filter((r) => matches(r, filters));
      if (!rows[0]) return { data: null, error: { message: "no row" } };
      return { data: rows[0], error: null };
    },
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      let rows = store[table].filter((r) => matches(r, filters));
      if (orderCol) {
        const col = orderCol;
        rows = [...rows].sort((a, b) => {
          const ta = new Date(a[col] as string).getTime();
          const tb = new Date(b[col] as string).getTime();
          return orderDesc ? tb - ta : ta - tb;
        });
      }
      void selected;
      resolve({ data: rows, error: null });
    },
  };
  return q;
}

function makeInsert(table: keyof typeof store, row: Row | Row[]) {
  const rows = Array.isArray(row) ? row : [row];
  const inserted = { select: () => inserted, single: async () => ({ data: null, error: null }) } as unknown as {
    select(): { single(): Promise<{ data: Row | null; error: null | { message: string } }> };
    then(resolve: (v: { error: null }) => void): void;
  };
  // Insertion applies partial unique indexes for envelope (same shape
  // as migration 142). Simplified: only pin + webauthn + device paths.
  for (const r of rows) {
    if (table === "nex_vault_key_envelope") {
      const kind = r.kind as string;
      const existing = store.nex_vault_key_envelope.find(
        (e) =>
          e.account_id === r.account_id &&
          e.kind === kind &&
          e.consumed_at === null &&
          (kind === "pin" || kind === "device"
            ? e.target_device_id === r.target_device_id
            : kind === "webauthn"
              ? e.credential_id === r.credential_id
              : true),
      );
      if (existing) {
        // Simulate 23505 unique violation.
        (inserted as unknown as {
          then(fn: (v: { error: { message: string } }) => void): void;
        }).then = (fn) =>
          fn({ error: { message: "duplicate key value violates unique constraint" } });
        (inserted.select().single as unknown as () => Promise<unknown>) = async () => ({
          data: null,
          error: { message: "duplicate key value" },
        });
        return inserted as unknown as {
          select(): {
            single(): Promise<{ data: Row | null; error: null | { message: string } }>;
          };
          then(resolve: (v: { error: null }) => void): void;
        };
      }
    }
    if (table === "nex_vault_setup") {
      const existing = store.nex_vault_setup.find((e) => e.account_id === r.account_id);
      if (existing) {
        (inserted as unknown as {
          then(fn: (v: { error: { message: string } }) => void): void;
        }).then = (fn) =>
          fn({ error: { message: "duplicate key value · setup already exists" } });
        (inserted.select().single as unknown as () => Promise<unknown>) = async () => ({
          data: null,
          error: { message: "duplicate key value · setup already exists" },
        });
        return inserted as unknown as {
          select(): {
            single(): Promise<{ data: Row | null; error: null | { message: string } }>;
          };
          then(resolve: (v: { error: null }) => void): void;
        };
      }
    }
    const copy = { consumed_at: null, created_at: new Date().toISOString(), ...r };
    store[table].push(copy);
  }
  const last = store[table][store[table].length - 1] ?? null;
  (inserted.select().single as unknown as () => Promise<unknown>) = async () => ({
    data: last,
    error: null,
  });
  (inserted as unknown as { then(fn: (v: { error: null }) => void): void }).then = (
    fn,
  ) => fn({ error: null });
  return inserted as unknown as {
    select(): {
      single(): Promise<{ data: Row | null; error: null | { message: string } }>;
    };
    then(resolve: (v: { error: null }) => void): void;
  };
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
      resolve({ error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return {
        select: () => makeQuery(table as keyof typeof store),
        insert: (row: Row | Row[]) =>
          makeInsert(table as keyof typeof store, row),
        update: (patch: Row) =>
          makeUpdate(table as keyof typeof store, patch),
      };
    },
  },
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSession: async () => sessionResolver.session,
  resolveNexAppSessionFromContext: async () => sessionResolver.session,
}));

vi.mock("@/lib/nex-native/app/security-request", () => ({
  currentSessionKey: () => "sessionkey-sha256-hex-fake",
  readClientIp: () => "127.0.0.1",
  readUserAgent: () => "test",
  readAccessTokenFromRequest: () => "fake-token",
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_A = "11111111-1111-1111-1111-111111111111";
const DEVICE_A = "device-aaaa-01";

function seedActiveSession() {
  sessionResolver.session = {
    supabaseUserId: "supabase-user-aaa",
    email: "a@test",
    account: {
      id: ACCOUNT_A,
      supabase_user_id: "supabase-user-aaa",
      sessions_invalidated_at: null,
    },
  };
  store.nex_session.push({
    id: SESSION_A,
    account_id: ACCOUNT_A,
    supabase_session_key: "sessionkey-sha256-hex-fake",
    revoked_at: null,
    last_vault_unlock_at: null,
    last_webauthn_verified_at: null,
    last_password_verified_at: null,
  });
  store.nex_account_device_key.push({
    account_id: ACCOUNT_A,
    device_id: DEVICE_A,
    public_key: "base64pub",
    revoked_at: null,
  });
}

function makeReq(body?: unknown): NextRequest {
  const url = "http://localhost:3008/x";
  const init: RequestInit = body
    ? { method: "POST", body: JSON.stringify(body) }
    : { method: "GET" };
  return new NextRequest(url, init);
}

beforeEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// /api/nex-native/vault/setup
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/setup", () => {
  test("401 when no session", async () => {
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(makeReq({ pin_mode: "pin" }));
    expect(res.status).toBe(401);
  });

  test("400 on invalid pin_mode", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "banana",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_pin_mode");
  });

  test("400 on invalid pin_salt length", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(8), // 8 bytes · below the 16 minimum
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_pin_salt_length");
  });

  test("400 on invalid prf_salt length", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(12), // not 16
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_prf_salt_length");
  });

  test("400 on wrapped_vmk out of range", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(16), // below 32 minimum
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wrapped_vmk_length");
  });

  test("400 when device_id does not belong to account", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: "device-not-mine-9999",
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("device_not_registered");
  });

  test("403 when device is revoked", async () => {
    seedActiveSession();
    store.nex_account_device_key[0]!.revoked_at = new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("device_revoked");
  });

  test("happy path · stores setup + envelope + marks unlocked", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(200);
    expect(store.nex_vault_setup.length).toBe(1);
    expect(store.nex_vault_setup[0]!.account_id).toBe(ACCOUNT_A);
    expect(store.nex_vault_key_envelope.length).toBe(1);
    expect(store.nex_vault_key_envelope[0]!.kind).toBe("pin");
    expect(store.nex_session[0]!.last_vault_unlock_at).not.toBeNull();
    expect(store.nex_sign_in_event.length).toBe(1);
    expect(store.nex_sign_in_event[0]!.event_type).toBe("vault_unlock");
  });

  test("409 on double setup", async () => {
    seedActiveSession();
    store.nex_vault_setup.push({
      account_id: ACCOUNT_A,
      pin_mode: "pin",
      pin_salt: "\\x" + "00".repeat(16),
      pin_argon_params: {},
      prf_salt: "\\x" + "00".repeat(16),
      recovery_configured_at: null,
      recovery_salt: null,
      recovery_argon_params: null,
      vmk_generation: 1,
    });
    const mod = await import("@/app/api/nex-native/vault/setup/route");
    const res = await mod.POST(
      makeReq({
        pin_mode: "pin",
        pin_salt_hex: "00".repeat(16),
        pin_argon_params: { t: 3, m: 65536 },
        prf_salt_hex: "00".repeat(16),
        device_id: DEVICE_A,
        wrapped_vmk_hex: "00".repeat(60),
        nonce_hex: "00".repeat(12),
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_configured");
  });
});

// ---------------------------------------------------------------------------
// /api/nex-native/vault/status
// ---------------------------------------------------------------------------
describe("GET /api/nex-native/vault/status", () => {
  test("401 when no session", async () => {
    const mod = await import("@/app/api/nex-native/vault/status/route");
    const res = await mod.GET(makeReq());
    expect(res.status).toBe(401);
  });

  test("returns configured:false when no setup row", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/status/route");
    const res = await mod.GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
    expect(body.unlocked).toBe(false);
    expect(body.mode).toBeNull();
  });

  test("returns configured:true + mode when setup exists", async () => {
    seedActiveSession();
    store.nex_vault_setup.push({
      account_id: ACCOUNT_A,
      pin_mode: "passphrase",
      pin_salt: "\\x" + "00".repeat(16),
      pin_argon_params: {},
      prf_salt: "\\x" + "00".repeat(16),
      recovery_configured_at: null,
      recovery_salt: null,
      recovery_argon_params: null,
      vmk_generation: 1,
    });
    const mod = await import("@/app/api/nex-native/vault/status/route");
    const res = await mod.GET(makeReq());
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.mode).toBe("passphrase");
    expect(body.unlocked).toBe(false);
    expect(body.unlock_window_seconds).toBe(300);
  });

  test("returns unlocked:true within freshness window", async () => {
    seedActiveSession();
    store.nex_session[0]!.last_vault_unlock_at = new Date(
      Date.now() - 60 * 1000,
    ).toISOString();
    store.nex_vault_setup.push({
      account_id: ACCOUNT_A,
      pin_mode: "pin",
      pin_salt: "\\x" + "00".repeat(16),
      pin_argon_params: {},
      prf_salt: "\\x" + "00".repeat(16),
      recovery_configured_at: null,
      recovery_salt: null,
      recovery_argon_params: null,
      vmk_generation: 1,
    });
    const mod = await import("@/app/api/nex-native/vault/status/route");
    const res = await mod.GET(makeReq());
    const body = await res.json();
    expect(body.unlocked).toBe(true);
    expect(body.unlocked_age_seconds).toBeGreaterThanOrEqual(55);
  });
});

// ---------------------------------------------------------------------------
// /api/nex-native/vault/unlock-materials
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/unlock-materials", () => {
  function seedConfigured() {
    seedActiveSession();
    store.nex_vault_setup.push({
      account_id: ACCOUNT_A,
      pin_mode: "pin",
      pin_salt: "\\x" + "00".repeat(16),
      pin_argon_params: { t: 3, m: 65536 },
      prf_salt: "\\x" + "00".repeat(16),
      recovery_configured_at: null,
      recovery_salt: null,
      recovery_argon_params: null,
      vmk_generation: 1,
    });
    store.nex_vault_key_envelope.push({
      account_id: ACCOUNT_A,
      kind: "pin",
      target_device_id: DEVICE_A,
      credential_id: null,
      wrapped_vmk: "\\x" + "11".repeat(60),
      nonce: "\\x" + "22".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: null,
    });
  }

  test("401 when no session", async () => {
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(401);
  });

  test("400 when device_id missing", async () => {
    seedConfigured();
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_device_id");
  });

  test("400 when device not registered to this account", async () => {
    seedConfigured();
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(
      makeReq({ device_id: "device-foreign-9999999" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("device_not_registered");
  });

  test("403 when device is revoked", async () => {
    seedConfigured();
    store.nex_account_device_key[0]!.revoked_at = new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("device_revoked");
  });

  test("404 when vault is not configured", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_configured");
  });

  test("429 and no envelope leak when rate-limited", async () => {
    seedConfigured();
    for (let i = 0; i < 5; i++) {
      store.nex_vault_pin_attempt.push({
        account_id: ACCOUNT_A,
        device_id: DEVICE_A,
        success: false,
        attempted_at: new Date(Date.now() - i * 60 * 1000).toISOString(),
      });
    }
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(429);
    const body = await res.json();
    // No envelope / salt / params leaked in a 429 response.
    expect(body.wrapped_vmk_hex).toBeUndefined();
    expect(body.pin_salt_hex).toBeUndefined();
    expect(body.pin_argon_params).toBeUndefined();
    expect(body.error).toBe("rate_limited");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  test("happy path returns opaque envelope + non-secret derivation params", async () => {
    seedConfigured();
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("pin");
    expect(body.pin_salt_hex).toBe("00".repeat(16));
    expect(body.pin_argon_params).toEqual({ t: 3, m: 65536 });
    expect(body.wrapped_vmk_hex).toBe("11".repeat(60));
    expect(body.nonce_hex).toBe("22".repeat(12));
    expect(body.algorithm).toBe("aes-256-gcm/v1");
  });

  test("403 when device has no envelope (device not authorised for vault)", async () => {
    seedActiveSession();
    store.nex_vault_setup.push({
      account_id: ACCOUNT_A,
      pin_mode: "pin",
      pin_salt: "\\x" + "00".repeat(16),
      pin_argon_params: {},
      prf_salt: "\\x" + "00".repeat(16),
      recovery_configured_at: null,
      recovery_salt: null,
      recovery_argon_params: null,
      vmk_generation: 1,
    });
    // no envelope row for this device
    const mod = await import("@/app/api/nex-native/vault/unlock-materials/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("device_not_authorised_for_vault");
  });
});

// ---------------------------------------------------------------------------
// /api/nex-native/vault/unlock-attempt
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/unlock-attempt", () => {
  test("401 when no session", async () => {
    const mod = await import("@/app/api/nex-native/vault/unlock-attempt/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A, success: true }));
    expect(res.status).toBe(401);
  });

  test("400 when success flag missing", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/unlock-attempt/route");
    const res = await mod.POST(makeReq({ device_id: DEVICE_A }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_success_flag");
  });

  test("success=true marks unlocked + logs vault_unlock event", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/unlock-attempt/route");
    const res = await mod.POST(
      makeReq({ device_id: DEVICE_A, success: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unlocked).toBe(true);
    expect(store.nex_session[0]!.last_vault_unlock_at).not.toBeNull();
    expect(store.nex_vault_pin_attempt.length).toBe(1);
    expect(store.nex_vault_pin_attempt[0]!.success).toBe(true);
    const unlockEvent = store.nex_sign_in_event.find(
      (e) => e.event_type === "vault_unlock",
    );
    expect(unlockEvent).toBeTruthy();
  });

  test("success=false records failure + logs vault_unlock_failed", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/unlock-attempt/route");
    const res = await mod.POST(
      makeReq({ device_id: DEVICE_A, success: false }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unlocked).toBe(false);
    expect(body.rate.allowed).toBe(true);
    expect(store.nex_session[0]!.last_vault_unlock_at).toBeNull();
    expect(store.nex_vault_pin_attempt[0]!.success).toBe(false);
    const failEvent = store.nex_sign_in_event.find(
      (e) => e.event_type === "vault_unlock_failed",
    );
    expect(failEvent).toBeTruthy();
  });

  test("403 when device revoked", async () => {
    seedActiveSession();
    store.nex_account_device_key[0]!.revoked_at = new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/unlock-attempt/route");
    const res = await mod.POST(
      makeReq({ device_id: DEVICE_A, success: true }),
    );
    expect(res.status).toBe(403);
  });

  test("5 failures exposes 'window_exceeded' in rate.reason", async () => {
    seedActiveSession();
    for (let i = 0; i < 5; i++) {
      store.nex_vault_pin_attempt.push({
        account_id: ACCOUNT_A,
        device_id: DEVICE_A,
        success: false,
        attempted_at: new Date(Date.now() - i * 60 * 1000).toISOString(),
      });
    }
    const mod = await import("@/app/api/nex-native/vault/unlock-attempt/route");
    const res = await mod.POST(
      makeReq({ device_id: DEVICE_A, success: false }),
    );
    const body = await res.json();
    expect(body.rate.allowed).toBe(false);
    expect(body.rate.reason).toBe("window_exceeded");
  });
});

// ---------------------------------------------------------------------------
// /api/nex-native/vault/lock
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/lock", () => {
  test("401 when no session", async () => {
    const mod = await import("@/app/api/nex-native/vault/lock/route");
    const res = await mod.POST(makeReq({}));
    expect(res.status).toBe(401);
  });

  test("clears last_vault_unlock_at for the current session only", async () => {
    seedActiveSession();
    store.nex_session[0]!.last_vault_unlock_at = new Date().toISOString();
    store.nex_session.push({
      id: "22222222-2222-2222-2222-222222222222",
      account_id: ACCOUNT_A,
      supabase_session_key: "other-session",
      revoked_at: null,
      last_vault_unlock_at: new Date().toISOString(),
    });
    const mod = await import("@/app/api/nex-native/vault/lock/route");
    const res = await mod.POST(makeReq({}));
    expect(res.status).toBe(200);
    expect(store.nex_session[0]!.last_vault_unlock_at).toBeNull();
    // Other session still unlocked.
    expect(store.nex_session[1]!.last_vault_unlock_at).not.toBeNull();
  });

  test("idempotent · succeeds even when not unlocked", async () => {
    seedActiveSession();
    const mod = await import("@/app/api/nex-native/vault/lock/route");
    const res1 = await mod.POST(makeReq({}));
    const res2 = await mod.POST(makeReq({}));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Architecture guard · no commercial coupling in A.3 server surfaces
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

describe("A.3 architecture guards", () => {
  const files = [
    "src/app/api/nex-native/vault/setup/route.ts",
    "src/app/api/nex-native/vault/status/route.ts",
    "src/app/api/nex-native/vault/unlock-materials/route.ts",
    "src/app/api/nex-native/vault/unlock-attempt/route.ts",
    "src/app/api/nex-native/vault/lock/route.ts",
    "src/lib/nex-native/vault/vault-status-service.ts",
  ];
  const banned = [
    "bisnis",
    "subscription",
    "entitlement",
    "quota",
    "allowance",
    "effectivetier",
    "tier-gate",
  ];
  for (const f of files) {
    test(`${f} has no commercial-token references in code`, async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const raw = fs.readFileSync(
        path.resolve(__dirname, "../../../..", f),
        "utf8",
      );
      const code = stripComments(raw).toLowerCase();
      for (const token of banned) {
        expect(code.includes(token), `${f} contains "${token}"`).toBe(false);
      }
    });
  }

  test("A.3 routes do not import effectiveTier / tier-gate / account-service tier helpers", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const f of files) {
      const raw = fs.readFileSync(
        path.resolve(__dirname, "../../../..", f),
        "utf8",
      );
      expect(raw).not.toMatch(/from .+tier-gate/);
      expect(raw).not.toMatch(/import .+effectiveTier/);
      expect(raw).not.toMatch(/import .+canUsePremiumThemes/);
    }
  });

  test("A.3 routes NEVER call deriveKekFromPin / deriveKekFromPassphrase / deriveKekFromPrf / unwrapKey server-side", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const f of files) {
      const raw = fs.readFileSync(
        path.resolve(__dirname, "../../../..", f),
        "utf8",
      );
      const code = stripComments(raw);
      expect(code, `${f} must not derive KEK server-side`).not.toMatch(
        /\bderiveKekFromPin\b|\bderiveKekFromPassphrase\b|\bderiveKekFromPrf\b/,
      );
      expect(code, `${f} must not unwrap VMK server-side`).not.toMatch(
        /\bunwrapKey\b|\baesGcmDecrypt\b/,
      );
    }
  });
});

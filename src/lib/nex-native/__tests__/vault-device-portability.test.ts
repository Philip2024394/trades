// src/lib/nex-native/__tests__/vault-device-portability.test.ts
//
// Vault Phase A · Commit A.4 · device-portability route tests
// (deterministic · mocks supabase-admin + session resolver + security
// helpers · same in-memory pattern as A.3 vault-routes.test.ts).
//
// Covers:
//   · /vault/step-up/password       (auth, verify, mark fresh)
//   · /vault/device/authorise       (step-up, owner-scope, replay)
//   · /vault/device/envelope/pending (owner-scope, revoked)
//   · /vault/device/envelope/consume (replay rejection, PIN envelope insert)
//   · /vault/device/revoke          (step-up, cascade envelope delete)
//   · /vault/device/list            (status mapping)
// Plus client-side envelope-byte-layout (buildDeviceEnvelope +
// parseDeviceEnvelope round-trip + version rejection).
// Plus architecture guards (zero commercial · no server-side crypto).

import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Shared in-memory store (expanded for A.4 tables + device_keys)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const store: {
  nex_account_device_key: Row[];
  nex_session: Row[];
  nex_vault_setup: Row[];
  nex_vault_key_envelope: Row[];
  nex_vault_pin_attempt: Row[];
  nex_sign_in_event: Row[];
} = {
  nex_account_device_key: [],
  nex_session: [],
  nex_vault_setup: [],
  nex_vault_key_envelope: [],
  nex_vault_pin_attempt: [],
  nex_sign_in_event: [],
};

const sessionResolver: {
  session: {
    supabaseUserId: string;
    email: string | null;
    account: Row;
  } | null;
} = { session: null };

const supabasePasswordVerify: {
  shouldSucceed: boolean;
} = { shouldSucceed: true };

function reset() {
  for (const k of Object.keys(store) as Array<keyof typeof store>) {
    store[k].length = 0;
  }
  sessionResolver.session = null;
  supabasePasswordVerify.shouldSucceed = true;
}

function passesExpiryGuard(row: Row, guardIso: string | null): boolean {
  if (!guardIso) return true;
  const v = row.expires_at;
  if (v === null || v === undefined) return true;
  return (v as string) > guardIso;
}

function matches(row: Row, filters: Row): boolean {
  for (const [col, want] of Object.entries(filters)) {
    if (want === "__NULL__") {
      if (row[col] !== null && row[col] !== undefined) return false;
    } else if (
      typeof want === "object" &&
      want !== null &&
      (want as { __in?: unknown[] }).__in !== undefined
    ) {
      const list = (want as { __in: unknown[] }).__in;
      if (!list.includes(row[col])) return false;
    } else if (row[col] !== want) {
      return false;
    }
  }
  return true;
}

function makeQuery(table: keyof typeof store) {
  const filters: Row = {};
  let orderCol: string | null = null;
  let orderDesc = false;
  let expiryGuardIso: string | null = null;
  const q: Record<string, unknown> = {
    select() {
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
    in(col: string, list: unknown[]) {
      filters[col] = { __in: list };
      return q;
    },
    or(expr: string) {
      // Support exactly the one pattern envelope-service uses:
      //   "expires_at.is.null,expires_at.gt.<ISO>"
      // Translates to: row passes IF expires_at IS NULL OR expires_at > ISO.
      const match = expr.match(
        /expires_at\.is\.null,expires_at\.gt\.(.+)$/,
      );
      if (match) expiryGuardIso = match[1]!;
      return q;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderDesc = opts?.ascending === false;
      return q;
    },
    async maybeSingle() {
      const rows = store[table]
        .filter((r) => matches(r, filters))
        .filter((r) => passesExpiryGuard(r, expiryGuardIso));
      return { data: rows[0] ?? null, error: null };
    },
    async single() {
      const rows = store[table]
        .filter((r) => matches(r, filters))
        .filter((r) => passesExpiryGuard(r, expiryGuardIso));
      if (!rows[0]) return { data: null, error: { message: "no row" } };
      return { data: rows[0], error: null };
    },
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      let rows = store[table]
        .filter((r) => matches(r, filters))
        .filter((r) => passesExpiryGuard(r, expiryGuardIso));
      if (orderCol) {
        const col = orderCol;
        rows = [...rows].sort((a, b) => {
          const ta = new Date(a[col] as string).getTime();
          const tb = new Date(b[col] as string).getTime();
          return orderDesc ? tb - ta : ta - tb;
        });
      }
      resolve({ data: rows, error: null });
    },
  };
  return q;
}

function makeInsert(table: keyof typeof store, row: Row | Row[]) {
  const rows = Array.isArray(row) ? row : [row];
  for (const r of rows) {
    // Enforce A.4-relevant uniqueness.
    if (table === "nex_vault_key_envelope") {
      const kind = r.kind as string;
      const existing = store.nex_vault_key_envelope.find(
        (e) =>
          e.account_id === r.account_id &&
          e.kind === kind &&
          e.consumed_at === null &&
          (kind === "pin" || kind === "device"
            ? e.target_device_id === r.target_device_id
            : true),
      );
      if (existing) {
        return {
          select() {
            return this;
          },
          async single() {
            return {
              data: null,
              error: { message: "duplicate key value" },
            };
          },
          then(fn: (v: { error: { message: string } }) => void) {
            fn({ error: { message: "duplicate key value" } });
          },
        };
      }
    }
    const copy = {
      id: `${table}-${store[table].length + 1}`,
      consumed_at: null,
      created_at: new Date().toISOString(),
      ...r,
    };
    store[table].push(copy);
  }
  const last = store[table][store[table].length - 1] ?? null;
  const builder = {
    select() {
      return builder;
    },
    async single() {
      return { data: last, error: null };
    },
    then(fn: (v: { error: null }) => void) {
      fn({ error: null });
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
      resolve({ error: null });
    },
  };
  return builder;
}

function makeDelete(table: keyof typeof store) {
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
    then(resolve: (v: { error: null; count: number }) => void) {
      const kept = store[table].filter((r) => !matches(r, filters));
      const removed = store[table].length - kept.length;
      store[table].length = 0;
      store[table].push(...kept);
      resolve({ error: null, count: removed });
    },
  };
  return builder;
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      return {
        select: () => makeQuery(table as keyof typeof store),
        insert: (row: Row | Row[]) => makeInsert(table as keyof typeof store, row),
        update: (patch: Row) => makeUpdate(table as keyof typeof store, patch),
        delete: (_opts?: unknown) => makeDelete(table as keyof typeof store),
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

// Supabase anon client mock (used by step-up/password route).
vi.mock("@supabase/supabase-js", async () => {
  const actual = await vi.importActual<typeof import("@supabase/supabase-js")>(
    "@supabase/supabase-js",
  );
  return {
    ...actual,
    createClient: () => ({
      auth: {
        signInWithPassword: async () =>
          supabasePasswordVerify.shouldSucceed
            ? { data: { user: { id: "u1" } }, error: null }
            : { data: { user: null }, error: { message: "wrong_password" } },
      },
    }),
  };
});

// Make env present so password step-up route doesn't 500.
process.env.NEX_SUPABASE_URL = process.env.NEX_SUPABASE_URL ?? "http://local/";
process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "anon_fake";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_A = "11111111-1111-1111-1111-111111111111";
const DEVICE_A = "device-aaaa-01";
const DEVICE_B = "device-bbbb-02";

function seedBase(opts: { unlocked?: boolean; webauthnFresh?: boolean; passwordFresh?: boolean } = {}) {
  sessionResolver.session = {
    supabaseUserId: "u1",
    email: "a@test",
    account: {
      id: ACCOUNT_A,
      sessions_invalidated_at: null,
    },
  };
  const now = new Date();
  store.nex_session.push({
    id: SESSION_A,
    account_id: ACCOUNT_A,
    supabase_session_key: "sessionkey-sha256-hex-fake",
    revoked_at: null,
    last_vault_unlock_at: opts.unlocked
      ? new Date(now.getTime() - 60_000).toISOString()
      : null,
    last_webauthn_verified_at: opts.webauthnFresh
      ? new Date(now.getTime() - 60_000).toISOString()
      : null,
    last_password_verified_at: opts.passwordFresh
      ? new Date(now.getTime() - 60_000).toISOString()
      : null,
  });
  store.nex_account_device_key.push({
    account_id: ACCOUNT_A,
    device_id: DEVICE_A,
    public_key: "A".repeat(44),
    revoked_at: null,
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  });
  store.nex_account_device_key.push({
    account_id: ACCOUNT_A,
    device_id: DEVICE_B,
    public_key: "B".repeat(44),
    revoked_at: null,
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  });
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
}

function req(body?: unknown, method: "POST" | "GET" = "POST"): NextRequest {
  return new NextRequest("http://localhost/x", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(reset);

// ---------------------------------------------------------------------------
// Password step-up route
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/step-up/password", () => {
  test("401 without session", async () => {
    const mod = await import("@/app/api/nex-native/vault/step-up/password/route");
    const res = await mod.POST(req({ password: "pw" }));
    expect(res.status).toBe(401);
  });

  test("marks fresh on correct password", async () => {
    seedBase();
    const mod = await import("@/app/api/nex-native/vault/step-up/password/route");
    const res = await mod.POST(req({ password: "pw" }));
    expect(res.status).toBe(200);
    expect(store.nex_session[0]!.last_password_verified_at).not.toBeNull();
  });

  test("400 on wrong password · marks nothing", async () => {
    seedBase();
    supabasePasswordVerify.shouldSucceed = false;
    const mod = await import("@/app/api/nex-native/vault/step-up/password/route");
    const res = await mod.POST(req({ password: "pw" }));
    expect(res.status).toBe(400);
    expect(store.nex_session[0]!.last_password_verified_at).toBeNull();
    const fail = store.nex_sign_in_event.find((e) => e.event_type === "failure");
    expect(fail).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Device authorise route · step-up matrix
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/device/authorise", () => {
  const validEnvelopeHex = "01" + "00".repeat(32) + "11".repeat(48); // 81 bytes
  const validNonceHex = "22".repeat(12);

  test("403 when Vault not unlocked", async () => {
    seedBase({ unlocked: false, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).required).toEqual(["vault_unlock"]);
  });

  test("403 when neither password nor webauthn fresh", async () => {
    seedBase({ unlocked: true, passwordFresh: false, webauthnFresh: false });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).required).toEqual(["webauthn_or_password"]);
  });

  test("happy path · password fresh + unlocked", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(200);
    expect(store.nex_vault_key_envelope.length).toBe(1);
    expect(store.nex_vault_key_envelope[0]!.kind).toBe("device");
    expect(store.nex_vault_key_envelope[0]!.target_device_id).toBe(DEVICE_B);
    const event = store.nex_sign_in_event.find((e) => e.event_type === "device_authorized");
    expect(event).toBeTruthy();
  });

  test("happy path · webauthn fresh + unlocked", async () => {
    seedBase({ unlocked: true, webauthnFresh: true });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(200);
  });

  test("400 when target device not registered", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: "device-foreign-99",
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("target_device_not_registered");
  });

  test("403 when target device revoked", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    store.nex_account_device_key.find((d) => d.device_id === DEVICE_B)!.revoked_at =
      new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("target_device_revoked");
  });

  test("409 when pending envelope already exists for target", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    store.nex_vault_key_envelope.push({
      account_id: ACCOUNT_A,
      kind: "device",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: "\\x" + "aa".repeat(60),
      nonce: "\\x" + "bb".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: validEnvelopeHex,
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("device_envelope_pending");
  });

  test("400 on invalid wrapped_vmk length", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/device/authorise/route");
    const res = await mod.POST(
      req({
        target_device_id: DEVICE_B,
        wrapped_vmk_hex: "01" + "00".repeat(8), // too short
        nonce_hex: validNonceHex,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wrapped_vmk_length");
  });
});

// ---------------------------------------------------------------------------
// Device envelope pending route
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/device/envelope/pending", () => {
  test("401 without session", async () => {
    const mod = await import("@/app/api/nex-native/vault/device/envelope/pending/route");
    const res = await mod.POST(req({ device_id: DEVICE_B }));
    expect(res.status).toBe(401);
  });

  test("returns envelope when pending", async () => {
    seedBase();
    store.nex_vault_key_envelope.push({
      account_id: ACCOUNT_A,
      kind: "device",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: Buffer.from(new Uint8Array([0x01, ...new Array(80).fill(0xaa)])),
      nonce: Buffer.from(new Uint8Array(12)),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    const mod = await import("@/app/api/nex-native/vault/device/envelope/pending/route");
    const res = await mod.POST(req({ device_id: DEVICE_B }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.envelope).not.toBeNull();
    expect(body.envelope.wrapped_vmk_hex.length).toBe(2 * 81);
  });

  test("returns null when none pending", async () => {
    seedBase();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/pending/route");
    const res = await mod.POST(req({ device_id: DEVICE_B }));
    const body = await res.json();
    expect(body.envelope).toBeNull();
  });

  test("403 when caller device is revoked", async () => {
    seedBase();
    store.nex_account_device_key.find((d) => d.device_id === DEVICE_B)!.revoked_at =
      new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/pending/route");
    const res = await mod.POST(req({ device_id: DEVICE_B }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Device envelope consume route · replay protection
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/device/envelope/consume", () => {
  function seedPendingDeviceEnvelope() {
    const id = "envelope-1";
    store.nex_vault_key_envelope.push({
      id,
      account_id: ACCOUNT_A,
      kind: "device",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: Buffer.from(new Uint8Array([0x01, ...new Array(80).fill(0xaa)])),
      nonce: Buffer.from(new Uint8Array(12)),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      created_at: new Date().toISOString(),
    });
    return id;
  }

  const validConsumeBody = (envelopeId: string) => ({
    envelope_id: envelopeId,
    device_id: DEVICE_B,
    pin_salt_hex: "00".repeat(16),
    pin_argon_params: { t: 3, m: 65536 },
    pin_wrapped_vmk_hex: "11".repeat(48),
    pin_nonce_hex: "22".repeat(12),
  });

  test("happy path · consumes + inserts PIN envelope + marks unlocked", async () => {
    seedBase();
    const id = seedPendingDeviceEnvelope();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/consume/route");
    const res = await mod.POST(req(validConsumeBody(id)));
    expect(res.status).toBe(200);
    const envRow = store.nex_vault_key_envelope.find((e) => e.id === id)!;
    expect(envRow.consumed_at).not.toBeNull();
    const pinEnv = store.nex_vault_key_envelope.find(
      (e) =>
        e.kind === "pin" &&
        e.target_device_id === DEVICE_B &&
        e.consumed_at === null,
    );
    expect(pinEnv).toBeTruthy();
    expect(store.nex_session[0]!.last_vault_unlock_at).not.toBeNull();
  });

  test("second consume is rejected (replay)", async () => {
    seedBase();
    const id = seedPendingDeviceEnvelope();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/consume/route");
    const first = await mod.POST(req(validConsumeBody(id)));
    expect(first.status).toBe(200);
    const second = await mod.POST(req(validConsumeBody(id)));
    expect(second.status).toBe(410);
    expect((await second.json()).error).toBe("envelope_already_consumed");
  });

  test("expired envelope rejected", async () => {
    seedBase();
    const id = seedPendingDeviceEnvelope();
    store.nex_vault_key_envelope.find((e) => e.id === id)!.expires_at = new Date(
      Date.now() - 60_000,
    ).toISOString();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/consume/route");
    const res = await mod.POST(req(validConsumeBody(id)));
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe("envelope_expired");
  });

  test("target mismatch rejected", async () => {
    seedBase();
    const id = seedPendingDeviceEnvelope();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/consume/route");
    const res = await mod.POST(
      req({ ...validConsumeBody(id), device_id: DEVICE_A }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("envelope_target_mismatch");
  });

  test("revoked device cannot consume", async () => {
    seedBase();
    const id = seedPendingDeviceEnvelope();
    store.nex_account_device_key.find((d) => d.device_id === DEVICE_B)!.revoked_at =
      new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/device/envelope/consume/route");
    const res = await mod.POST(req(validConsumeBody(id)));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("device_revoked");
  });
});

// ---------------------------------------------------------------------------
// Device revoke route
// ---------------------------------------------------------------------------
describe("POST /api/nex-native/vault/device/revoke", () => {
  test("403 without step-up", async () => {
    seedBase();
    const mod = await import("@/app/api/nex-native/vault/device/revoke/route");
    const res = await mod.POST(req({ target_device_id: DEVICE_B }));
    expect(res.status).toBe(403);
  });

  test("happy path · sets revoked_at + deletes envelopes + logs event", async () => {
    seedBase({ passwordFresh: true });
    // seed some envelopes targeting DEVICE_B
    store.nex_vault_key_envelope.push({
      account_id: ACCOUNT_A,
      kind: "pin",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: "\\x" + "aa".repeat(48),
      nonce: "\\x" + "bb".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: null,
    });
    const mod = await import("@/app/api/nex-native/vault/device/revoke/route");
    const res = await mod.POST(req({ target_device_id: DEVICE_B }));
    expect(res.status).toBe(200);
    expect(
      store.nex_account_device_key.find((d) => d.device_id === DEVICE_B)!.revoked_at,
    ).not.toBeNull();
    expect(
      store.nex_vault_key_envelope.filter(
        (e) =>
          e.target_device_id === DEVICE_B &&
          e.consumed_at === null,
      ).length,
    ).toBe(0);
    const event = store.nex_sign_in_event.find(
      (e) => e.event_type === "device_revoked",
    );
    expect(event).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Device list route · status mapping
// ---------------------------------------------------------------------------
describe("GET /api/nex-native/vault/device/list", () => {
  test("returns status for each device", async () => {
    seedBase();
    // Device A has a PIN envelope → authorised
    store.nex_vault_key_envelope.push({
      account_id: ACCOUNT_A,
      kind: "pin",
      target_device_id: DEVICE_A,
      credential_id: null,
      wrapped_vmk: "\\x" + "aa".repeat(48),
      nonce: "\\x" + "bb".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: null,
    });
    // Device B has pending device envelope → pending
    store.nex_vault_key_envelope.push({
      account_id: ACCOUNT_A,
      kind: "device",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: "\\x" + "cc".repeat(80),
      nonce: "\\x" + "dd".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    const mod = await import("@/app/api/nex-native/vault/device/list/route");
    const res = await mod.GET(req(undefined, "GET"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    const a = (body.devices as Array<{ device_id: string; vault_status: string }>).find(
      (d) => d.device_id === DEVICE_A,
    );
    const b = (body.devices as Array<{ device_id: string; vault_status: string }>).find(
      (d) => d.device_id === DEVICE_B,
    );
    expect(a?.vault_status).toBe("authorised");
    expect(b?.vault_status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// Client envelope byte-layout round-trip
// ---------------------------------------------------------------------------
describe("device envelope byte layout · parseDeviceEnvelope + buildDeviceEnvelope", () => {
  test("build + parse round-trip", async () => {
    const mod = await import("@/lib/nex-native/vault/client/device-portability");
    const sourcePub = new Uint8Array(32).fill(0x7a);
    const ciphertext = new Uint8Array(48).fill(0xcc);
    const envelope = mod.buildDeviceEnvelope(sourcePub, ciphertext);
    expect(envelope.length).toBe(81);
    expect(envelope[0]).toBe(mod.DEVICE_ENVELOPE_VERSION);
    const parsed = mod.parseDeviceEnvelope(envelope);
    expect(Array.from(parsed.sourcePublicKey)).toEqual(Array.from(sourcePub));
    expect(Array.from(parsed.ciphertext)).toEqual(Array.from(ciphertext));
  });

  test("parse rejects wrong version byte", async () => {
    const mod = await import("@/lib/nex-native/vault/client/device-portability");
    const bad = new Uint8Array(81);
    bad[0] = 0x02;
    expect(() => mod.parseDeviceEnvelope(bad)).toThrow();
  });

  test("parse rejects too-short envelope", async () => {
    const mod = await import("@/lib/nex-native/vault/client/device-portability");
    expect(() => mod.parseDeviceEnvelope(new Uint8Array(10))).toThrow();
  });

  test("build rejects non-32-byte source pubkey", async () => {
    const mod = await import("@/lib/nex-native/vault/client/device-portability");
    expect(() =>
      mod.buildDeviceEnvelope(new Uint8Array(16), new Uint8Array(48)),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Architecture guards
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

describe("A.4 architecture guards", () => {
  const serverFiles = [
    "src/app/api/nex-native/vault/device/authorise/route.ts",
    "src/app/api/nex-native/vault/device/envelope/pending/route.ts",
    "src/app/api/nex-native/vault/device/envelope/consume/route.ts",
    "src/app/api/nex-native/vault/device/revoke/route.ts",
    "src/app/api/nex-native/vault/device/list/route.ts",
    "src/app/api/nex-native/vault/step-up/password/route.ts",
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

  for (const f of serverFiles) {
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

    test(`${f} does not derive KEK or unwrap VMK server-side`, async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const raw = fs.readFileSync(
        path.resolve(__dirname, "../../../..", f),
        "utf8",
      );
      const code = stripComments(raw);
      expect(code).not.toMatch(
        /\bderiveKekFromPin\b|\bderiveKekFromPassphrase\b|\bderiveKekFromPrf\b/,
      );
      expect(code).not.toMatch(/\bunwrapKey\b|\baesGcmDecrypt\b/);
    });
  }
});

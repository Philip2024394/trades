// src/lib/nex-native/__tests__/vault-recovery-rotation.test.ts
//
// Vault Phase A · Commit A.5 · deterministic route tests for the four
// new routes: /vault/recovery/setup · /vault/unlock/recovery/materials
// · /vault/unlock/recovery/attempt · /vault/rotate · plus architecture
// guards. Same in-memory supabase mock pattern as A.3/A.4 tests, with
// .neq support added for the rotation route.

import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
  session: {
    supabaseUserId: string;
    email: string | null;
    account: Row;
  } | null;
} = { session: null };

function reset() {
  for (const k of Object.keys(store) as Array<keyof typeof store>) {
    store[k].length = 0;
  }
  sessionResolver.session = null;
}

function passesExpiryGuard(row: Row, guardIso: string | null): boolean {
  if (!guardIso) return true;
  const v = row.expires_at;
  if (v === null || v === undefined) return true;
  return (v as string) > guardIso;
}

interface Filters {
  equals: Record<string, unknown>;
  negatives: Record<string, unknown>;
}

function matches(row: Row, f: Filters): boolean {
  for (const [col, want] of Object.entries(f.equals)) {
    if (want === "__NULL__") {
      if (row[col] !== null && row[col] !== undefined) return false;
    } else if (row[col] !== want) {
      return false;
    }
  }
  for (const [col, want] of Object.entries(f.negatives)) {
    if (row[col] === want) return false;
  }
  return true;
}

function makeQuery(table: keyof typeof store) {
  const equals: Record<string, unknown> = {};
  const negatives: Record<string, unknown> = {};
  const gteFilters: Record<string, string> = {};
  let orderCol: string | null = null;
  let orderDesc = false;
  let expiryGuardIso: string | null = null;
  const q: Record<string, unknown> = {
    select() {
      return q;
    },
    eq(col: string, val: unknown) {
      equals[col] = val;
      return q;
    },
    neq(col: string, val: unknown) {
      negatives[col] = val;
      return q;
    },
    is(col: string, val: unknown) {
      if (val === null) equals[col] = "__NULL__";
      return q;
    },
    in(col: string, _list: unknown[]) {
      void col;
      void _list;
      return q;
    },
    gte(col: string, val: string) {
      gteFilters[col] = val;
      return q;
    },
    or(expr: string) {
      const m = expr.match(/expires_at\.is\.null,expires_at\.gt\.(.+)$/);
      if (m) expiryGuardIso = m[1]!;
      return q;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderDesc = opts?.ascending === false;
      return q;
    },
    async maybeSingle() {
      const rows = store[table]
        .filter((r) => matches(r, { equals, negatives }))
        .filter((r) => passesExpiryGuard(r, expiryGuardIso))
        .filter((r) => {
          for (const [col, iso] of Object.entries(gteFilters)) {
            const t = new Date(r[col] as string).getTime();
            if (t < new Date(iso).getTime()) return false;
          }
          return true;
        });
      return { data: rows[0] ?? null, error: null };
    },
    async single() {
      const rows = store[table]
        .filter((r) => matches(r, { equals, negatives }))
        .filter((r) => passesExpiryGuard(r, expiryGuardIso))
        .filter((r) => {
          for (const [col, iso] of Object.entries(gteFilters)) {
            const t = new Date(r[col] as string).getTime();
            if (t < new Date(iso).getTime()) return false;
          }
          return true;
        });
      if (!rows[0]) return { data: null, error: { message: "no row" } };
      return { data: rows[0], error: null };
    },
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      let rows = store[table]
        .filter((r) => matches(r, { equals, negatives }))
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
            return { data: null, error: { message: "duplicate" } };
          },
          then(fn: (v: { error: { message: string } }) => void) {
            fn({ error: { message: "duplicate" } });
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
  const equals: Record<string, unknown> = {};
  const negatives: Record<string, unknown> = {};
  const applyPatch = () => {
    const rows = store[table].filter((r) => matches(r, { equals, negatives }));
    for (const r of rows) Object.assign(r, patch);
    return rows;
  };
  const builder: Record<string, unknown> = {
    eq(col: string, val: unknown) {
      equals[col] = val;
      return builder;
    },
    is(col: string, val: unknown) {
      if (val === null) equals[col] = "__NULL__";
      return builder;
    },
    neq(col: string, val: unknown) {
      negatives[col] = val;
      return builder;
    },
    select(_cols?: string) {
      void _cols;
      const rows = applyPatch();
      const selected = {
        async single() {
          if (!rows[0]) return { data: null, error: { message: "no row" } };
          return { data: rows[0], error: null };
        },
        async maybeSingle() {
          return { data: rows[0] ?? null, error: null };
        },
      };
      return selected;
    },
    then(resolve: (v: { error: null }) => void) {
      applyPatch();
      resolve({ error: null });
    },
  };
  return builder;
}

function makeDelete(table: keyof typeof store) {
  const equals: Record<string, unknown> = {};
  const negatives: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    eq(col: string, val: unknown) {
      equals[col] = val;
      return builder;
    },
    is(col: string, val: unknown) {
      if (val === null) equals[col] = "__NULL__";
      return builder;
    },
    neq(col: string, val: unknown) {
      negatives[col] = val;
      return builder;
    },
    then(resolve: (v: { error: null; count: number }) => void) {
      const kept = store[table].filter(
        (r) => !matches(r, { equals, negatives }),
      );
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
        insert: (row: Row | Row[]) =>
          makeInsert(table as keyof typeof store, row),
        update: (patch: Row) =>
          makeUpdate(table as keyof typeof store, patch),
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

process.env.NEX_SUPABASE_URL = process.env.NEX_SUPABASE_URL ?? "http://local/";
process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "anon_fake";

const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_A = "11111111-1111-1111-1111-111111111111";
const DEVICE_A = "device-aaaa-01";
const DEVICE_B = "device-bbbb-02";

function seedBase(opts: {
  unlocked?: boolean;
  webauthnFresh?: boolean;
  passwordFresh?: boolean;
  recoveryConfigured?: boolean;
  vmkGeneration?: number;
} = {}) {
  const now = new Date();
  sessionResolver.session = {
    supabaseUserId: "u1",
    email: "a@test",
    account: { id: ACCOUNT_A, sessions_invalidated_at: null },
  };
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
  store.nex_account_device_key.push(
    {
      account_id: ACCOUNT_A,
      device_id: DEVICE_A,
      public_key: "A".repeat(44),
      revoked_at: null,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
    },
    {
      account_id: ACCOUNT_A,
      device_id: DEVICE_B,
      public_key: "B".repeat(44),
      revoked_at: null,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
    },
  );
  const vmkGeneration = opts.vmkGeneration ?? 1;
  store.nex_vault_setup.push({
    account_id: ACCOUNT_A,
    pin_mode: "pin",
    pin_salt: "\\x" + "00".repeat(16),
    pin_argon_params: { t: 3, m: 65536 },
    prf_salt: "\\x" + "00".repeat(16),
    recovery_configured_at: opts.recoveryConfigured ? now.toISOString() : null,
    recovery_salt: opts.recoveryConfigured ? "\\x" + "11".repeat(16) : null,
    recovery_argon_params: opts.recoveryConfigured ? { t: 4, m: 131072 } : null,
    vmk_generation: vmkGeneration,
  });
  // Seed PIN envelopes for both devices.
  store.nex_vault_key_envelope.push(
    {
      id: "pin-A",
      account_id: ACCOUNT_A,
      kind: "pin",
      target_device_id: DEVICE_A,
      credential_id: null,
      wrapped_vmk: "\\x" + "aa".repeat(48),
      nonce: "\\x" + "bb".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: vmkGeneration,
      consumed_at: null,
      expires_at: null,
    },
    {
      id: "pin-B",
      account_id: ACCOUNT_A,
      kind: "pin",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: "\\x" + "cc".repeat(48),
      nonce: "\\x" + "dd".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: vmkGeneration,
      consumed_at: null,
      expires_at: null,
    },
  );
  if (opts.recoveryConfigured) {
    store.nex_vault_key_envelope.push({
      id: "rec-1",
      account_id: ACCOUNT_A,
      kind: "recovery",
      target_device_id: null,
      credential_id: null,
      wrapped_vmk: "\\x" + "ee".repeat(48),
      nonce: "\\x" + "ff".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: vmkGeneration,
      consumed_at: null,
      expires_at: null,
    });
  }
}

function req(body?: unknown, method: "POST" | "GET" = "POST"): NextRequest {
  return new NextRequest("http://localhost/x", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(reset);

// ---------------------------------------------------------------------------
// /vault/recovery/setup
// ---------------------------------------------------------------------------
describe("POST /vault/recovery/setup", () => {
  const validBody = {
    recovery_salt_hex: "11".repeat(16),
    recovery_argon_params: { t: 4, m: 131072 },
    wrapped_vmk_hex: "22".repeat(48),
    nonce_hex: "33".repeat(12),
  };

  test("401 without session", async () => {
    const mod = await import("@/app/api/nex-native/vault/recovery/setup/route");
    const res = await mod.POST(req(validBody));
    expect(res.status).toBe(401);
  });

  test("403 when Vault not unlocked", async () => {
    seedBase({ passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/recovery/setup/route");
    const res = await mod.POST(req(validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).required).toEqual(["vault_unlock"]);
  });

  test("403 when neither password nor webauthn fresh", async () => {
    seedBase({ unlocked: true });
    const mod = await import("@/app/api/nex-native/vault/recovery/setup/route");
    const res = await mod.POST(req(validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).required).toEqual(["webauthn_or_password"]);
  });

  test("happy path · stores setup + envelope + logs event", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/recovery/setup/route");
    const res = await mod.POST(req(validBody));
    expect(res.status).toBe(200);
    const setup = store.nex_vault_setup[0]!;
    expect(setup.recovery_configured_at).not.toBeNull();
    const env = store.nex_vault_key_envelope.find(
      (e) => e.kind === "recovery" && e.consumed_at === null,
    );
    expect(env).toBeTruthy();
    const event = store.nex_sign_in_event.find(
      (e) => e.event_type === "recovery_configured",
    );
    expect(event).toBeTruthy();
  });

  test("400 on invalid wrapped_vmk length", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/recovery/setup/route");
    const res = await mod.POST(
      req({ ...validBody, wrapped_vmk_hex: "22".repeat(10) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wrapped_vmk_length");
  });
});

// ---------------------------------------------------------------------------
// /vault/unlock/recovery/materials · rate limit + envelope leak check
// ---------------------------------------------------------------------------
describe("POST /vault/unlock/recovery/materials", () => {
  test("401 without session", async () => {
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/materials/route"
    );
    const res = await mod.POST(req());
    expect(res.status).toBe(401);
  });

  test("404 when recovery not configured", async () => {
    seedBase({});
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/materials/route"
    );
    const res = await mod.POST(req());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("recovery_not_configured");
  });

  test("happy path returns opaque materials", async () => {
    seedBase({ recoveryConfigured: true });
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/materials/route"
    );
    const res = await mod.POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recovery_salt_hex).toBe("11".repeat(16));
    expect(body.wrapped_vmk_hex).toBe("ee".repeat(48));
    expect(body.algorithm).toBe("aes-256-gcm/v1");
  });

  test("429 and NO envelope leak when rate-limited", async () => {
    seedBase({ recoveryConfigured: true });
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      store.nex_vault_recovery_attempt.push({
        account_id: ACCOUNT_A,
        success: false,
        attempted_at: new Date(now.getTime() - i * 5 * 60 * 1000).toISOString(),
      });
    }
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/materials/route"
    );
    const res = await mod.POST(req());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.wrapped_vmk_hex).toBeUndefined();
    expect(body.recovery_salt_hex).toBeUndefined();
    expect(body.error).toBe("rate_limited");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// /vault/unlock/recovery/attempt
// ---------------------------------------------------------------------------
describe("POST /vault/unlock/recovery/attempt", () => {
  test("success=true marks unlocked + logs vault_unlock", async () => {
    seedBase({ recoveryConfigured: true });
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/attempt/route"
    );
    const res = await mod.POST(req({ success: true }));
    expect(res.status).toBe(200);
    expect(store.nex_session[0]!.last_vault_unlock_at).not.toBeNull();
    expect(
      store.nex_vault_recovery_attempt.find((a) => a.success === true),
    ).toBeTruthy();
  });

  test("success=false logs vault_unlock_failed + returns rate verdict", async () => {
    seedBase({ recoveryConfigured: true });
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/attempt/route"
    );
    const res = await mod.POST(req({ success: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unlocked).toBe(false);
    expect(body.rate.allowed).toBe(true);
    expect(
      store.nex_sign_in_event.find(
        (e) => e.event_type === "vault_unlock_failed",
      ),
    ).toBeTruthy();
  });

  test("400 when success flag missing", async () => {
    seedBase({ recoveryConfigured: true });
    const mod = await import(
      "@/app/api/nex-native/vault/unlock/recovery/attempt/route"
    );
    const res = await mod.POST(req({}));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /vault/rotate
// ---------------------------------------------------------------------------
describe("POST /vault/rotate", () => {
  const validBase = {
    old_generation: 1,
    current_device_id: DEVICE_A,
    pin_wrapped_vmk_hex: "aa".repeat(48),
    pin_nonce_hex: "bb".repeat(12),
    file_updates: [] as unknown[],
  };

  test("403 without step-up", async () => {
    seedBase({ unlocked: true });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(req(validBase));
    expect(res.status).toBe(403);
  });

  test("409 when old_generation does not match current", async () => {
    seedBase({ unlocked: true, passwordFresh: true, vmkGeneration: 1 });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(req({ ...validBase, old_generation: 5 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("generation_mismatch");
  });

  test("happy path · updates current device PIN · deletes other PIN · bumps generation", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(req(validBase));
    expect(res.status).toBe(200);
    expect((await res.json()).new_generation).toBe(2);
    // Current device PIN envelope: updated wrapped_vmk / nonce / generation.
    const pinA = store.nex_vault_key_envelope.find(
      (e) => e.kind === "pin" && e.target_device_id === DEVICE_A && e.consumed_at === null,
    );
    expect(pinA).toBeTruthy();
    expect(pinA!.generation).toBe(2);
    // Other device's PIN envelope: gone.
    const pinB = store.nex_vault_key_envelope.find(
      (e) => e.kind === "pin" && e.target_device_id === DEVICE_B && e.consumed_at === null,
    );
    expect(pinB).toBeUndefined();
    // Setup generation bumped.
    expect(store.nex_vault_setup[0]!.vmk_generation).toBe(2);
    // Audit event.
    expect(
      store.nex_sign_in_event.find((e) => e.event_type === "vault_rotated"),
    ).toBeTruthy();
  });

  test("rejects rotation without recovery pair when recovery is configured", async () => {
    seedBase({ unlocked: true, passwordFresh: true, recoveryConfigured: true });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(req(validBase));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("recovery_pair_missing");
  });

  test("rotates recovery envelope when provided", async () => {
    seedBase({ unlocked: true, passwordFresh: true, recoveryConfigured: true });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(
      req({
        ...validBase,
        recovery_wrapped_vmk_hex: "11".repeat(48),
        recovery_nonce_hex: "22".repeat(12),
      }),
    );
    expect(res.status).toBe(200);
    const recoveryEnv = store.nex_vault_key_envelope.find(
      (e) => e.kind === "recovery" && e.consumed_at === null,
    );
    expect(recoveryEnv).toBeTruthy();
    expect(recoveryEnv!.generation).toBe(2);
  });

  test("rejects recovery pair when recovery is not configured", async () => {
    seedBase({ unlocked: true, passwordFresh: true, recoveryConfigured: false });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(
      req({
        ...validBase,
        recovery_wrapped_vmk_hex: "11".repeat(48),
        recovery_nonce_hex: "22".repeat(12),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("recovery_not_configured");
  });

  test("deletes pending device envelopes", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    store.nex_vault_key_envelope.push({
      id: "pending-device",
      account_id: ACCOUNT_A,
      kind: "device",
      target_device_id: DEVICE_B,
      credential_id: null,
      wrapped_vmk: "\\x" + "77".repeat(80),
      nonce: "\\x" + "88".repeat(12),
      algorithm: "aes-256-gcm/v1",
      generation: 1,
      consumed_at: null,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(req(validBase));
    expect(res.status).toBe(200);
    const stillPending = store.nex_vault_key_envelope.find(
      (e) => e.kind === "device" && e.consumed_at === null,
    );
    expect(stillPending).toBeUndefined();
  });

  test("403 when caller device is revoked", async () => {
    seedBase({ unlocked: true, passwordFresh: true });
    store.nex_account_device_key.find(
      (d) => d.device_id === DEVICE_A,
    )!.revoked_at = new Date().toISOString();
    const mod = await import("@/app/api/nex-native/vault/rotate/route");
    const res = await mod.POST(req(validBase));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("device_revoked");
  });
});

// ---------------------------------------------------------------------------
// Architecture guards · zero commercial · no server-side crypto
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

describe("A.5 architecture guards", () => {
  const serverFiles = [
    "src/app/api/nex-native/vault/recovery/setup/route.ts",
    "src/app/api/nex-native/vault/unlock/recovery/materials/route.ts",
    "src/app/api/nex-native/vault/unlock/recovery/attempt/route.ts",
    "src/app/api/nex-native/vault/rotate/route.ts",
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

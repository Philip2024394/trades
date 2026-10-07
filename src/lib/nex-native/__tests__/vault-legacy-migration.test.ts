// src/lib/nex-native/__tests__/vault-legacy-migration.test.ts
//
// Vault Phase A · Commit A.6 · deterministic tests for legacy-file
// migration + reconciliation + architecture guards.
//
// Coverage:
//   · reconcile() branches for every §M.3 case (legacy·migrating·
//     encrypted·failed · {enc_exists, leg_exists} matrix)
//   · state transitions (markFileLegacy / markFileFailed /
//     writeEncryptionMetadata / finalizeEncrypted)
//   · attempt table semantics (startAttempt, getActiveAttempt,
//     updateAttemptStatus · idempotency)
//   · structural validator (§P.2 + §P.3)
//   · architecture guards: zero commercial, no server-side decrypt /
//     derive / plaintext hashing in migration routes

import { describe, test, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
const store: {
  nex_vault_file: Row[];
  nex_vault_file_migration_attempt: Row[];
  nex_sign_in_event: Row[];
} = {
  nex_vault_file: [],
  nex_vault_file_migration_attempt: [],
  nex_sign_in_event: [],
};

/** Virtual object store · maps path → { size } so HEAD and delete can
 *  be modelled. The sealed object-storage abstraction is mocked
 *  wholesale so no real backend is required. */
const objects = new Map<string, { size: number }>();

function reset() {
  for (const k of Object.keys(store) as Array<keyof typeof store>) {
    store[k].length = 0;
  }
  objects.clear();
}

function matches(row: Row, filters: { equals: Row; in?: [string, unknown[]][] }): boolean {
  for (const [col, want] of Object.entries(filters.equals)) {
    if (want === "__NULL__") {
      if (row[col] !== null && row[col] !== undefined) return false;
    } else if (row[col] !== want) {
      return false;
    }
  }
  for (const [col, values] of filters.in ?? []) {
    if (!values.includes(row[col])) return false;
  }
  return true;
}

function makeQuery(table: keyof typeof store) {
  const filters: { equals: Row; in: [string, unknown[]][] } = {
    equals: {},
    in: [],
  };
  let orderCol: string | null = null;
  let orderDesc = false;
  const q: Record<string, unknown> = {
    select() {
      return q;
    },
    eq(col: string, val: unknown) {
      filters.equals[col] = val;
      return q;
    },
    is(col: string, val: unknown) {
      if (val === null) filters.equals[col] = "__NULL__";
      return q;
    },
    in(col: string, list: unknown[]) {
      filters.in.push([col, list]);
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
      resolve({ data: rows, error: null });
    },
  };
  return q;
}

function makeInsert(table: keyof typeof store, row: Row | Row[]) {
  const rows = Array.isArray(row) ? row : [row];
  for (const r of rows) {
    // Partial unique index on nex_vault_file_migration_attempt (file_id)
    // WHERE status NOT IN ('finalized','failed').
    if (table === "nex_vault_file_migration_attempt") {
      const existing = store.nex_vault_file_migration_attempt.find(
        (e) =>
          e.file_id === r.file_id &&
          !["finalized", "failed"].includes(e.status as string),
      );
      if (existing) {
        return {
          select() {
            return this;
          },
          async single() {
            return { data: null, error: { message: "duplicate active attempt" } };
          },
          then(fn: (v: { error: { message: string } }) => void) {
            fn({ error: { message: "duplicate active attempt" } });
          },
        };
      }
    }
    const copy = {
      id: `${table}-${store[table].length + 1}`,
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
  const filters: { equals: Row; in: [string, unknown[]][] } = {
    equals: {},
    in: [],
  };
  const builder: Record<string, unknown> = {
    eq(col: string, val: unknown) {
      filters.equals[col] = val;
      return builder;
    },
    is(col: string, val: unknown) {
      if (val === null) filters.equals[col] = "__NULL__";
      return builder;
    },
    in(col: string, list: unknown[]) {
      filters.in.push([col, list]);
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
        insert: (row: Row | Row[]) => makeInsert(table as keyof typeof store, row),
        update: (patch: Row) => makeUpdate(table as keyof typeof store, patch),
      };
    },
  },
}));

vi.mock("@/lib/nex/storage/object-registry", () => ({
  getObjectStorage: () => ({
    async head(_bucket: string, key: string) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        bucket: _bucket,
        key,
        version_id: "v1",
        content_hash: "x",
        size_bytes: obj.size,
        mime_type: "application/octet-stream",
        uploaded_at: new Date().toISOString(),
        uploaded_by: null,
        business_id: null,
        source_ref: null,
        is_delete_marker: false,
        custom: {},
      };
    },
    async delete(_bucket: string, key: string, _opts?: unknown) {
      void _opts;
      objects.delete(key);
    },
    async put(_bucket: string, key: string, input: { body: Buffer }) {
      objects.set(key, { size: input.body.byteLength });
      return {
        bucket: _bucket,
        key,
        version_id: "v1",
        content_hash: "x",
        size_bytes: input.body.byteLength,
        mime_type: "application/octet-stream",
        uploaded_at: new Date().toISOString(),
      };
    },
    async get() {
      return null;
    },
  }),
}));

vi.mock("@/lib/nex-native/security-service", () => ({
  logSignInEvent: async () => {
    /* no-op · attempt-table / audit logging modelled separately */
  },
}));

const ACCOUNT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FILE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const LEG_PATH = `${ACCOUNT}/${FILE}`;
const ENC_PATH = `${ACCOUNT}/encrypted/g1/${FILE}`;

const BYTE_SIZE = 100;
const ENCRYPTED_SIZE = BYTE_SIZE + 16;

interface SeedOpts {
  state: "legacy" | "migrating" | "encrypted" | "failed";
  wrappedKey?: boolean;
  encObjectExists?: boolean;
  legObjectExists?: boolean;
}

function seedFile(opts: SeedOpts) {
  const hasKey = opts.wrappedKey ?? ["migrating", "encrypted"].includes(opts.state);
  const legacyBytesPath =
    opts.state === "encrypted" ? null : LEG_PATH;
  store.nex_vault_file.push({
    id: FILE,
    account_id: ACCOUNT,
    byte_size: BYTE_SIZE,
    bucket_path: LEG_PATH,
    legacy_bytes_path: legacyBytesPath,
    wrapped_content_key: hasKey ? "\\x" + "aa".repeat(60) : null,
    content_nonce: hasKey ? "\\x" + "bb".repeat(12) : null,
    encryption_algorithm: hasKey ? "aes-256-gcm/v1" : null,
    rotation_generation: 1,
    migration_state: opts.state,
    migrated_at: opts.state === "encrypted" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  });
  if (opts.encObjectExists ?? false) {
    objects.set(ENC_PATH, { size: ENCRYPTED_SIZE });
  }
  if ((opts.legObjectExists ?? legacyBytesPath !== null) && legacyBytesPath) {
    objects.set(legacyBytesPath, { size: BYTE_SIZE });
  }
}

beforeEach(reset);

// ---------------------------------------------------------------------------
// Reconciliation · §M.3 branch coverage
// ---------------------------------------------------------------------------
describe("reconcile · §M.3 state × object matrix", () => {
  test("state=encrypted · NOOP", async () => {
    seedFile({ state: "encrypted" });
    objects.set(ENC_PATH, { size: ENCRYPTED_SIZE });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("noop");
  });

  test("state=legacy · no encrypted · NOOP", async () => {
    seedFile({ state: "legacy" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("noop");
  });

  test("state=legacy · orphan encrypted exists · orphan deleted", async () => {
    seedFile({ state: "legacy" });
    objects.set(ENC_PATH, { size: ENCRYPTED_SIZE });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("orphan_deleted_ready_for_retry");
    expect(objects.has(ENC_PATH)).toBe(false);
  });

  test("state=migrating · both objects present · finalized", async () => {
    seedFile({
      state: "migrating",
      encObjectExists: true,
      legObjectExists: true,
    });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("finalized");
    // Legacy object deleted · file row flipped to encrypted
    expect(objects.has(LEG_PATH)).toBe(false);
    const row = store.nex_vault_file[0]!;
    expect(row.migration_state).toBe("encrypted");
    expect(row.legacy_bytes_path).toBeNull();
    expect(row.migrated_at).not.toBeNull();
  });

  test("state=migrating · encrypted exists · legacy gone · critical case finalizes from partial deletion", async () => {
    seedFile({
      state: "migrating",
      encObjectExists: true,
      legObjectExists: false,
    });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("finalized_from_partial_deletion");
    const row = store.nex_vault_file[0]!;
    expect(row.migration_state).toBe("encrypted");
    expect(row.legacy_bytes_path).toBeNull();
  });

  test("state=migrating · encrypted exists · legacy gone · size mismatch · critical inconsistency", async () => {
    seedFile({ state: "migrating", legObjectExists: false });
    objects.set(ENC_PATH, { size: BYTE_SIZE }); // wrong size, missing GCM tag
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("critical_inconsistency");
    // Row still 'migrating' · not falsely marked encrypted
    expect(store.nex_vault_file[0]!.migration_state).toBe("migrating");
  });

  test("state=migrating · encrypted gone · legacy present · rolled back to legacy", async () => {
    seedFile({ state: "migrating", legObjectExists: true });
    // No encrypted object
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("rolled_back_ready_for_retry");
    const row = store.nex_vault_file[0]!;
    expect(row.migration_state).toBe("legacy");
    expect(row.wrapped_content_key).toBeNull();
    expect(row.content_nonce).toBeNull();
    expect(row.encryption_algorithm).toBeNull();
  });

  test("state=migrating · both missing · DATA LOSS", async () => {
    seedFile({ state: "migrating", legObjectExists: false });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("data_loss");
    expect(store.nex_vault_file[0]!.migration_state).toBe("failed");
  });

  test("state=failed · orphan encrypted present · deleted + reset to legacy", async () => {
    seedFile({ state: "failed", encObjectExists: true });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("ready_for_retry_from_failed");
    expect(objects.has(ENC_PATH)).toBe(false);
    expect(store.nex_vault_file[0]!.migration_state).toBe("legacy");
  });

  test("state=failed · no orphan · reset to legacy", async () => {
    seedFile({ state: "failed" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("ready_for_retry_from_failed");
    expect(store.nex_vault_file[0]!.migration_state).toBe("legacy");
  });

  test("file_not_found · critical_inconsistency", async () => {
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const r = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(r.outcome).toBe("critical_inconsistency");
  });

  test("idempotent · running reconcile twice is NOOP on second call", async () => {
    seedFile({ state: "encrypted" });
    objects.set(ENC_PATH, { size: ENCRYPTED_SIZE });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const first = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    const second = await mod.reconcile({ accountId: ACCOUNT, fileId: FILE });
    expect(first.outcome).toBe("noop");
    expect(second.outcome).toBe("noop");
  });
});

// ---------------------------------------------------------------------------
// State transitions · markFileLegacy / markFileFailed /
// writeEncryptionMetadata / finalizeEncrypted
// ---------------------------------------------------------------------------
describe("state transitions", () => {
  test("markFileLegacy · failed → legacy", async () => {
    seedFile({ state: "failed" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    await mod.markFileLegacy({ accountId: ACCOUNT, fileId: FILE });
    expect(store.nex_vault_file[0]!.migration_state).toBe("legacy");
  });

  test("markFileFailed · migrating → failed, metadata cleared", async () => {
    seedFile({ state: "migrating", legObjectExists: true });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    await mod.markFileFailed({ accountId: ACCOUNT, fileId: FILE });
    const row = store.nex_vault_file[0]!;
    expect(row.migration_state).toBe("failed");
    expect(row.wrapped_content_key).toBeNull();
  });

  test("writeEncryptionMetadata · legacy → migrating with required fields", async () => {
    seedFile({ state: "legacy" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    await mod.writeEncryptionMetadata({
      accountId: ACCOUNT,
      fileId: FILE,
      wrappedContentKey: new Uint8Array(60),
      contentNonce: new Uint8Array(12),
      encryptionAlgorithm: "aes-256-gcm/v1",
    });
    const row = store.nex_vault_file[0]!;
    expect(row.migration_state).toBe("migrating");
    expect(row.wrapped_content_key).not.toBeNull();
    expect(row.content_nonce).not.toBeNull();
    expect(row.encryption_algorithm).toBe("aes-256-gcm/v1");
  });

  test("writeEncryptionMetadata · rejects wrong wrapped-key length", async () => {
    seedFile({ state: "legacy" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    await expect(
      mod.writeEncryptionMetadata({
        accountId: ACCOUNT,
        fileId: FILE,
        wrappedContentKey: new Uint8Array(32),
        contentNonce: new Uint8Array(12),
        encryptionAlgorithm: "aes-256-gcm/v1",
      }),
    ).rejects.toThrow();
  });

  test("writeEncryptionMetadata · rejects wrong nonce length", async () => {
    seedFile({ state: "legacy" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    await expect(
      mod.writeEncryptionMetadata({
        accountId: ACCOUNT,
        fileId: FILE,
        wrappedContentKey: new Uint8Array(60),
        contentNonce: new Uint8Array(24),
        encryptionAlgorithm: "aes-256-gcm/v1",
      }),
    ).rejects.toThrow();
  });

  test("finalizeEncrypted · deletes legacy object + flips state", async () => {
    seedFile({ state: "migrating", legObjectExists: true });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    await mod.finalizeEncrypted({
      accountId: ACCOUNT,
      fileId: FILE,
      legacyBytesPath: LEG_PATH,
    });
    expect(objects.has(LEG_PATH)).toBe(false);
    const row = store.nex_vault_file[0]!;
    expect(row.migration_state).toBe("encrypted");
    expect(row.legacy_bytes_path).toBeNull();
    expect(row.migrated_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Attempt table concurrency / idempotency
// ---------------------------------------------------------------------------
describe("attempt table · concurrency", () => {
  test("partial unique index · second attempt blocked while first is active", async () => {
    seedFile({ state: "legacy" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const first = await mod.startAttempt({
      accountId: ACCOUNT,
      fileId: FILE,
      startedByDeviceId: "device-aaaa-01",
    });
    expect(first.status).toBe("started");
    await expect(
      mod.startAttempt({
        accountId: ACCOUNT,
        fileId: FILE,
        startedByDeviceId: "device-bbbb-02",
      }),
    ).rejects.toThrow();
  });

  test("second attempt allowed AFTER first terminates", async () => {
    seedFile({ state: "legacy" });
    const mod = await import("@/lib/nex-native/vault/migration-service");
    const first = await mod.startAttempt({
      accountId: ACCOUNT,
      fileId: FILE,
      startedByDeviceId: "device-aaaa-01",
    });
    await mod.updateAttemptStatus({
      accountId: ACCOUNT,
      attemptId: first.id,
      status: "failed",
    });
    const second = await mod.startAttempt({
      accountId: ACCOUNT,
      fileId: FILE,
      startedByDeviceId: "device-bbbb-02",
    });
    expect(second.status).toBe("started");
  });
});

// ---------------------------------------------------------------------------
// Structural validator · §P.2 shape
// ---------------------------------------------------------------------------
describe("ciphertext-structural-validator · §P.2", () => {
  test("accepts correct shape", async () => {
    const mod = await import(
      "@/lib/nex-native/vault/ciphertext-structural-validator"
    );
    const r = mod.validateMetadataShape({
      wrapped_content_key: new Uint8Array(60),
      content_nonce: new Uint8Array(12),
      encryption_algorithm: "aes-256-gcm/v1",
    });
    expect(r.ok).toBe(true);
  });
  test("rejects wrong wrapped_content_key length", async () => {
    const mod = await import(
      "@/lib/nex-native/vault/ciphertext-structural-validator"
    );
    const r = mod.validateMetadataShape({
      wrapped_content_key: new Uint8Array(48),
      content_nonce: new Uint8Array(12),
      encryption_algorithm: "aes-256-gcm/v1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("wrapped_content_key_length");
  });
  test("rejects wrong nonce length", async () => {
    const mod = await import(
      "@/lib/nex-native/vault/ciphertext-structural-validator"
    );
    const r = mod.validateMetadataShape({
      wrapped_content_key: new Uint8Array(60),
      content_nonce: new Uint8Array(24),
      encryption_algorithm: "aes-256-gcm/v1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("content_nonce_length");
  });
  test("rejects non-allowlisted algorithm", async () => {
    const mod = await import(
      "@/lib/nex-native/vault/ciphertext-structural-validator"
    );
    const r = mod.validateMetadataShape({
      wrapped_content_key: new Uint8Array(60),
      content_nonce: new Uint8Array(12),
      encryption_algorithm: "aes-128-cbc/v1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("algorithm_not_allowed");
  });

  test("encryptedPathFor is deterministic + generation-scoped", async () => {
    const mod = await import(
      "@/lib/nex-native/vault/ciphertext-structural-validator"
    );
    expect(mod.encryptedPathFor("a", "f", 1)).toBe("a/encrypted/g1/f");
    expect(mod.encryptedPathFor("a", "f", 2)).toBe("a/encrypted/g2/f");
    expect(mod.encryptedPathFor("a", "f", 1)).toBe(
      mod.encryptedPathFor("a", "f", 1),
    );
  });

  test("encryptedPathFor rejects invalid generation", async () => {
    const mod = await import(
      "@/lib/nex-native/vault/ciphertext-structural-validator"
    );
    expect(() => mod.encryptedPathFor("a", "f", 0)).toThrow();
    expect(() => mod.encryptedPathFor("a", "f", 1.5)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Architecture guards · zero commercial / plaintext-blindness
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

describe("A.6 architecture guards", () => {
  const serverFiles = [
    "src/app/api/nex-native/vault/migration/queue/route.ts",
    "src/app/api/nex-native/vault/migration/start/route.ts",
    "src/app/api/nex-native/vault/migration/upload/route.ts",
    "src/app/api/nex-native/vault/migration/finalize-metadata/route.ts",
    "src/app/api/nex-native/vault/migration/finalize/route.ts",
    "src/app/api/nex-native/vault/migration/read-encrypted/route.ts",
    "src/lib/nex-native/vault/migration-service.ts",
    "src/lib/nex-native/vault/ciphertext-structural-validator.ts",
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
    test(`${f} · zero commercial-token references in code`, async () => {
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

    test(`${f} · no server-side decrypt / derive / plaintext hash`, async () => {
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
      // Server must NOT compute a sha256/sha-256 digest of plaintext
      // Vault content. subtle.digest + createHash("sha256") usages on
      // Vault BYTES are forbidden. Here we grep the whole file for
      // "sha256" / "SHA-256" / createHash occurrences and whitelist
      // only the ones in comments; code must contain zero.
      expect(code).not.toMatch(/subtle\.digest/);
      expect(code).not.toMatch(/createHash\s*\(\s*["']sha(-?256)["']/i);
    });
  }

  // 2026-10-07 A.6 Playwright regression · the start route must pass
  // the signed URL through to download_url as a bare string, since
  // createSignedDownloadUrl returns Promise<string | null>. An earlier
  // draft accessed `.url` on it, which yielded undefined and silently
  // dropped the field from the response · client then aborted with
  // "incomplete_start_response".
  test("A.6 start route · download_url pass-through matches createSignedDownloadUrl's bare-string contract", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const routeRaw = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../..",
        "src/app/api/nex-native/vault/migration/start/route.ts",
      ),
      "utf8",
    );
    const routeCode = stripComments(routeRaw);
    // Must assign the bare `signed` identifier (string result)
    expect(routeCode).toMatch(/download_url:\s*signed\b(?!\s*\.)/);
    // Must NOT access any property (.url, .href, ...) on the string.
    expect(routeCode).not.toMatch(/download_url:\s*signed\.\w+/);

    // Upstream contract · pin createSignedDownloadUrl's return type so a
    // future refactor from `Promise<string | null>` to `Promise<{url}|null>`
    // would re-break the route and must come with a route update.
    const serviceRaw = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../..",
        "src/lib/nex-native/vault-file-service.ts",
      ),
      "utf8",
    );
    expect(serviceRaw).toMatch(
      /export\s+async\s+function\s+createSignedDownloadUrl[\s\S]{0,400}?:\s*Promise<\s*string\s*\|\s*null\s*>/,
    );
  });
});

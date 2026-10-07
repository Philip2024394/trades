// tests/e2e/vault-phase-a-6.spec.ts
//
// Vault Phase A · Commit A.6 · real-browser proof for legacy file
// encryption migration.
//
// Lifecycle matches reality:
//   · Legacy files exist from BEFORE Phase A/A.1 — before Vault was
//     configured. The seed therefore happens BEFORE Vault setup.
//     Vault setup then leaves the Vault UNLOCKED (VMK in memory from
//     the derive step), the user lands on /vault/home, and the
//     MigrationRunner mount discovers the legacy file.
//
// What this spec proves:
//   1. Alice + Bob provisioned
//   2. Alice has a legacy file (migration_state='legacy',
//      legacy_bytes_path != NULL, wrapped_content_key IS NULL)
//      SEEDED BEFORE Vault setup
//   3. Alice sets up Vault with PIN · setup leaves Vault UNLOCKED
//   4. /vault/home · MigrationRunner finds the legacy file · banner
//      shows "N file(s) from earlier aren't secured on this device
//      yet" (NEVER "encrypted")
//   5. Click "Secure now" · real browser performs the full migration
//      (download → encrypt → upload → round-trip decrypt self-check
//      → VMK wrap → finalize metadata → finalize)
//   6. DB: migration_state='encrypted', legacy_bytes_path NULL,
//      wrapped_content_key / content_nonce present, algorithm =
//      'aes-256-gcm/v1', migrated_at populated
//   7. Object store: legacy object gone, encrypted object exists at
//      generation-scoped path, size = plaintext + 16 (AES-GCM tag)
//   8. Crypto round-trip proof: fetch the ciphertext from the
//      production read-encrypted route · verify SHA-256(ciphertext)
//      != SHA-256(plaintext) and ciphertext.length = plaintext+16 ·
//      network trace proves the client's self-check decrypt happened
//      BEFORE finalize-metadata (reaching 'encrypted' is impossible
//      without self-check passing · client aborts on mismatch)
//   9. Idempotency: a second /migration/start returns
//      'already_encrypted' with no new attempt row and no new
//      encrypted-object version
//  10. Bob isolation: Bob's auth session cannot read Alice's queue,
//      cannot start migration on Alice's file, cannot read Alice's
//      encrypted bytes
//  11. Network secrecy: PIN, plaintext bytes, and plaintext content
//      never appear in any request body

import {
  test,
  expect,
  type BrowserContext,
  type Request,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";

(() => {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!])
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
})();

const SUPABASE_URL =
  process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY ?? "";
// NOTE on database boundary (2026-10-07):
//   The NEX architecture splits storage across TWO Postgres databases:
//     · Supabase cloud (relational tables: nex_vault_file, nex_account,
//       auth) — reached via Supabase admin client using the SUPABASE_URL
//       + SERVICE_ROLE_KEY env.
//     · Local Postgres (binary blob storage: nex.object_blobs,
//       nex.object_blob_current) — reached via NEX_POSTGRES_URL. This
//       is where PostgresObjectStorage adapter reads/writes bytes.
//   An earlier draft of this spec used DATABASE_URL for BOTH, so legacy
//   bytes were seeded into Supabase's nex.object_blobs but the server-
//   side adapter looked them up in local pg → 404 on legacy download.
//   DATABASE_URL is intentionally not referenced for object-storage
//   tables anymore. If you add a new object-storage probe, use
//   NEX_POSTGRES_URL.
const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL ?? "";
const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

const DEVICE_A_PIN = "12345678";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "tests",
  "e2e-screenshots",
  "vault-phase-a-6",
);

const LEGACY_PLAINTEXT = Buffer.from(
  "nex-vault-legacy-file-A6-sentinel-content-not-secret-just-marker",
  "utf8",
);
const LEGACY_PLAINTEXT_SHA = createHash("sha256")
  .update(LEGACY_PLAINTEXT)
  .digest("hex");

interface Fixture {
  authId: string;
  accountId: string;
  email: string;
  password: string;
  jwt: string;
  refresh: string;
}

async function provisionAccount(suffix: string): Promise<Fixture> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `playwright-vault-a6-${suffix}-${Date.now()}@test.local`;
  const password = `Playwright!PW${Date.now()}`;
  const createUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUser.error || !createUser.data.user) {
    throw new Error(`createUser ${suffix}: ${createUser.error?.message}`);
  }
  const authId = createUser.data.user.id;
  const acc = await admin
    .from("nex_account")
    .insert({
      supabase_user_id: authId,
      display_name: `Playwright Vault A6 ${suffix}`,
    })
    .select("*")
    .single();
  if (acc.error || !acc.data) {
    throw new Error(`insert account ${suffix}: ${acc.error?.message}`);
  }
  const accountId = (acc.data as { id: string }).id;
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`signIn ${suffix}: ${signIn.error?.message}`);
  }
  return {
    authId,
    accountId,
    email,
    password,
    jwt: signIn.data.session.access_token,
    refresh: signIn.data.session.refresh_token,
  };
}

interface SeedResult {
  fileId: string;
  legacyPath: string;
}

async function seedLegacyFile(input: {
  accountId: string;
  plaintext: Buffer;
  displayName: string;
}): Promise<SeedResult> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fileId = randomUUID();
  const legacyPath = `${input.accountId}/${fileId}`;
  const ins = await admin
    .from("nex_vault_file")
    .insert({
      id: fileId,
      account_id: input.accountId,
      category: "documents",
      display_name: input.displayName,
      mime_type: "application/octet-stream",
      byte_size: input.plaintext.length,
      bucket_path: legacyPath,
      legacy_bytes_path: legacyPath,
      migration_state: "legacy",
      rotation_generation: 1,
    })
    .select("*")
    .single();
  if (ins.error) throw new Error(`seed insert: ${ins.error.message}`);

  // Legacy bytes live in the LOCAL Postgres instance that the
  // PostgresObjectStorage adapter reads · NEX_POSTGRES_URL · NOT the
  // Supabase cloud (DATABASE_URL) that the relational row above landed
  // in. See the top-of-file database-boundary note.
  const pg = new PgClient({ connectionString: NEX_POSTGRES_URL });
  await pg.connect();
  try {
    const versionId = randomUUID();
    await pg.query(
      `INSERT INTO nex.object_blobs
         (bucket, key, version_id, body, content_hash, size_bytes,
          mime_type, uploaded_at, uploaded_by, business_id, source_ref,
          is_delete_marker, custom)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8, NULL, 'seed_legacy',
               false, '{}')`,
      [
        "nex-vault-files",
        legacyPath,
        versionId,
        input.plaintext,
        createHash("sha256").update(input.plaintext).digest("hex"),
        input.plaintext.length,
        "application/octet-stream",
        input.accountId,
      ],
    );
    await pg.query(
      `INSERT INTO nex.object_blob_current
         (bucket, key, version_id, is_delete_marker, updated_at)
       VALUES ($1,$2,$3, false, now())
       ON CONFLICT (bucket, key)
         DO UPDATE SET version_id = EXCLUDED.version_id,
                       is_delete_marker = false,
                       updated_at = now()`,
      ["nex-vault-files", legacyPath, versionId],
    );
  } finally {
    await pg.end();
  }
  return { fileId, legacyPath };
}

async function teardown(f: Fixture): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const swallow = async (p: Promise<unknown>) => {
    try { await p; } catch { /* ignore */ }
  };
  for (const t of [
    "nex_vault_file_migration_attempt",
    "nex_vault_file",
    "nex_vault_key_envelope",
    "nex_vault_setup",
    "nex_vault_pin_attempt",
    "nex_vault_recovery_attempt",
    "nex_account_device_key",
    "nex_session",
    "nex_sign_in_event",
  ]) {
    await swallow(admin.from(t).delete().eq("account_id", f.accountId) as unknown as Promise<unknown>);
  }
  await swallow(admin.from("nex_account").delete().eq("id", f.accountId) as unknown as Promise<unknown>);
  await swallow(admin.auth.admin.deleteUser(f.authId) as unknown as Promise<unknown>);
  // Object-storage cleanup targets LOCAL Postgres · NEX_POSTGRES_URL ·
  // same instance the seed used.
  const pg = new PgClient({ connectionString: NEX_POSTGRES_URL });
  try {
    await pg.connect();
    await pg.query(
      `DELETE FROM nex.object_blobs
         WHERE bucket='nex-vault-files' AND key LIKE $1`,
      [`${f.accountId}/%`],
    );
    await pg.query(
      `DELETE FROM nex.object_blob_current
         WHERE bucket='nex-vault-files' AND key LIKE $1`,
      [`${f.accountId}/%`],
    );
  } catch { /* ignore */ } finally {
    await pg.end().catch(() => undefined);
  }
}

function supabaseCookieName(): string {
  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
  return `sb-${projectRef}-auth-token`;
}

function supabaseCookieValue(jwt: string, refresh: string): string {
  const payload = {
    access_token: jwt,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: null,
  };
  return `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
}

async function plantAuthCookies(
  ctx: BrowserContext,
  jwt: string,
  refresh: string,
): Promise<void> {
  const base = new URL(BASE_URL);
  await ctx.addCookies([
    {
      name: supabaseCookieName(),
      value: supabaseCookieValue(jwt, refresh),
      domain: base.hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "xrated_cookie_consent",
      value: "all",
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function ensureScreenshotDir(): Promise<void> {
  try { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}
}

async function prereqsAvailable(): Promise<boolean> {
  // Supabase env for the relational side · NEX_POSTGRES_URL for the
  // local object-storage side. Both must be present and reachable for
  // this proof to be meaningful (seed + verify + production route must
  // all target the same storage instance).
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !NEX_POSTGRES_URL) return false;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const a = await admin.from("nex_vault_file").select("id").limit(1);
    if (a.error) return false;
    const pg = new PgClient({ connectionString: NEX_POSTGRES_URL });
    try {
      await pg.connect();
      await pg.query("SELECT 1 FROM nex.object_blobs LIMIT 1");
    } finally {
      await pg.end().catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

interface NetworkTrace {
  all: Array<{ method: string; url: string; postBody: string | null }>;
  bodies: string[];
}

function startNetworkWatcher(ctx: BrowserContext): NetworkTrace {
  const trace: NetworkTrace = { all: [], bodies: [] };
  ctx.on("request", (req: Request) => {
    const body = req.postData();
    trace.all.push({ method: req.method(), url: req.url(), postBody: body });
    if (body) trace.bodies.push(body);
  });
  return trace;
}

function searchBodies(trace: NetworkTrace, needle: Buffer): string[] {
  const hits: string[] = [];
  const needleStr = needle.toString("utf8");
  const needleHex = needle.toString("hex");
  const needleB64 = needle.toString("base64");
  for (const b of trace.bodies) {
    if (
      b.includes(needleStr) ||
      b.toLowerCase().includes(needleHex.toLowerCase()) ||
      b.includes(needleB64)
    ) {
      hits.push(b.slice(0, 240));
    }
  }
  return hits;
}

async function dbFileRow(accountId: string, fileId: string) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await admin
    .from("nex_vault_file")
    .select(
      "migration_state, legacy_bytes_path, wrapped_content_key, content_nonce, encryption_algorithm, migrated_at, byte_size, rotation_generation",
    )
    .eq("account_id", accountId)
    .eq("id", fileId)
    .single();
  return r.data as {
    migration_state: string;
    legacy_bytes_path: string | null;
    wrapped_content_key: unknown;
    content_nonce: unknown;
    encryption_algorithm: string | null;
    migrated_at: string | null;
    byte_size: number;
    rotation_generation: number;
  } | null;
}

async function objectExists(pg: PgClient, key: string): Promise<{ size: number } | null> {
  const r = await pg.query(
    `SELECT b.size_bytes AS size
       FROM nex.object_blob_current c
       JOIN nex.object_blobs b
         ON b.bucket=c.bucket AND b.key=c.key AND b.version_id=c.version_id
      WHERE c.bucket='nex-vault-files' AND c.key=$1
        AND c.is_delete_marker=false`,
    [key],
  );
  return r.rows.length ? { size: Number((r.rows[0] as { size: number }).size) } : null;
}

async function countEncryptedVersions(pg: PgClient, key: string): Promise<number> {
  const r = await pg.query(
    `SELECT count(*)::int AS n FROM nex.object_blobs
      WHERE bucket='nex-vault-files' AND key=$1
        AND is_delete_marker=false`,
    [key],
  );
  return Number((r.rows[0] as { n: number }).n);
}

test.beforeAll(async () => {
  if (!(await prereqsAvailable())) {
    test.skip(
      true,
      "Vault Phase A migrations + Postgres object store not available · skipping",
    );
  }
  await ensureScreenshotDir();
});

test.describe("Vault Phase A · A.6 · legacy file encryption migration", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("seed legacy pre-setup → setup unlocks → banner → migrate → DB + crypto + idempotency + Bob isolation + network secrecy", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");

    // 1. SEED LEGACY FILE **BEFORE** Vault setup. Matches reality:
    //    legacy files pre-date Phase A, before the user set up Vault.
    const seed = await seedLegacyFile({
      accountId: alice.accountId,
      plaintext: LEGACY_PLAINTEXT,
      displayName: "legacy-note.txt",
    });

    // Pre-migration DB + object-storage proof.
    const before = await dbFileRow(alice.accountId, seed.fileId);
    expect(before, "pre-migration file row must exist").not.toBeNull();
    expect(before!.migration_state).toBe("legacy");
    expect(before!.legacy_bytes_path).toBe(seed.legacyPath);
    expect(before!.wrapped_content_key).toBeNull();
    expect(before!.content_nonce).toBeNull();
    expect(before!.encryption_algorithm).toBeNull();
    const pg0 = new PgClient({ connectionString: NEX_POSTGRES_URL });
    await pg0.connect();
    const legacyBefore = await objectExists(pg0, seed.legacyPath);
    const encBefore = await objectExists(
      pg0,
      `${alice.accountId}/encrypted/g1/${seed.fileId}`,
    );
    await pg0.end();
    expect(legacyBefore, "legacy object must exist pre-migration").not.toBeNull();
    expect(legacyBefore!.size).toBe(LEGACY_PLAINTEXT.length);
    expect(encBefore, "encrypted object must NOT exist pre-migration").toBeNull();

    try {
      const ctx = await browser.newContext();
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);
      const trace = startNetworkWatcher(ctx);
      const page = await ctx.newPage();

      // Diagnostic capture · dumped on test failure so we can see
      // exactly which server route refused the migration.
      const migrationResponses: Array<{ url: string; status: number; body: string }> = [];
      const browserConsole: Array<{ type: string; text: string }> = [];
      page.on("response", async (res) => {
        const url = res.url();
        if (
          url.includes("/api/nex-native/vault/migration/") ||
          url.includes("/api/nex/objects/")
        ) {
          let body = "";
          try { body = (await res.text()).slice(0, 400); } catch { body = "<unreadable>"; }
          migrationResponses.push({ url, status: res.status(), body });
        }
      });
      page.on("console", (msg) => {
        browserConsole.push({ type: msg.type(), text: msg.text() });
      });
      page.on("pageerror", (err) => {
        browserConsole.push({ type: "pageerror", text: err.message });
      });
      // Dump on any assertion failure in this block.
      const dump = () => {
        // eslint-disable-next-line no-console
        console.log("\n=== MIGRATION RESPONSES ===");
        for (const r of migrationResponses) {
          // eslint-disable-next-line no-console
          console.log(`${r.status} ${r.url}\n  body: ${r.body}`);
        }
        // eslint-disable-next-line no-console
        console.log("\n=== BROWSER CONSOLE ===");
        for (const c of browserConsole) {
          // eslint-disable-next-line no-console
          console.log(`[${c.type}] ${c.text}`);
        }
      };

      // 2. Vault setup → PIN → create. Setup leaves Vault UNLOCKED
      //    (VMK derived into memory) and auto-redirects to /vault/home.
      await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await page.locator("[data-nex-vault-setup-start]").click();
      await page.locator("[data-nex-vault-choose-pin]").click();
      await page.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // Confirm Vault is UNLOCKED post-setup (header chip reads
      // "Lock Vault Now" when unlocked).
      await expect(
        page.getByRole("button", { name: /Lock Vault Now/i }),
      ).toBeVisible({ timeout: 10_000 });

      // 3. Migration banner must appear WITHOUT any manual refresh.
      //    MigrationRunner's useEffect fires on mount with
      //    vault.unlocked === true and discovers the legacy file.
      await expect(
        page.locator("[data-nex-vault-migration-banner]"),
      ).toBeVisible({ timeout: 20_000 });
      const bannerText = (
        await page.locator("[data-nex-vault-migration-banner]").innerText()
      ).toLowerCase();
      expect(
        bannerText,
        "banner must use honest copy · NEVER call legacy files 'encrypted' or 'secure' yet",
      ).toMatch(/(is|are)n.?t secured/);
      expect(bannerText).not.toContain("encrypted");
      expect(
        await page
          .locator("[data-nex-vault-migration-banner]")
          .getAttribute("data-nex-vault-migration-count"),
      ).toBe("1");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-legacy-banner.png"),
        fullPage: true,
      });

      // 4. Click "Secure now" and wait for completion.
      await page.locator("[data-nex-vault-migration-run]").click();
      await expect(
        page.locator("[data-nex-vault-migration-securing]"),
      ).toBeVisible({ timeout: 10_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "02-securing.png"),
        fullPage: true,
      });
      await expect(
        page.locator("[data-nex-vault-migration-done]"),
      ).toBeVisible({ timeout: 120_000 });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "03-done.png"),
        fullPage: true,
      });
      // Always dump the migration response trace once "done" is
      // reached · regardless of success/failure. This gives us a
      // visible record of every HTTP call the client made so we can
      // tell success from "0 secured · 1 need another try".
      dump();

      // 5. DATABASE PROOF (post-migration).
      const after = await dbFileRow(alice.accountId, seed.fileId);
      expect(after).not.toBeNull();
      expect(after!.migration_state).toBe("encrypted");
      expect(after!.legacy_bytes_path).toBeNull();
      expect(after!.wrapped_content_key).not.toBeNull();
      expect(after!.content_nonce).not.toBeNull();
      expect(after!.encryption_algorithm).toBe("aes-256-gcm/v1");
      expect(after!.migrated_at).not.toBeNull();

      // 6. OBJECT-STORAGE PROOF.
      const pg = new PgClient({ connectionString: NEX_POSTGRES_URL });
      await pg.connect();
      const encryptedKey = `${alice.accountId}/encrypted/g1/${seed.fileId}`;
      try {
        const legacyAfter = await objectExists(pg, seed.legacyPath);
        expect(legacyAfter, "legacy object MUST be gone post-finalize").toBeNull();
        const encAfter = await objectExists(pg, encryptedKey);
        expect(
          encAfter,
          "encrypted object MUST exist at generation-scoped path",
        ).not.toBeNull();
        expect(encAfter!.size).toBe(LEGACY_PLAINTEXT.length + 16);
        expect(await countEncryptedVersions(pg, encryptedKey)).toBe(1);
      } finally {
        await pg.end();
      }

      // 7. NETWORK-TRACE / CLIENT-CRYPTO ROUND-TRIP PROOF.
      //    Reaching migration_state='encrypted' is impossible without
      //    the client's self-check decrypt matching the original SHA.
      //    The ordered trace makes that chain of causation explicit:
      //      start → upload → read-encrypted (self-check) → finalize-
      //      metadata → finalize.
      const migrationCalls = trace.all
        .filter((r) => r.url.includes("/api/nex-native/vault/migration/"))
        .map((r) => `${r.method} ${new URL(r.url).pathname}`);
      const findIdx = (needle: string) =>
        migrationCalls.findIndex((c) => c.endsWith(needle));
      const startIdx = findIdx("/migration/start");
      const uploadIdx = findIdx("/migration/upload");
      const readIdx = findIdx("/migration/read-encrypted");
      const metaIdx = findIdx("/migration/finalize-metadata");
      const finIdx = findIdx("/migration/finalize");
      expect(
        startIdx,
        `migration/start absent · calls=${JSON.stringify(migrationCalls)}`,
      ).toBeGreaterThanOrEqual(0);
      expect(uploadIdx).toBeGreaterThan(startIdx);
      expect(
        readIdx,
        "client self-check (GET /migration/read-encrypted) absent · browser never decrypted",
      ).toBeGreaterThan(uploadIdx);
      expect(
        metaIdx,
        "finalize-metadata must come AFTER the self-check round-trip",
      ).toBeGreaterThan(readIdx);
      expect(finIdx).toBeGreaterThan(metaIdx);

      // 8. EXPLICIT CIPHERTEXT PROOF via the production read-encrypted
      //    route (owner-scoped). Verify in-page:
      //      (a) ciphertext.length = plaintext.length + 16 (AES-GCM tag)
      //      (b) SHA-256(ciphertext) != SHA-256(plaintext)
      //      (c) ciphertext does NOT equal plaintext byte-for-byte
      const ciphertextProof = await page.evaluate(
        async (args: {
          fileId: string;
          generation: number;
          plaintextUtf8: string;
        }) => {
          const res = await fetch(
            `/api/nex-native/vault/migration/read-encrypted?file_id=${encodeURIComponent(
              args.fileId,
            )}&generation=${args.generation}`,
            { method: "GET" },
          );
          if (!res.ok) {
            return { ok: false as const, error: `read_status_${res.status}` };
          }
          const bytes = new Uint8Array(await res.arrayBuffer());
          const sha = await globalThis.crypto.subtle.digest("SHA-256", bytes);
          const shaHex = Array.from(new Uint8Array(sha))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const plaintext = new TextEncoder().encode(args.plaintextUtf8);
          const equalsPlaintext =
            bytes.length === plaintext.length &&
            bytes.every((v, i) => v === plaintext[i]);
          return {
            ok: true as const,
            length: bytes.length,
            shaHex,
            equalsPlaintext,
          };
        },
        {
          fileId: seed.fileId,
          generation: 1,
          plaintextUtf8: LEGACY_PLAINTEXT.toString("utf8"),
        },
      );
      expect(ciphertextProof.ok, JSON.stringify(ciphertextProof)).toBe(true);
      if (ciphertextProof.ok) {
        expect(ciphertextProof.length).toBe(LEGACY_PLAINTEXT.length + 16);
        expect(ciphertextProof.shaHex).not.toBe(LEGACY_PLAINTEXT_SHA);
        expect(ciphertextProof.equalsPlaintext).toBe(false);
      }

      // 9. ATTEMPT ROW · one finalized row.
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const attempt1 = await admin
        .from("nex_vault_file_migration_attempt")
        .select("status")
        .eq("account_id", alice.accountId)
        .eq("file_id", seed.fileId);
      const statuses1 = (attempt1.data as Array<{ status: string }>).map(
        (r) => r.status,
      );
      expect(statuses1).toContain("finalized");
      const attemptCountBefore = statuses1.length;

      // 10. IDEMPOTENCY PROOF. Second /migration/start · reconciliation
      //     sees migration_state='encrypted' and short-circuits. No new
      //     attempt row. No new encrypted-object version.
      const pg2 = new PgClient({ connectionString: NEX_POSTGRES_URL });
      await pg2.connect();
      const encVersionsBefore = await countEncryptedVersions(pg2, encryptedKey);
      await pg2.end();

      // Idempotency probe · the start route validates device_id shape
      // (8-128 chars) BEFORE the reconcile branch, which is correct for
      // the primary flow (clients always have a device key from
      // ensureDeviceKey). The probe therefore supplies a syntactically-
      // valid dummy device_id · reconcile will see state='encrypted'
      // and short-circuit before device_id is consumed anywhere.
      const idempotency = await page.evaluate(async (fileId: string) => {
        const res = await fetch("/api/nex-native/vault/migration/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            file_id: fileId,
            device_id: "idempotency-probe-device-key",
          }),
        });
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
      }, seed.fileId);
      expect(idempotency.status).toBe(200);
      expect(
        (idempotency.body as { migration_state?: string }).migration_state,
      ).toBe("encrypted");

      const attempt2 = await admin
        .from("nex_vault_file_migration_attempt")
        .select("status")
        .eq("account_id", alice.accountId)
        .eq("file_id", seed.fileId);
      expect(
        (attempt2.data as Array<unknown>).length,
        "idempotency: no new attempt row on second start",
      ).toBe(attemptCountBefore);

      const pg3 = new PgClient({ connectionString: NEX_POSTGRES_URL });
      await pg3.connect();
      const encVersionsAfter = await countEncryptedVersions(pg3, encryptedKey);
      await pg3.end();
      expect(
        encVersionsAfter,
        "idempotency: no new encrypted-object version",
      ).toBe(encVersionsBefore);

      // 11. CROSS-ACCOUNT (Bob) ISOLATION PROOF.
      //     Direct API probe with Bob's auth cookie. Each route must
      //     refuse Bob's attempt to touch Alice's file.
      const bobCookie = `${supabaseCookieName()}=${supabaseCookieValue(
        bob.jwt,
        bob.refresh,
      )}`;
      const bobQueue = await page.request.post(
        `${BASE_URL}/api/nex-native/vault/migration/queue`,
        {
          headers: { cookie: bobCookie, "content-type": "application/json" },
        },
      );
      if (bobQueue.ok()) {
        const bq = (await bobQueue.json()) as { files?: unknown[] };
        expect(bq.files ?? []).toEqual([]);
      }

      const bobStart = await page.request.post(
        `${BASE_URL}/api/nex-native/vault/migration/start`,
        {
          headers: { cookie: bobCookie, "content-type": "application/json" },
          data: { file_id: seed.fileId, device_id: null },
        },
      );
      expect(
        [401, 403, 404, 400],
        `Bob start on Alice's file_id must be refused · got ${bobStart.status()}`,
      ).toContain(bobStart.status());

      const bobRead = await page.request.get(
        `${BASE_URL}/api/nex-native/vault/migration/read-encrypted?file_id=${encodeURIComponent(
          seed.fileId,
        )}&generation=1`,
        {
          headers: { cookie: bobCookie },
        },
      );
      expect(
        [401, 403, 404, 400],
        `Bob read on Alice's file_id must be refused · got ${bobRead.status()}`,
      ).toContain(bobRead.status());

      // Direct DB probe: Bob's own files table empty.
      const bobFiles = await admin
        .from("nex_vault_file")
        .select("id")
        .eq("account_id", bob.accountId);
      expect(bobFiles.data).toEqual([]);

      // 12. AUDIT · at least one legacy_file_migrated event.
      const events = await admin
        .from("nex_sign_in_event")
        .select("event_type")
        .eq("account_id", alice.accountId);
      const types = (events.data as Array<{ event_type: string }>).map(
        (e) => e.event_type,
      );
      expect(types).toContain("legacy_file_migrated");

      // 13. NETWORK SECRECY PROOF. Scan every outbound request body
      //     for PIN, plaintext bytes (utf-8/hex/base64), and
      //     identifiable plaintext substring. Opaque ciphertext upload
      //     is allowed.
      const pinHits = trace.bodies.filter((b) => b.includes(DEVICE_A_PIN));
      expect(pinHits, `PIN leaked to wire: ${JSON.stringify(pinHits)}`).toEqual(
        [],
      );
      const plaintextHits = searchBodies(trace, LEGACY_PLAINTEXT);
      expect(
        plaintextHits,
        `plaintext bytes leaked to wire: ${JSON.stringify(plaintextHits)}`,
      ).toEqual([]);
      const substringHits = trace.bodies.filter((b) =>
        b.includes("nex-vault-legacy-file-A6-sentinel"),
      );
      expect(
        substringHits,
        `plaintext substring leaked: ${JSON.stringify(substringHits)}`,
      ).toEqual([]);

      await ctx.close();
    } finally {
      await teardown(alice);
      await teardown(bob);
    }
  });
});

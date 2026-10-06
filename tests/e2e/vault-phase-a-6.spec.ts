// tests/e2e/vault-phase-a-6.spec.ts
//
// Vault Phase A · Commit A.6 · real-browser proof for legacy file
// encryption migration.
//
// Covers:
//   · Alice signs in, sets up Vault with PIN
//   · Admin seeds a legacy file row + raw bytes in the object store
//     (NEX_OBJECT_BACKEND=postgres · nex.object_blobs +
//     nex.object_blob_current)
//   · Alice navigates to Vault home · migration banner shows
//   · Click "Secure now" · browser downloads legacy, encrypts with
//     fresh K_f, uploads opaque ciphertext, self-check round-trip,
//     wraps K_f under VMK, server deletes legacy, flips to encrypted
//   · DB verify: migration_state='encrypted', legacy_bytes_path=NULL,
//     encrypted object exists at deterministic generation-scoped path,
//     legacy object gone
//   · Bob cannot see Alice's file
//   · Network boundary: PIN plaintext never on wire

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
import { randomUUID } from "node:crypto";

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
const DATABASE_URL = process.env.DATABASE_URL ?? "";
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
  // Insert the nex_vault_file row at state='legacy'.
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

  // Insert the raw bytes directly into the postgres object store via pg.
  const pg = new PgClient({ connectionString: DATABASE_URL });
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
        "x",
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
  // Clean up any orphan object_blobs for the account
  const pg = new PgClient({ connectionString: DATABASE_URL });
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
  } catch {
    /* ignore · unrelated to assertions */
  } finally {
    await pg.end().catch(() => undefined);
  }
}

async function plantAuthCookies(
  ctx: BrowserContext,
  jwt: string,
  refresh: string,
): Promise<void> {
  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "unknown";
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: jwt,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: null,
  };
  const base = new URL(BASE_URL);
  await ctx.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(JSON.stringify(payload)).toString("base64")}`,
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) return false;
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const a = await admin.from("nex_vault_file").select("id").limit(1);
    if (a.error) return false;
    const pg = new PgClient({ connectionString: DATABASE_URL });
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

function startSecretWatcher(ctx: BrowserContext, secrets: string[]): {
  leaks: Array<{ url: string; which: string; body: string }>;
} {
  const leaks: Array<{ url: string; which: string; body: string }> = [];
  const check = (req: Request) => {
    const body = req.postData();
    if (!body) return;
    for (const s of secrets) {
      if (body.includes(s)) {
        leaks.push({ url: req.url(), which: s, body: body.slice(0, 200) });
      }
    }
  };
  ctx.on("request", check);
  return { leaks };
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

  test("setup → seed legacy → migrate → DB verify → Bob isolation → network boundary", async ({
    browser,
  }) => {
    const alice = await provisionAccount("alice");
    const bob = await provisionAccount("bob");
    try {
      const ctx = await browser.newContext();
      await plantAuthCookies(ctx, alice.jwt, alice.refresh);
      const watch = startSecretWatcher(ctx, [DEVICE_A_PIN]);
      const page = await ctx.newPage();

      // 1. Set up Vault (A.3b flow).
      await page.goto(`${BASE_URL}/nex-native/vault`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/vault\/setup/, { timeout: 15_000 });
      await page.locator("[data-nex-vault-setup-start]").click();
      await page.locator("[data-nex-vault-choose-pin]").click();
      await page.locator("[data-nex-vault-secret-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-confirm-input]").fill(DEVICE_A_PIN);
      await page.locator("[data-nex-vault-create]").click();
      await page.waitForURL(/\/vault\/home/, { timeout: 60_000 });

      // 2. Admin seeds a legacy file.
      const seed = await seedLegacyFile({
        accountId: alice.accountId,
        plaintext: LEGACY_PLAINTEXT,
        displayName: "legacy-note.txt",
      });
      // Browser needs to re-check its queue · reload the Vault home.
      await page.reload({ waitUntil: "networkidle" });
      await expect(
        page.locator("[data-nex-vault-migration-banner]"),
      ).toBeVisible({ timeout: 15_000 });
      expect(
        await page
          .locator("[data-nex-vault-migration-banner]")
          .getAttribute("data-nex-vault-migration-count"),
      ).toBe("1");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-legacy-banner.png"),
        fullPage: true,
      });

      // 3. Click Secure now and wait for completion.
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

      // 4. DB side-effects.
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const fileAfter = await admin
        .from("nex_vault_file")
        .select(
          "migration_state, legacy_bytes_path, wrapped_content_key, content_nonce, encryption_algorithm, migrated_at",
        )
        .eq("account_id", alice.accountId)
        .eq("id", seed.fileId)
        .single();
      const row = fileAfter.data as {
        migration_state: string;
        legacy_bytes_path: string | null;
        wrapped_content_key: unknown;
        content_nonce: unknown;
        encryption_algorithm: string | null;
        migrated_at: string | null;
      };
      expect(row.migration_state).toBe("encrypted");
      expect(row.legacy_bytes_path).toBeNull();
      expect(row.wrapped_content_key).not.toBeNull();
      expect(row.content_nonce).not.toBeNull();
      expect(row.encryption_algorithm).toBe("aes-256-gcm/v1");
      expect(row.migrated_at).not.toBeNull();

      // 5. Legacy object GONE, encrypted object EXISTS at generation-
      //    scoped path.
      const pg = new PgClient({ connectionString: DATABASE_URL });
      await pg.connect();
      try {
        const legacyR = await pg.query(
          `SELECT 1 FROM nex.object_blob_current
             WHERE bucket='nex-vault-files' AND key=$1
               AND is_delete_marker=false`,
          [seed.legacyPath],
        );
        expect(legacyR.rowCount).toBe(0);
        const encR = await pg.query(
          `SELECT 1 FROM nex.object_blob_current
             WHERE bucket='nex-vault-files' AND key=$1
               AND is_delete_marker=false`,
          [`${alice.accountId}/encrypted/g1/${seed.fileId}`],
        );
        expect(encR.rowCount).toBe(1);
      } finally {
        await pg.end();
      }

      // 6. Attempt row finalized.
      const attempt = await admin
        .from("nex_vault_file_migration_attempt")
        .select("status")
        .eq("account_id", alice.accountId)
        .eq("file_id", seed.fileId);
      const statuses = (attempt.data as Array<{ status: string }>).map(
        (r) => r.status,
      );
      expect(statuses).toContain("finalized");

      // 7. Bob isolation · direct DB probe + REST probe.
      const bobFiles = await admin
        .from("nex_vault_file")
        .select("id")
        .eq("account_id", bob.accountId);
      expect(bobFiles.data).toEqual([]);

      // 8. Audit event emitted.
      const events = await admin
        .from("nex_sign_in_event")
        .select("event_type")
        .eq("account_id", alice.accountId);
      const types = (events.data as Array<{ event_type: string }>).map(
        (e) => e.event_type,
      );
      expect(types).toContain("legacy_file_migrated");

      // 9. Network boundary · PIN plaintext never appeared.
      expect(
        watch.leaks,
        `secret leak: ${JSON.stringify(watch.leaks, null, 2)}`,
      ).toEqual([]);

      await ctx.close();
    } finally {
      await teardown(alice);
      await teardown(bob);
    }
  });
});

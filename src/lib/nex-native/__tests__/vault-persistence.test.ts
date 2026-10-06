// src/lib/nex-native/__tests__/vault-persistence.test.ts
//
// Phase A.1 Vault Persistence · deterministic regression suite.
// Sealed 2026-10-06.
//
// Source-grep + pure-function assertions that lock in the sealed
// architectural invariants:
//
//   · migration 140 modifies Bridge 78 with the specific vault-aware
//     exemption predicate · never a global disable
//   · vault-file-service goes through the NEX object-storage abstraction
//   · vault-persistence-service never decrypts, never introduces
//     plaintext storage, never bypasses E2E
//   · moveConversationToVault / removeConversationFromVault call the
//     attachment copy / cleanup helpers
//   · 2FA-style "paid = true" / client-trusted flags never land in the
//     service layer
//
// Does NOT execute Supabase queries · the integration script
// scripts/_verify-phase-a1.mjs covers the end-to-end live run.

import { describe, test, expect, beforeAll, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Stub supabase-admin so the dynamic import of vault-persistence-service
// inside the SSRF section doesn't bootstrap the real client (which
// requires NEX_SUPABASE_SERVICE_ROLE_KEY at module load). Only the pure
// URL guard is exercised; the Supabase surface is untouched by the
// grep assertions elsewhere in this file.
vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("supabase-admin unused in these tests");
      },
    },
  ),
}));
// vault-file-service imports the object-registry · stub that too so
// the dynamic chain stays side-effect-free in test environment.
vi.mock("@/lib/nex/storage/object-registry", () => ({
  getObjectStorage: () => {
    throw new Error("getObjectStorage unused in these tests");
  },
}));

const REPO = path.resolve(__dirname, "../../../..");
const MIGRATION_140 = path.join(
  REPO,
  "nex-supabase/migrations/140_nex_vault_persistence.sql",
);
const VAULT_FILE_SERVICE = path.join(
  REPO,
  "src/lib/nex-native/vault-file-service.ts",
);
const VAULT_PERSISTENCE_SERVICE = path.join(
  REPO,
  "src/lib/nex-native/vault-persistence-service.ts",
);
const VAULT_ENTRY_SERVICE = path.join(
  REPO,
  "src/lib/nex-native/vault-entry-service.ts",
);
const VAULT_SETTINGS_PAGE = path.join(
  REPO,
  "src/app/nex-native/vault/settings/page.tsx",
);

const migration140 = fs.readFileSync(MIGRATION_140, "utf-8");
const vaultFileService = fs.readFileSync(VAULT_FILE_SERVICE, "utf-8");
const vaultPersistence = fs.readFileSync(VAULT_PERSISTENCE_SERVICE, "utf-8");
const vaultEntryService = fs.readFileSync(VAULT_ENTRY_SERVICE, "utf-8");
const vaultSettings = fs.readFileSync(VAULT_SETTINGS_PAGE, "utf-8");

// ─── A · Migration 140 shape ────────────────────────────────────────

describe("A · migration 140 · schema + Bridge 78 vault-aware purge", () => {
  test("adds source_message_id and source_conversation_id to nex_vault_file", () => {
    expect(migration140).toContain("ADD COLUMN IF NOT EXISTS source_message_id uuid");
    expect(migration140).toContain(
      "ADD COLUMN IF NOT EXISTS source_conversation_id uuid",
    );
  });

  test("creates partial unique index for idempotency", () => {
    expect(migration140).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS nex_vault_file_source_message_unique[\s\S]+WHERE source_message_id IS NOT NULL/,
    );
  });

  test("replaces the Bridge 78 purge function with vault-aware version", () => {
    expect(migration140).toContain(
      "CREATE OR REPLACE FUNCTION nex_purge_delivered_encrypted_messages",
    );
    expect(migration140).toContain("DELETE FROM nex_peer_message pm");
    expect(migration140).toContain("encrypted = true");
    expect(migration140).toContain("delivered_at IS NOT NULL");
  });

  test("exempts conversation-vault rows via recipient_device_id ownership", () => {
    // The direct conversation-vault predicate.
    expect(migration140).toMatch(
      /AND NOT EXISTS \(\s*SELECT 1\s+FROM nex_vault_entry ve\s+JOIN nex_account_device_key adk\s+ON adk\.account_id = ve\.account_id\s+AND adk\.device_id = pm\.recipient_device_id\s+WHERE ve\.entry_kind = 'conversation'\s+AND ve\.ref_id = pm\.conversation_id/,
    );
  });

  test("exempts friend-vault rows via the correct participant symmetry", () => {
    // Must check BOTH participant orderings · never only one · so Alice
    // vaulting Bob preserves rows in either sender/recipient layout.
    expect(migration140).toContain("ve.entry_kind = 'friend'");
    expect(migration140).toContain(
      "ve.ref_id = pc.participant_a_id AND ve.account_id = pc.participant_b_id",
    );
    expect(migration140).toContain(
      "ve.ref_id = pc.participant_b_id AND ve.account_id = pc.participant_a_id",
    );
  });

  test("does NOT globally disable Bridge 78", () => {
    // The purge must still DELETE · it just has additional NOT EXISTS
    // guards. If a future edit collapses the WHERE into a tautology,
    // this test flags it.
    expect(migration140).toContain("DELETE FROM nex_peer_message pm");
    expect(migration140).not.toContain("WHERE false");
    expect(migration140).not.toContain("WHERE 1=0");
  });

  test("ledger row 140 recorded", () => {
    expect(migration140).toMatch(
      /INSERT INTO nex_migration_history[\s\S]+VALUES\s*\(\s*'140'/,
    );
  });
});

// ─── B · vault-file-service uses NEX object storage ─────────────────

describe("B · vault-file-service goes through the NEX object-storage abstraction", () => {
  test("imports getObjectStorage from the sealed registry", () => {
    expect(vaultFileService).toContain(
      'import { getObjectStorage } from "@/lib/nex/storage/object-registry"',
    );
  });

  test("deleteVaultFile uses storage.delete, not nexSupabaseAdmin.storage", () => {
    // Allow the import of nexSupabaseAdmin for metadata rows · just
    // ensure the OBJECT bytes go through the abstraction.
    const deleteSection = extractFunction(vaultFileService, "deleteVaultFile");
    expect(deleteSection).toContain("getObjectStorage()");
    expect(deleteSection).toContain("storage.delete");
    expect(deleteSection).not.toContain("nexSupabaseAdmin.storage");
  });

  test("uploadVaultFileBytes uses storage.put", () => {
    const uploadSection = extractFunction(
      vaultFileService,
      "uploadVaultFileBytes",
    );
    expect(uploadSection).toContain("getObjectStorage()");
    expect(uploadSection).toContain("storage.put");
    expect(uploadSection).not.toContain("nexSupabaseAdmin.storage");
  });

  test("createSignedDownloadUrl uses storage.presign", () => {
    const section = extractFunction(vaultFileService, "createSignedDownloadUrl");
    expect(section).toContain("getObjectStorage()");
    expect(section).toContain("storage.presign");
    expect(section).not.toContain("nexSupabaseAdmin.storage");
  });

  test("insertVaultFileMetadata persists source_message_id + source_conversation_id when provided", () => {
    const section = extractFunction(vaultFileService, "insertVaultFileMetadata");
    expect(section).toContain("source_message_id: input.sourceMessageId");
    expect(section).toContain(
      "source_conversation_id: input.sourceConversationId",
    );
  });

  test("exports getVaultBytesUsedForAccount for byte accounting", () => {
    expect(vaultFileService).toContain(
      "export async function getVaultBytesUsedForAccount",
    );
    expect(vaultFileService).toContain('.from("nex_vault_file")');
    expect(vaultFileService).toContain('.eq("account_id", accountId)');
  });

  test("exports idempotency helpers used by the persistence service", () => {
    expect(vaultFileService).toContain(
      "export async function findVaultFileBySourceMessage",
    );
    expect(vaultFileService).toContain(
      "export async function listVaultFilesForSourceConversation",
    );
  });
});

// ─── C · vault-persistence-service · security + idempotency contract ─

describe("C · vault-persistence-service · the attachment-copy flow", () => {
  test("declares server-only · never ships client-side", () => {
    expect(vaultPersistence).toContain('import "server-only"');
  });

  test("does NOT decrypt chat ciphertext anywhere · code (not comments)", () => {
    const codeOnly = stripComments(vaultPersistence);
    expect(codeOnly).not.toMatch(/\bdecrypt\s*\(/);
    expect(codeOnly).not.toMatch(/box\.open|nacl\.box|secretbox/);
  });

  test("does NOT read nex_peer_message.ciphertext (which the server cannot decrypt)", () => {
    const selectMatch = vaultPersistence.match(
      /\.from\("nex_peer_message"\)\s*\.select\(([^)]+)\)/,
    );
    expect(selectMatch).not.toBeNull();
    // The columns we SELECT must not include ciphertext, nonce, or
    // sender_public_key · we only touch metadata needed to identify
    // the attachment file.
    const columns = selectMatch?.[1] ?? "";
    expect(columns).not.toContain("ciphertext");
    expect(columns).not.toContain("nonce");
    expect(columns).not.toContain("sender_public_key");
  });

  test("checks idempotency via findVaultFileBySourceMessage before copying", () => {
    const section = extractFunction(
      vaultPersistence,
      "copyConversationAttachmentsToVault",
    );
    expect(section).toContain("findVaultFileBySourceMessage");
    expect(section).toMatch(/if \(existing\)\s*\{\s*result\.attachments_skipped/);
  });

  test("insert metadata BEFORE upload · rolls back on upload failure", () => {
    const section = stripComments(
      extractFunction(vaultPersistence, "copyConversationAttachmentsToVault"),
    );
    // The code-level order (ignoring comments) is:
    //   insertVaultFileMetadata → uploadVaultFileBytes → catch { deleteVaultFile }
    const insertIdx = section.indexOf("insertVaultFileMetadata");
    const uploadIdx = section.indexOf("uploadVaultFileBytes");
    const deleteIdx = section.indexOf("deleteVaultFile");
    expect(insertIdx).toBeGreaterThan(-1);
    expect(uploadIdx).toBeGreaterThan(insertIdx);
    expect(deleteIdx).toBeGreaterThan(uploadIdx);
  });

  test("does NOT delete the original chat attachment anywhere", () => {
    expect(vaultPersistence).not.toMatch(
      /nex[-_]peer[-_]chat[-_]attachments[\s\S]{0,200}delete/i,
    );
    expect(vaultPersistence).not.toMatch(
      /delete[\s\S]{0,200}nex[-_]peer[-_]chat[-_]attachments/i,
    );
    expect(vaultPersistence).not.toMatch(
      /nex_peer_message[\s\S]{0,200}\.delete\(\)/,
    );
  });

  test("category mapping is stable: image→photos, video→videos, audio→important", () => {
    const section = extractFunction(vaultPersistence, "categoryFor");
    expect(section).toContain('return "photos"');
    expect(section).toContain('return "videos"');
    expect(section).toContain('return "important"');
  });

  test("exports removeConversationAttachmentsFromVault for cascade cleanup", () => {
    expect(vaultPersistence).toContain(
      "export async function removeConversationAttachmentsFromVault",
    );
  });

  test("cleanup iterates listVaultFilesForSourceConversation and calls deleteVaultFile", () => {
    const section = extractFunction(
      vaultPersistence,
      "removeConversationAttachmentsFromVault",
    );
    expect(section).toContain("listVaultFilesForSourceConversation");
    expect(section).toContain("deleteVaultFile");
  });
});

// ─── D · vault-entry-service wires the persistence helpers ──────────

describe("D · vault-entry-service calls persistence on move + remove", () => {
  test("imports copyConversationAttachmentsToVault + removeConversationAttachmentsFromVault", () => {
    expect(vaultEntryService).toContain("copyConversationAttachmentsToVault");
    expect(vaultEntryService).toContain(
      "removeConversationAttachmentsFromVault",
    );
  });

  test("moveConversationToVault invokes the copy AFTER the entry row is upserted", () => {
    const section = extractFunction(
      vaultEntryService,
      "moveConversationToVault",
    );
    const upsertIdx = section.indexOf('.from("nex_vault_entry")');
    const copyIdx = section.indexOf("copyConversationAttachmentsToVault");
    expect(upsertIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeGreaterThan(upsertIdx);
  });

  test("removeConversationFromVault invokes the cleanup AFTER deleting the entry row", () => {
    const section = extractFunction(
      vaultEntryService,
      "removeConversationFromVault",
    );
    const deleteIdx = section.indexOf('.from("nex_vault_entry")');
    const cleanupIdx = section.indexOf("removeConversationAttachmentsFromVault");
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(cleanupIdx).toBeGreaterThan(deleteIdx);
  });

  test("moveConversationToVault still asserts viewer-is-participant", () => {
    const section = extractFunction(
      vaultEntryService,
      "moveConversationToVault",
    );
    expect(section).toContain("isPeerConversationParticipant");
    expect(section).toMatch(/if \(!isParticipant\)/);
  });
});

// ─── E · honest-limits disclaimer sealed ────────────────────────────

describe("E · vault/settings honest-limits disclaimer (updated for A.3b)", () => {
  test("disclaimer tells the user the Vault key is created on their device", () => {
    expect(vaultSettings).toContain("Vault key is created on your device");
  });

  test("disclaimer asserts NEX cannot read the key / unlock Vault", () => {
    // JSX source line-wraps between whitespace; collapse before match.
    const collapsed = vaultSettings.replace(/\s+/g, " ");
    expect(collapsed).toContain("NEX cannot read your Vault key");
  });

  test("disclaimer carries the cross-device / phase boundary note", () => {
    const collapsed = vaultSettings.replace(/\s+/g, " ");
    expect(collapsed).toContain(
      "Cross-device authorisation and recovery arrive with the next sealed phases",
    );
    expect(collapsed).toContain("phase boundary, not a regression");
  });

  test("disclaimer documents password-reset auto-lock (design §G.1)", () => {
    expect(vaultSettings).toContain("Password reset or account recovery");
    expect(vaultSettings).toContain("automatically locks Vault");
    expect(vaultSettings).toContain(
      "Your Vault content is preserved",
    );
  });

  test("disclaimer no longer calls PIN a prototype (A.3b ships real PIN)", () => {
    expect(vaultSettings).not.toContain("prototype");
  });
});

// ─── E2 · SSRF trust-boundary · attachment URL hardening ───────────

describe("E2 · isTrustedChatAttachmentUrl · SSRF guard rejects attacker URLs", () => {
  // Set the trusted host before importing + evaluating the guard. The
  // guard reads NEXT_PUBLIC_NEX_SUPABASE_URL at call time so this stub
  // works without re-import gymnastics.
  const PROJECT_HOST = "ijvqdvsvwtwxzcqmoqit.supabase.co";
  const SEALED_PREFIX = "/storage/v1/object/public/nex-peer-chat-attachments/";
  const TRUSTED = `https://${PROJECT_HOST}${SEALED_PREFIX}sender-id/1234567890-abc.jpg`;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = `https://${PROJECT_HOST}`;
  });

  // Lazy-import so the env-tweak above is visible to the guard.
  async function guard(url: string): Promise<boolean> {
    const mod = await import("../vault-persistence-service");
    return mod.isTrustedChatAttachmentUrl(url);
  }

  test("accepts a well-formed chat-attachment URL on the sealed host + prefix", async () => {
    expect(await guard(TRUSTED)).toBe(true);
  });

  test("rejects http:// (plaintext)", async () => {
    expect(
      await guard(TRUSTED.replace("https://", "http://")),
    ).toBe(false);
  });

  test("rejects file:// (local file read)", async () => {
    expect(await guard("file:///etc/passwd")).toBe(false);
  });

  test("rejects data: URIs (XSS/data-exfil)", async () => {
    expect(await guard("data:text/plain,hello")).toBe(false);
  });

  test("rejects javascript: URIs", async () => {
    expect(await guard("javascript:alert(1)")).toBe(false);
  });

  test("rejects AWS/GCP metadata endpoint 169.254.169.254", async () => {
    expect(await guard("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(await guard("https://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  test("rejects localhost / loopback", async () => {
    expect(await guard("https://localhost/anything")).toBe(false);
    expect(await guard("https://127.0.0.1/anything")).toBe(false);
    expect(await guard("https://[::1]/anything")).toBe(false);
  });

  test("rejects private RFC1918 ranges", async () => {
    expect(await guard("https://10.0.0.1/x")).toBe(false);
    expect(await guard("https://192.168.1.1/x")).toBe(false);
    expect(await guard("https://172.16.0.1/x")).toBe(false);
  });

  test("rejects alternate hosts (even same TLD · phishing lookalike)", async () => {
    // ijvqdvsvwtwxzcqmoqit (correct) vs iivqdvsvwtwxzcqmoqit (typo attack)
    expect(
      await guard(
        `https://iivqdvsvwtwxzcqmoqit.supabase.co${SEALED_PREFIX}evil.jpg`,
      ),
    ).toBe(false);
    expect(
      await guard(`https://evil.com${SEALED_PREFIX}evil.jpg`),
    ).toBe(false);
    // Attacker's domain + sealed project host as path · classic bypass attempt.
    expect(
      await guard(
        `https://evil.com/${PROJECT_HOST}${SEALED_PREFIX}evil.jpg`,
      ),
    ).toBe(false);
  });

  test("rejects URLs with embedded credentials (user:pass@host)", async () => {
    expect(
      await guard(
        `https://attacker:pwd@${PROJECT_HOST}${SEALED_PREFIX}f.jpg`,
      ),
    ).toBe(false);
  });

  test("rejects alternate ports (even on the sealed host)", async () => {
    expect(
      await guard(`https://${PROJECT_HOST}:4443${SEALED_PREFIX}f.jpg`),
    ).toBe(false);
  });

  test("rejects same-host pivot to a different bucket", async () => {
    expect(
      await guard(
        `https://${PROJECT_HOST}/storage/v1/object/public/nex-vault-files/other/path.jpg`,
      ),
    ).toBe(false);
    expect(
      await guard(
        `https://${PROJECT_HOST}/storage/v1/object/public/some-other-bucket/f.jpg`,
      ),
    ).toBe(false);
    expect(
      await guard(
        `https://${PROJECT_HOST}/storage/v1/object/sign/nex-peer-chat-attachments/f.jpg`,
      ),
    ).toBe(false);
  });

  test("rejects garbage, empty, and non-URL inputs", async () => {
    expect(await guard("")).toBe(false);
    expect(await guard("not a url")).toBe(false);
    expect(await guard("//missing-scheme/path")).toBe(false);
  });

  test("fail-closed when NEXT_PUBLIC_NEX_SUPABASE_URL is unset", async () => {
    const prev = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
    const prev2 = process.env.NEX_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
    delete process.env.NEX_SUPABASE_URL;
    try {
      expect(await guard(TRUSTED)).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = prev;
      if (prev2) process.env.NEX_SUPABASE_URL = prev2;
    }
  });

  test("fetchAttachmentBytes uses redirect: 'error' (defeats cross-origin 302)", () => {
    // Source-level invariant · the fetch call MUST pass redirect:"error"
    // so a Supabase gateway 302 to an attacker domain cannot complete.
    expect(vaultPersistence).toMatch(/fetch\(url,\s*\{\s*redirect:\s*"error"/);
  });
});

// ─── F · load-bearing anti-patterns ─────────────────────────────────

describe("F · nothing bypasses server-side ownership", () => {
  const files = [vaultFileService, vaultPersistence, vaultEntryService];

  for (const [i, src] of files.entries()) {
    test(`file[${i}] does not accept a client-trusted "vaulted" or "paid" flag`, () => {
      expect(src).not.toMatch(/\bvaulted\s*[:=]\s*true\b/);
      expect(src).not.toMatch(/paid\s*[:=]\s*true/);
      expect(src).not.toMatch(/client[-_]?entitled/);
    });

    test(`file[${i}] does not accept a body.account_id or body.accountId`, () => {
      expect(src).not.toMatch(/body\.account_id/);
      expect(src).not.toMatch(/body\.accountId/);
    });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────

// Strip single-line and block comments. Enough for the test-grep
// assertions · we don't need a full TS lexer here.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Extract the source of a function by name · bounded by the next
 *  top-level declaration (export / const / type / interface / function)
 *  or EOF. Robust against type annotations that contain inline object
 *  braces, because we do not try to brace-match the body; we span
 *  from the function header to the next top-level declaration. Good
 *  enough for grep-shaped tests. */
function extractFunction(src: string, name: string): string {
  const header = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`,
  );
  const start = src.search(header);
  if (start === -1) return "";
  const tailSrc = src.slice(start + 1);
  const nextDecl = tailSrc.search(
    /\n(?:export\s+)?(?:async\s+)?function\s+\w+/,
  );
  const nextTop = tailSrc.search(
    /\n(?:export\s+)?(?:const|type|interface)\s+\w+/,
  );
  const candidates = [nextDecl, nextTop].filter((n) => n >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : -1;
  return end === -1 ? src.slice(start) : src.slice(start, start + 1 + end);
}

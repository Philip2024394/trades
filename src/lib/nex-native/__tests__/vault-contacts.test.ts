// src/lib/nex-native/__tests__/vault-contacts.test.ts
//
// Vault Contacts · deterministic guards.
//
// Section A · Vault Home exposes a Contacts entry
// Section B · Contacts reuses the existing NEX friend/account/
//             conversation services · zero duplicate systems
// Section C · Canonical conversation id is preserved · zero
//             duplicate conversation created
// Section D · Route semantics per state
//               · vaulted      → /vault/home/chats/<convId>
//               · not-vaulted  → /chat/peer/<friendId> + Move-to-Vault
//               · no-conv      → /chat/peer/<friendId> (sealed path)
// Section E · Locked Vault cannot expose protected content
// Section F · No new DB table, no new schema, no new /api route
// Section G · Session + Vault-setup gating

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const VAULT_HOME = "src/app/nex-native/vault/home/page.tsx";
const CONTACTS_PAGE = "src/app/nex-native/vault/home/contacts/page.tsx";
const CONTACTS_CLIENT = "src/app/nex-native/vault/home/contacts/_contacts-client.tsx";

// ────────────────────────────────────────────────────────────────────
// Section A · Vault Home exposes Contacts
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · Vault Home navigation", () => {
  it("Vault Home mounts the Contacts entry tile", () => {
    const src = read(VAULT_HOME);
    expect(src).toMatch(/<ContactsEntryTile\s*\/>/);
    expect(src).toMatch(/function\s+ContactsEntryTile\s*\(/);
  });

  it("the Contacts tile links to the sealed /vault/home/contacts route", () => {
    const src = read(VAULT_HOME);
    const section = src.slice(src.indexOf("function ContactsEntryTile"));
    expect(section).toMatch(
      /href=\{?["']\/nex-native\/vault\/home\/contacts["']\}?/,
    );
    expect(section).toMatch(/data-nex-vault-contacts-entry-link/);
  });

  it("the tile sits in the Vault navigation stream (Chats → Contacts → Settings via header)", () => {
    const src = read(VAULT_HOME);
    const chats = src.indexOf("<VaultedChatsSection");
    const contacts = src.indexOf("<ContactsEntryTile");
    expect(chats).toBeGreaterThan(-1);
    expect(contacts).toBeGreaterThan(chats);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section B · Reuses existing NEX systems · zero duplicate
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · reuses existing NEX systems", () => {
  it("Contacts page uses the sealed friend-service for the friend list", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/friend-service["']/,
    );
    expect(src).toMatch(/friendService\.listFriends\s*\(/);
  });

  it("Contacts page uses the sealed account-service for identity", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/account-service["']/,
    );
    expect(src).toMatch(/accountService\.getAccountById\s*\(/);
  });

  it("Contacts page uses the sealed peer-conversation-service to resolve the canonical conversation", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/peer-conversation-service["']/,
    );
    expect(src).toMatch(/peerConversationService\.findPeerConversation\s*\(/);
  });

  it("Contacts page uses the sealed vault-entry-service for Vault membership", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault-entry-service["']/,
    );
    expect(src).toMatch(/vaultEntryService\.listVaultedConversationIds\s*\(/);
  });

  it("no Vault-specific contact / friend / relationship table is introduced", () => {
    const files = [CONTACTS_PAGE, CONTACTS_CLIENT];
    for (const f of files) {
      const src = read(f);
      // Negative guards against any attempt to spin up a parallel system.
      expect(src).not.toMatch(/nex_vault_contact/);
      expect(src).not.toMatch(/nex_vault_friend\b/);
      expect(src).not.toMatch(/nex_vault_relationship/);
      expect(src).not.toMatch(/\.from\(["']nex_vault_contact["']\)/);
      expect(src).not.toMatch(/\.from\(["']nex_vault_friend["']\)/);
    }
  });

  it("no new migration file was added under nex-supabase/migrations", () => {
    // The scope-locked rule: Contacts introduces zero schema change.
    // Any R2+ or Vault-C commit adding a migration should land in its
    // own commit · we fail loudly if someone slips one in here.
    const dir = path.join(ROOT, "nex-supabase", "migrations");
    const migrations = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
    // Max known migration at the time of this feature is 144. If a
    // new one is added as part of this feature, this snapshot will
    // need to be reviewed · we encode the current ceiling so a merge
    // conflict surfaces it.
    const maxVersion = migrations
      .map((f) => Number.parseInt(f.slice(0, 3), 10))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0);
    expect(maxVersion).toBeLessThanOrEqual(144);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section C · Canonical conversation id preservation
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · canonical conversation preservation", () => {
  it("each row carries the canonical conversation_id as resolved on the server", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/conversationId:\s*string\s*\|\s*null/);
    // Strip comments · the docstring explicitly references the
    // sealed getOrCreatePeerConversation service as the eventual
    // writer · we're asserting the CLIENT doesn't call it, not that
    // the module forbids mentioning the name.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/getOrCreatePeerConversation/);
    expect(codeOnly).not.toMatch(/createConversation/);
  });

  it("no code path in Contacts inserts into nex_peer_conversation", () => {
    const files = [CONTACTS_PAGE, CONTACTS_CLIENT];
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/from\(["']nex_peer_conversation["']\).*insert/);
      expect(src).not.toMatch(/insert.*nex_peer_conversation/);
    }
  });

  it("vaulted row links to the sealed B.4 Vault chat with the SAME conversationId", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(
      /`\/nex-native\/vault\/home\/chats\/\$\{row\.conversationId\}`/,
    );
  });

  it("not-vaulted row links to the sealed /chat/peer/<friendId> (which uses getOrCreatePeerConversation on first send)", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(
      /`\/nex-native\/chat\/peer\/\$\{row\.friendId\}`/,
    );
  });

  it("not-vaulted row with an existing conversation offers MoveToVaultAffordance for the SAME conversationId", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/MoveToVaultAffordance/);
    expect(src).toMatch(/kind:\s*["']move-conversation["']/);
    expect(src).toMatch(/conversationId:\s*row\.conversationId/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section D · Three route-state branches exist
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · route semantics per state", () => {
  it("three distinct data-nex-vault-contact-state values are rendered", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/data-nex-vault-contact-state="vaulted"/);
    expect(src).toMatch(/data-nex-vault-contact-state="not-vaulted"/);
    expect(src).toMatch(/data-nex-vault-contact-state="no-conversation"/);
  });

  it("vaulted branch is reached when isVaulted && conversationId exists", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/row\.isVaulted\s*&&\s*vaultedTarget/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section E · Locked Vault safety
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · locked Vault safety", () => {
  it("Contacts rows never read nex_peer_message · zero plaintext/ciphertext/attachment", () => {
    const files = [CONTACTS_PAGE, CONTACTS_CLIENT];
    for (const f of files) {
      const src = read(f);
      const codeOnly = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      expect(codeOnly).not.toMatch(/nex_peer_message/);
      expect(codeOnly).not.toMatch(/listPeerMessages/);
      expect(codeOnly).not.toMatch(/decryptEncryptedRows/);
      expect(codeOnly).not.toMatch(/ciphertext/);
      expect(codeOnly).not.toMatch(/attachment_url/);
      // Zero VMK / K_c references · identity surface only.
      expect(codeOnly).not.toMatch(/\bVMK\b/);
      expect(codeOnly).not.toMatch(/\bK_c\b/);
      expect(codeOnly).not.toMatch(/plaintext/i);
    }
  });

  it("Vault badge is pure metadata · derived from vault-entry membership", () => {
    const src = read(CONTACTS_PAGE);
    // Membership check is a Set.has, never a message-content peek.
    expect(src).toMatch(/vaultedConvIds\.has\s*\(/);
  });

  it("protected conversation routes to sealed B.4 Vault chat (which enforces unlock)", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/\/nex-native\/vault\/home\/chats\//);
    // Contacts page does NOT bypass unlock itself · it simply routes
    // · the sealed B.4 page is the enforcement point.
    const codeOnly = read(CONTACTS_CLIENT)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/useVaultSession/);
    expect(codeOnly).not.toMatch(/unlockVault/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section F · No new /api route
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · no new /api route", () => {
  it("no file under src/app/api/nex-native/vault/contacts/", () => {
    const dir = path.join(
      ROOT,
      "src",
      "app",
      "api",
      "nex-native",
      "vault",
      "contacts",
    );
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("Contacts page does not define a server action in its own module", () => {
    const src = read(CONTACTS_PAGE);
    // Server actions in Next.js are marked with "use server" at the
    // top of the file. The Contacts server component is NOT a server
    // action module.
    expect(src).not.toMatch(/^\s*["']use server["']/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section G · Session + Vault-setup gating
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · session + vault-setup gating", () => {
  it("Contacts page is session-gated · redirects to sign-in", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(/resolveNexAppSessionFromContext\s*\(\s*\)/);
    expect(src).toMatch(
      /redirect\(["']\/nex-native\/sign-in\?next=\/nex-native\/vault\/home\/contacts["']\)/,
    );
  });

  it("Contacts page gates on Vault being set up · redirects to /vault/setup otherwise", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(/nex_vault_setup/);
    expect(src).toMatch(/redirect\(["']\/nex-native\/vault\/setup["']\)/);
  });

  it("Contacts page files exist in the expected locations", () => {
    expect(exists(CONTACTS_PAGE)).toBe(true);
    expect(exists(CONTACTS_CLIENT)).toBe(true);
  });
});

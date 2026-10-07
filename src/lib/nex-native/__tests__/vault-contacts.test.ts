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
    // Phase B.7 P4 · tile accepts a `t` prop from the server-side
    // locale resolver so the Vault Home surface renders through the
    // universal NEX i18n pipe.
    expect(src).toMatch(/<ContactsEntryTile\s+t=\{t\}\s*\/>/);
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

  it("Contacts page uses the sealed vault-entry-service for Vault membership on BOTH axes", () => {
    // Bug-fix 2026-10-07 · the page must consult both the
    // conversation-vault branch AND the friend-vault branch · a
    // contact whose friendship is friend-vaulted (but whose
    // conversation was never conversation-vaulted) must still render
    // as "in Vault".
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault-entry-service["']/,
    );
    expect(src).toMatch(/vaultEntryService\.listVaultedConversationIds\s*\(/);
    expect(src).toMatch(/vaultEntryService\.listVaultedFriendIds\s*\(/);
    // The `isVaulted` field is set from EITHER axis.
    expect(src).toMatch(/vaultedConvIds\.has/);
    expect(src).toMatch(/vaultedFriendIds\.has/);
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

  it("vaulted branch is reached when isVaulted (either conversation OR friend axis)", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/if\s*\(\s*row\.isVaulted\s*\)/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section D2 · Vaulted-row action sheet (Move / Delete / Block)
// ────────────────────────────────────────────────────────────────────

const ACTION_SHEET =
  "src/app/nex-native/vault/home/contacts/_vault-contact-action-sheet.tsx";

describe("Vault Contacts · vaulted-row action sheet", () => {
  it("the action sheet file exists", () => {
    expect(exists(ACTION_SHEET)).toBe(true);
  });

  it("the three vaulted actions are present with distinct data-attributes", () => {
    const src = read(ACTION_SHEET);
    expect(src).toMatch(/data-nex-vault-contact-action="move-out"/);
    expect(src).toMatch(/data-nex-vault-contact-action="delete"/);
    expect(src).toMatch(/data-nex-vault-contact-action="block"/);
  });

  it("Move + Delete route through the sealed remove-* server actions (zero new backend)", () => {
    const src = read(ACTION_SHEET);
    expect(src).toMatch(
      /from\s+["']\.\.\/\.\.\/_actions["']/,
    );
    expect(src).toMatch(/removeConversationFromVaultAction/);
    expect(src).toMatch(/removeFriendFromVaultAction/);
    // No new client-side conversation / vault-entry mutation.
    expect(src).not.toMatch(/nex_vault_entry.*(insert|delete)/);
    expect(src).not.toMatch(/nex_peer_conversation.*insert/);
  });

  it("Block routes through the sealed blockAccountAction (FormData shape)", () => {
    const src = read(ACTION_SHEET);
    expect(src).toMatch(
      /from\s+["']\.\.\/\.\.\/\.\.\/_actions["']/,
    );
    expect(src).toMatch(/blockAccountAction/);
    // Posted as hidden form with the sealed `other_account_id` key.
    expect(src).toMatch(/name="other_account_id"/);
  });

  it("Delete uses the SAME backend path as Move (founder decision 2026-10-07)", () => {
    const src = read(ACTION_SHEET);
    // Both Move and Delete call the single `runMoveOrDelete` closure
    // which fires the sealed remove-actions. Delete differs ONLY in
    // the confirmation copy · never the backend path.
    expect(src).toMatch(/const\s+runMoveOrDelete\s*=\s*useCallback/);
  });

  it("the sheet never reads nex_peer_message (locked-Vault safety preserved)", () => {
    const src = read(ACTION_SHEET);
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/nex_peer_message/);
    expect(codeOnly).not.toMatch(/ciphertext/);
    expect(codeOnly).not.toMatch(/attachment_url/);
    expect(codeOnly).not.toMatch(/\bVMK\b/);
    expect(codeOnly).not.toMatch(/\bK_c\b/);
  });

  it("the vaulted row in _contacts-client.tsx wraps its Link in the action sheet", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/<VaultContactActionSheet\b/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section D3 · Richer card data · peer-visibility policy caps
// ────────────────────────────────────────────────────────────────────

describe("Vault Contacts · richer card data & peer-visibility policy", () => {
  it("VaultContactRow surfaces approxCountry + lastSeenRelative", () => {
    const src = read(CONTACTS_CLIENT);
    expect(src).toMatch(/approxCountry:\s*string\s*\|\s*null/);
    expect(src).toMatch(/lastSeenRelative:\s*string\s*\|\s*null/);
  });

  it("the server page fetches peer sessions via nex_session (approx_country + last_seen_at only)", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(/\.from\(["']nex_session["']\)/);
    // Only the three allowed fields are selected.
    expect(src).toMatch(
      /\.select\(["']account_id,\s*approx_country,\s*last_seen_at["']\)/,
    );
    // No forbidden fields appear in the select list.
    const selectMatch = src.match(/\.select\(["']([^"']+)["']\)/);
    expect(selectMatch).toBeTruthy();
    const selectText = selectMatch?.[1] ?? "";
    for (const forbidden of [
      "ip_address",
      "approx_city",
      "user_agent",
      "device_label",
    ]) {
      expect(
        selectText.includes(forbidden),
        `peer-visibility surface must not select '${forbidden}'`,
      ).toBe(false);
    }
  });

  it("peer sessions are restricted to live (revoked_at is null) sessions", () => {
    const src = read(CONTACTS_PAGE);
    expect(src).toMatch(/\.is\(["']revoked_at["'],\s*null\)/);
  });

  it("last-seen is rendered as a RELATIVE phrase · the exact timestamp never reaches the client row", () => {
    const page = read(CONTACTS_PAGE);
    const client = read(CONTACTS_CLIENT);
    // Server uses Phase B.7 formatRelativeFrom to produce the string.
    expect(page).toMatch(/formatRelativeFrom\s*\(/);
    // Client row surface shows the relative string · no toLocaleString
    // call on the sub-line in the client file.
    const clientCodeOnly = client
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(clientCodeOnly).not.toMatch(/toLocaleString|toLocaleDateString|toLocaleTimeString/);
  });

  it("country is capped at the 2-letter ISO code · no city, no address", () => {
    const client = read(CONTACTS_CLIENT);
    // The sub-line renderer uses `approxCountry` only · no reference
    // to city or address.
    expect(client).not.toMatch(/approx_city|address_line/);
    expect(client).toMatch(/formatCountryCode/);
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

// src/lib/nex-native/__tests__/vault-chat-surface-b4.test.ts
//
// Vault Phase B · Commit B.4 · deterministic regression for the
// canonical Vault chat surface at /nex-native/vault/home/chats/
// [conversationId]. Static source grep enforces the sealed doctrine:
//   · ONE canonical nex_peer_conversation · never a second table
//   · ONE canonical nex_peer_message · never a Vault message table
//   · plaintext-blind server · zero decrypt / unwrap / plaintext hash
//     on server
//   · theme chrome from the Standard NEX Experience · no hardcoded
//     world-specific colours (no `if theme === …` branches)
//   · composer unavailable while Vault locked
//   · uses sealed B.3 K_c layer + sealed Bridge 76 Curve25519 flow
//
// The real browser proof lives in tests/e2e/vault-phase-b4-chat-
// surface.spec.ts.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SERVER_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/home/chats/[conversationId]/page.tsx",
);
const CLIENT = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx",
);

const files = [SERVER_PAGE, CLIENT];

function readFile(p: string): string {
  return fs.readFileSync(p, "utf-8");
}
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((l) => {
      const i = l.indexOf("//");
      return i === -1 ? l : l.slice(0, i);
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// A · file existence
// ---------------------------------------------------------------------------

describe("B.4 · file existence", () => {
  test("server page exists at canonical route", () => {
    expect(fs.existsSync(SERVER_PAGE)).toBe(true);
  });
  test("client component exists", () => {
    expect(fs.existsSync(CLIENT)).toBe(true);
  });
  test("no second conversation table file was created", () => {
    const bad = path.join(REPO_ROOT, "nex-supabase/migrations");
    const migrations = fs.readdirSync(bad);
    for (const m of migrations) {
      expect(m).not.toMatch(/nex_vault_message/);
      expect(m).not.toMatch(/nex_vault_peer_conversation/);
      expect(m).not.toMatch(/nex_vault_peer_message/);
    }
  });
});

// ---------------------------------------------------------------------------
// B · canonical conversation preservation
// ---------------------------------------------------------------------------

describe("B.4 · canonical conversation + message doctrine", () => {
  for (const f of files) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · does NOT insert / upsert / update / delete nex_peer_conversation`, () => {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.insert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.upsert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.update\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.delete\b/);
    });

    test(`${name} · does NOT write to nex_peer_message directly (sealed service only)`, () => {
      const code = stripComments(readFile(f));
      // The sealed sendEncryptedPeerMessage goes through a route · this
      // UI module must not touch nex_peer_message directly.
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.insert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.upsert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.update\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.delete\b/);
    });

    test(`${name} · does NOT reference any fictional vault message table`, () => {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/nex_vault_message/);
      expect(code).not.toMatch(/nex_vault_peer_message/);
      expect(code).not.toMatch(/nex_vault_peer_conversation/);
    });
  }
});

// ---------------------------------------------------------------------------
// C · plaintext-blind server + no new API route added by B.4
// ---------------------------------------------------------------------------

describe("B.4 · plaintext-blind server · no new vault chat API route", () => {
  test("no new API directory /api/nex-native/vault/chat/message", () => {
    const dir = path.join(
      REPO_ROOT,
      "src/app/api/nex-native/vault/chat/message",
    );
    expect(fs.existsSync(dir)).toBe(false);
  });

  test("no new API directory /api/nex-native/vault/message", () => {
    const dir = path.join(
      REPO_ROOT,
      "src/app/api/nex-native/vault/message",
    );
    expect(fs.existsSync(dir)).toBe(false);
  });

  test("server page never calls aesGcmDecrypt / unwrapKey / plaintext-hash primitives", () => {
    const code = stripComments(readFile(SERVER_PAGE));
    expect(code).not.toMatch(/\baesGcmDecrypt\b/);
    expect(code).not.toMatch(/\baesGcmEncrypt\b/);
    expect(code).not.toMatch(/\bunwrapKey\b/);
    expect(code).not.toMatch(/\bwrapKey\b/);
    expect(code).not.toMatch(/\bsubtle\.digest\b/);
    expect(code).not.toMatch(/createHash\s*\(\s*["']sha-?256["']/i);
    expect(code).not.toMatch(/\bderiveKekFrom\w+\b/);
  });

  test("server page body only reads nex_peer_message · body column kept as sentinel for encrypted rows", () => {
    // The server never materialises plaintext · for encrypted rows the
    // body column is the '(encrypted)' sentinel string from Bridge 76.
    const code = stripComments(readFile(SERVER_PAGE));
    expect(code).toMatch(/listPeerMessages/);
    // We serialise ciphertext_b64 / nonce_b64 · the client decrypts.
    expect(code).toMatch(/ciphertext_b64/);
    expect(code).toMatch(/nonce_b64/);
  });
});

// ---------------------------------------------------------------------------
// D · lock gating · locked state hides plaintext · composer gated
// ---------------------------------------------------------------------------

describe("B.4 · lock gating · locked state exposes no plaintext", () => {
  const client = readFile(CLIENT);
  const clientStripped = stripComments(client);

  test("renders a visible locked shell state", () => {
    expect(client).toMatch(/data-nex-vault-chat-state="locked"/);
    expect(client).toMatch(/Vault is locked/);
    expect(client).toMatch(/Unlock Vault/);
  });

  test("message bubbles render ONLY when phase is 'ready'", () => {
    // The messages array is only populated inside the boot() path,
    // which is only invoked when vault.unlocked is true. In the
    // locked branch (early return), we must not render any bubble.
    const lockedBranch = client.match(
      /phase === "locked"[\s\S]*?return\s*\(\s*<div[\s\S]*?<\/div>\s*\)\s*;/,
    );
    expect(lockedBranch, "locked branch body not found").toBeTruthy();
    expect(lockedBranch![0]).not.toMatch(/data-nex-vault-chat-bubble/);
    expect(lockedBranch![0]).not.toMatch(/data-nex-vault-chat-input/);
    expect(lockedBranch![0]).not.toMatch(/data-nex-vault-chat-composer/);
  });

  test("composer input is disabled when phase is not 'ready'", () => {
    expect(client).toMatch(/disabled=\{phase\s*!==\s*"ready"\}/);
  });

  test("lock transition zeroises in-memory K_c via clearInMemoryConversationKeys", () => {
    expect(client).toMatch(/clearInMemoryConversationKeys\s*\(\s*\)/);
  });

  test("lock transition discards decrypted message state", () => {
    // setMessages([]) must appear in the !vault.unlocked branch of the
    // transition useEffect.
    expect(client).toMatch(/setMessages\(\s*\[\s*\]\s*\)/);
    expect(client).toMatch(/setDraft\(\s*["']{2}\s*\)/);
    expect(client).toMatch(/setPhase\(\s*["']locked["']\s*\)/);
  });

  test("locked branch does NOT include any decrypted message array literal", () => {
    expect(clientStripped).not.toMatch(/plaintextMessages\s*=\s*\[\s*["']/);
  });
});

// ---------------------------------------------------------------------------
// E · uses sealed B.3 K_c layer · sealed Bridge 76 decrypt/send
// ---------------------------------------------------------------------------

describe("B.4 · uses sealed B.3 K_c + sealed Bridge 76 pipelines", () => {
  const client = readFile(CLIENT);

  test("imports from B.3 conversation-key module", () => {
    expect(client).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault\/client\/conversation-key["']/,
    );
    expect(client).toMatch(/\bprovisionConversationKey\b/);
    expect(client).toMatch(/\bensureAllConversationKeysLoaded\b/);
    expect(client).toMatch(/\bcacheEncryptedMessage\b/);
    expect(client).toMatch(/\breadCachedMessages\b/);
    expect(client).toMatch(/\bclearInMemoryConversationKeys\b/);
  });

  test("imports from sealed Vault session (useVaultSession)", () => {
    expect(client).toMatch(/from\s+["']@\/lib\/nex-native\/vault\/client\/vault-session["']/);
    expect(client).toMatch(/\buseVaultSession\b/);
  });

  test("imports sealed unlock orchestrator (no reinvented unlock)", () => {
    expect(client).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault\/client\/unlock-orchestrator["']/,
    );
    expect(client).toMatch(/\bunlockVault\b/);
  });

  test("imports sealed Bridge 76 decrypt helper", () => {
    expect(client).toMatch(/from\s+["']@\/lib\/nex-native\/crypto\/encrypted-receive["']/);
    expect(client).toMatch(/\bdecryptEncryptedRows\b/);
  });

  test("imports sealed Bridge 76 encrypted send helper", () => {
    expect(client).toMatch(/from\s+["']@\/lib\/nex-native\/crypto\/encrypted-send["']/);
    expect(client).toMatch(/\bsendEncryptedPeerMessage\b/);
  });

  test("does NOT re-implement AES primitives inline", () => {
    const code = stripComments(client);
    expect(code).not.toMatch(/\bcrypto\.subtle\.(encrypt|decrypt|digest|importKey)\b/);
    expect(code).not.toMatch(/\baesGcmEncrypt\b/);
    expect(code).not.toMatch(/\baesGcmDecrypt\b/);
    expect(code).not.toMatch(/\bwrapKey\b/);
    expect(code).not.toMatch(/\bunwrapKey\b/);
    expect(code).not.toMatch(/\bderiveKekFrom\w+\b/);
  });
});

// ---------------------------------------------------------------------------
// F · theme neutrality · no hardcoded world/theme branches
// ---------------------------------------------------------------------------

describe("B.4 · theme neutrality · no world-specific branches", () => {
  const client = readFile(CLIENT);
  const code = stripComments(client);

  test("no `if theme === …` or `if world === …` branching", () => {
    expect(code).not.toMatch(/\bif\s*\(\s*(theme|world)\s*===/i);
    expect(code).not.toMatch(/\btheme\s*===\s*["']ocean["']/i);
    expect(code).not.toMatch(/\btheme\s*===\s*["']joker["']/i);
    expect(code).not.toMatch(/\bworld\s*===\s*["']/i);
  });

  test("no `if conversationId === …` branches", () => {
    expect(code).not.toMatch(/\bif\s*\(\s*conversationId\s*===/i);
  });

  test("no reference to specific theme packages or ThemeCategory enums", () => {
    expect(code).not.toMatch(/ocean|joker|motorbike|cakes|vitamins/i);
  });
});

// ---------------------------------------------------------------------------
// G · commercial / scope / sealed-phase guards
// ---------------------------------------------------------------------------

describe("B.4 · scope + commercial guards", () => {
  for (const f of files) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · no commercial tokens`, () => {
      const code = stripComments(readFile(f)).toLowerCase();
      for (const t of ["bisnis", "subscription", "entitlement", "quota", "allowance", "tier-gate"]) {
        expect(code.includes(t), `${name} contains "${t}"`).toBe(false);
      }
    });
  }

  test("no move-to-vault UI exists yet (B.5 scope)", () => {
    const f = path.join(
      REPO_ROOT,
      "src/lib/nex-native/vault/client/move-to-vault.ts",
    );
    expect(fs.existsSync(f)).toBe(false);
  });

  test("no notification-policy module (B.6 scope)", () => {
    const f = path.join(
      REPO_ROOT,
      "src/lib/nex-native/vault/client/notification-policy.ts",
    );
    expect(fs.existsSync(f)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H · sealed-phase isolation · no sealed file imports B.4 UI
// ---------------------------------------------------------------------------

describe("B.4 · sealed-phase isolation (one-way dependency)", () => {
  const sealedFiles = [
    "src/lib/nex-native/vault-file-service.ts",
    "src/lib/nex-native/vault-persistence-service.ts",
    "src/lib/nex-native/vault-entry-service.ts",
    "src/lib/nex-native/vault/key-hierarchy.ts",
    "src/lib/nex-native/vault/migration-service.ts",
    "src/lib/nex-native/vault/ciphertext-structural-validator.ts",
    "src/lib/nex-native/vault/client/legacy-migration.ts",
    "src/lib/nex-native/vault/step-up-service.ts",
    "src/lib/nex-native/vault/vault-status-service.ts",
    "src/lib/nex-native/vault/conversation-envelope-service.ts",
    "src/lib/nex-native/vault/conversation-envelope-validator.ts",
    "src/lib/nex-native/vault/client/conversation-key.ts",
    "src/lib/nex-native/vault/client/vault-session.ts",
    "src/lib/nex-native/vault/client/unlock-orchestrator.ts",
    "src/lib/nex-native/crypto/encrypted-receive.ts",
    "src/lib/nex-native/crypto/encrypted-send.ts",
    "src/lib/nex-native/peer-message-service.ts",
  ];

  for (const rel of sealedFiles) {
    test(`sealed file untouched by B.4 route surface: ${rel}`, () => {
      const full = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(full)) return;
      const code = readFile(full);
      expect(code).not.toMatch(
        /from\s+["']@\/app\/nex-native\/vault\/home\/chats\/\[conversationId\]/,
      );
    });
  }
});

// src/lib/nex-native/__tests__/vault-move-and-preserve-b5.test.ts
//
// Vault Phase B · Commit B.5 · deterministic regression for the
// Move-to-Vault wiring + Policy X future-attachment orchestrator.
//
// The real Playwright E2E (tests/e2e/vault-phase-b5-move-and-
// preserve.spec.ts) exercises the full browser flow. This suite is
// static source grep that enforces the sealed doctrine without a
// browser:
//   · canonical conversation preservation (NO second table)
//   · plaintext-blind server-side preserve path
//   · Policy X orchestrator reuses sealed B.2 route · no new API
//   · Policy X orchestrator uses sealed A.1 preservation primitives
//     via the existing route · never re-implements attachment copy
//   · move-to-vault UI reuses sealed B.4 affordance · no new UI
//   · sealed Phase A / B.1 / B.2 / B.3 files untouched by the
//     orchestrator (one-way import direction)

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const ORCHESTRATOR = path.join(
  REPO_ROOT,
  "src/lib/nex-native/vault/client/attachment-preservation.ts",
);
const VAULT_CHAT_CLIENT = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx",
);
const AFFORDANCE = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/_move-to-vault-affordance.tsx",
);
const SEALED_SERVER_ACTIONS = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/_actions.ts",
);
const SEALED_PRESERVE_ROUTE = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/vault/chat/attachment/preserve/route.ts",
);

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
// A · orchestrator file exists · lives in client/ (not server/)
// ---------------------------------------------------------------------------

describe("B.5 · file existence", () => {
  test("orchestrator module exists", () => {
    expect(fs.existsSync(ORCHESTRATOR)).toBe(true);
  });

  test("orchestrator is client-tagged ('use client')", () => {
    const code = readFile(ORCHESTRATOR);
    expect(code).toMatch(/^"use client";/m);
  });

  test("vault chat client exists and imports the orchestrator", () => {
    expect(fs.existsSync(VAULT_CHAT_CLIENT)).toBe(true);
    const code = readFile(VAULT_CHAT_CLIENT);
    expect(code).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault\/client\/attachment-preservation["']/,
    );
    expect(code).toMatch(/preserveAttachmentsForVaultedConversation/);
  });
});

// ---------------------------------------------------------------------------
// B · orchestrator reuses sealed B.2 route · no new API introduced
// ---------------------------------------------------------------------------

describe("B.5 · orchestrator · no new API · no re-implementation", () => {
  const code = readFile(ORCHESTRATOR);
  const stripped = stripComments(code);

  test("POSTs to the sealed B.2 /attachment/preserve route · nothing else", () => {
    expect(code).toMatch(
      /\/api\/nex-native\/vault\/chat\/attachment\/preserve/,
    );
    // Exactly one fetch URL · the orchestrator never invents a second
    // attachment path.
    const fetches = code.match(/fetch\(\s*["'`][^"'`]+["'`]/g) ?? [];
    expect(fetches.length).toBe(1);
    expect(fetches[0]).toMatch(/attachment\/preserve/);
  });

  test("no new API route directory landed under /api/nex-native/vault/chat/attachment", () => {
    const dir = path.join(
      REPO_ROOT,
      "src/app/api/nex-native/vault/chat/attachment",
    );
    const entries = fs.readdirSync(dir).sort();
    expect(entries).toEqual(["preserve"]);
  });

  test("no additional vault chat route directories introduced", () => {
    const dir = path.join(REPO_ROOT, "src/app/api/nex-native/vault/chat");
    const entries = fs.readdirSync(dir).sort();
    expect(entries).toEqual(["attachment", "envelope"]);
  });

  test("body is exactly {conversation_id, message_id} · no plaintext fields", () => {
    expect(stripped).toMatch(/conversation_id:\s*input\.conversationId/);
    expect(stripped).toMatch(/message_id:\s*input\.messageId/);
    // Must not send plaintext, keys, or PIN.
    expect(stripped).not.toMatch(/plaintext/i);
    expect(stripped).not.toMatch(/\bK_c\b/);
    expect(stripped).not.toMatch(/\bVMK\b/);
    expect(stripped).not.toMatch(/\bPIN\b/);
    expect(stripped).not.toMatch(/passphrase/i);
    expect(stripped).not.toMatch(/\bwrappedKey\b/i);
  });

  test("no inline AES / crypto / wrap primitives", () => {
    expect(stripped).not.toMatch(/\bcrypto\.subtle\./);
    expect(stripped).not.toMatch(/\baesGcmEncrypt\b|\baesGcmDecrypt\b/);
    expect(stripped).not.toMatch(/\bwrapKey\b|\bunwrapKey\b/);
    expect(stripped).not.toMatch(/\bderiveKekFrom\w+/);
    expect(stripped).not.toMatch(/\bgetObjectStorage\b/);
    expect(stripped).not.toMatch(/\bencryptedPathFor\b/);
  });
});

// ---------------------------------------------------------------------------
// C · honest partial-failure accounting
// ---------------------------------------------------------------------------

describe("B.5 · orchestrator · honest partial-failure semantics", () => {
  const code = readFile(ORCHESTRATOR);

  test("exports a batch helper that returns per-row + totals", () => {
    expect(code).toMatch(/export\s+async\s+function\s+preserveAttachmentsForVaultedConversation/);
    expect(code).toMatch(/preserved:\s*0/);
    expect(code).toMatch(/already_preserved:\s*0/);
    expect(code).toMatch(/skipped:\s*0/);
    expect(code).toMatch(/failed:\s*0/);
    expect(code).toMatch(/rows:\s*\[\]/);
  });

  test("per-row result includes stable state tokens incl. forbidden + step_up_required + copy_failed", () => {
    const stripped = stripComments(code);
    for (const s of [
      "preserved",
      "already_preserved",
      "no_attachment",
      "forbidden",
      "step_up_required",
      "copy_failed",
      "unknown_error",
    ]) {
      expect(stripped, `state token ${s} missing`).toContain(s);
    }
  });

  test("a single row's failure never counts as preserved · state is classified by switch", () => {
    const code = readFile(ORCHESTRATOR);
    // The switch block maps only "preserved" → preserved counter and
    // "already_preserved" → already_preserved counter · everything else
    // either skipped (no_attachment) or failed. This guards against
    // regression where a non-ok row sneaks into the preserved tally.
    expect(code).toMatch(/case\s+"preserved":[\s\S]*?preserved\s*\+=\s*1/);
    expect(code).toMatch(
      /case\s+"already_preserved":[\s\S]*?already_preserved\s*\+=\s*1/,
    );
    expect(code).toMatch(/default:[\s\S]*?failed\s*\+=\s*1/);
  });
});

// ---------------------------------------------------------------------------
// D · wiring into the sealed B.4 Vault chat client
// ---------------------------------------------------------------------------

describe("B.5 · wiring · fires on open for every attachment-bearing message", () => {
  const code = readFile(VAULT_CHAT_CLIENT);

  test("filters initialMessages by attachment_url and NOT deleted_for_everyone", () => {
    expect(code).toMatch(/attachment_url/);
    expect(code).toMatch(/deleted_for_everyone/);
    expect(code).toMatch(
      /preserveAttachmentsForVaultedConversation/,
    );
  });

  test("call is fire-and-forget · does not block the ready phase", () => {
    expect(code).toMatch(
      /if\s*\(candidates\.length\s*>\s*0\)[\s\S]*?void\s+preserveAttachmentsForVaultedConversation/,
    );
  });

  test("Policy X doctrine comment present in the client", () => {
    expect(code).toMatch(/Policy X/);
    expect(code).toMatch(/B\.5/);
    expect(code).toMatch(/idempotent/i);
  });
});

// ---------------------------------------------------------------------------
// E · canonical conversation preservation (sealed B.1/B.4 doctrine)
// ---------------------------------------------------------------------------

describe("B.5 · canonical conversation + message doctrine", () => {
  const files = [ORCHESTRATOR, VAULT_CHAT_CLIENT];
  for (const f of files) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · never writes to nex_peer_conversation`, () => {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.insert\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.upsert\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.update\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.delete\b/);
    });

    test(`${name} · never writes to nex_peer_message directly`, () => {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.insert\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.upsert\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.update\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.delete\b/);
    });

    test(`${name} · no reference to any fictional vault message / conversation table`, () => {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/nex_vault_message/);
      expect(stripped).not.toMatch(/nex_vault_peer_message/);
      expect(stripped).not.toMatch(/nex_vault_peer_conversation/);
    });
  }
});

// ---------------------------------------------------------------------------
// F · move affordance reuses the sealed B.4-era component
// ---------------------------------------------------------------------------

describe("B.5 · move affordance · reuses sealed MoveToVaultAffordance", () => {
  test("affordance file is unchanged location · exports MoveToVaultAffordance", () => {
    expect(fs.existsSync(AFFORDANCE)).toBe(true);
    const code = readFile(AFFORDANCE);
    expect(code).toMatch(/export\s+function\s+MoveToVaultAffordance/);
  });

  test("affordance uses sealed server actions (not inline SQL)", () => {
    const code = readFile(AFFORDANCE);
    expect(code).toMatch(/moveConversationToVaultAction/);
    expect(code).toMatch(/moveFriendToVaultAction/);
    expect(code).toMatch(/removeConversationFromVaultAction/);
    expect(code).toMatch(/removeFriendFromVaultAction/);
  });

  test("sealed server actions call the sealed vault-entry-service", () => {
    const code = readFile(SEALED_SERVER_ACTIONS);
    expect(code).toMatch(/vaultEntryService\.moveConversationToVault/);
    expect(code).toMatch(/vaultEntryService\.moveFriendToVault/);
  });

  test("inbox already mounts the affordance (sealed · unchanged by B.5)", () => {
    const inbox = path.join(
      REPO_ROOT,
      "src/app/nex-native/chat/inbox/page.tsx",
    );
    const code = readFile(inbox);
    expect(code).toMatch(/MoveToVaultAffordance/);
  });
});

// ---------------------------------------------------------------------------
// G · sealed preserve route stays plaintext-blind (defence-in-depth
//     static assertion · same guards B.2 ships, repeated here so a
//     B.5-era refactor cannot silently rot them)
// ---------------------------------------------------------------------------

describe("B.5 · sealed B.2 preserve route · plaintext-blind guards still hold", () => {
  const code = readFile(SEALED_PRESERVE_ROUTE);
  const stripped = stripComments(code);

  test("delegates to the sealed copyConversationAttachmentsToVault", () => {
    expect(code).toMatch(/copyConversationAttachmentsToVault/);
    expect(code).toMatch(/findVaultFileBySourceMessage/);
  });

  test("no server-side decrypt / unwrap / plaintext-hash primitives", () => {
    expect(stripped).not.toMatch(/\baesGcmDecrypt\b/);
    expect(stripped).not.toMatch(/\baesGcmEncrypt\b/);
    expect(stripped).not.toMatch(/\bunwrapKey\b/);
    expect(stripped).not.toMatch(/\bwrapKey\b/);
    expect(stripped).not.toMatch(/\bsubtle\.digest\b/);
    expect(stripped).not.toMatch(/createHash\s*\(\s*["']sha-?256["']/i);
    expect(stripped).not.toMatch(/\bderiveKekFrom\w+\b/);
  });
});

// ---------------------------------------------------------------------------
// H · sealed-phase isolation · the orchestrator is a leaf · nothing
//     sealed imports it
// ---------------------------------------------------------------------------

describe("B.5 · sealed-phase isolation (one-way import direction)", () => {
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
    test(`sealed file untouched by B.5: ${rel}`, () => {
      const full = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(full)) return;
      const code = readFile(full);
      expect(code).not.toMatch(
        /from\s+["']@\/lib\/nex-native\/vault\/client\/attachment-preservation["']/,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// I · commercial / scope guards
// ---------------------------------------------------------------------------

describe("B.5 · scope + commercial guards", () => {
  for (const f of [ORCHESTRATOR]) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · no commercial-token references in code`, () => {
      const stripped = stripComments(readFile(f)).toLowerCase();
      for (const t of [
        "bisnis",
        "subscription",
        "entitlement",
        "quota",
        "allowance",
        "tier-gate",
        "rp39",
        "10 gb",
      ]) {
        expect(stripped.includes(t), `${name} contains "${t}"`).toBe(false);
      }
    });
  }

  test("no notification-policy module landed (B.6 scope)", () => {
    const f = path.join(
      REPO_ROOT,
      "src/lib/nex-native/vault/client/notification-policy.ts",
    );
    expect(fs.existsSync(f)).toBe(false);
  });

  test("no new auto-lock-sweep subscription module (B.6 scope)", () => {
    const f = path.join(
      REPO_ROOT,
      "src/lib/nex-native/vault/client/lock-sweep.ts",
    );
    expect(fs.existsSync(f)).toBe(false);
  });
});

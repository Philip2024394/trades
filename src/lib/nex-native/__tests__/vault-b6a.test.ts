// src/lib/nex-native/__tests__/vault-b6a.test.ts
//
// Vault Phase B · Commit B.6A · deterministic regression for Vault
// Integration Hardening:
//   · global cross-tab lock sweep (BroadcastChannel · lock signal
//     only · no key material)
//   · Vault composer attachment-send through the sealed canonical
//     encrypted attachment pipeline (no Vault-only upload path)
//   · call-privacy presentation gating (locked Vault → "NEX call" ·
//     unlocked → peer name)
//
// Real Playwright proof lives at
// tests/e2e/vault-phase-b6a-hardening.spec.ts.
//
// Explicit DEFERRED items for the record (NEX-wide infrastructure
// gaps · NOT built in B.6A):
//   · universal NEX inbound-message realtime
//   · universal NEX message push notifications
// This suite enforces that B.6A has NOT silently built either.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const LOCK_SWEEP = path.join(
  REPO_ROOT,
  "src/lib/nex-native/vault/client/lock-sweep.ts",
);
const SWEEP_MOUNT = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/_cross-tab-lock-sweep-client.tsx",
);
const VAULT_LAYOUT = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/layout.tsx",
);
const VAULT_CHAT_CLIENT = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx",
);
const CALL_HUB = path.join(
  REPO_ROOT,
  "src/app/nex-native/_incoming-call-hub.tsx",
);
const VAULT_ACTIONS = path.join(
  REPO_ROOT,
  "src/app/nex-native/vault/_actions.ts",
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
// A · global cross-tab lock sweep
// ---------------------------------------------------------------------------

describe("B.6A · global cross-tab lock sweep", () => {
  test("lock-sweep module exists and is client-tagged", () => {
    expect(fs.existsSync(LOCK_SWEEP)).toBe(true);
    const code = readFile(LOCK_SWEEP);
    expect(code).toMatch(/^"use client";/m);
  });

  test("exports installCrossTabLockReceiver · broadcastLockSignal · lockVaultEverywhere", () => {
    const code = readFile(LOCK_SWEEP);
    expect(code).toMatch(/export\s+function\s+installCrossTabLockReceiver/);
    expect(code).toMatch(/export\s+function\s+broadcastLockSignal/);
    expect(code).toMatch(/export\s+function\s+lockVaultEverywhere/);
  });

  test("uses BroadcastChannel (not localStorage · not WebSocket)", () => {
    const code = readFile(LOCK_SWEEP);
    expect(code).toMatch(/\bBroadcastChannel\b/);
    // No alternative cross-tab transport.
    const stripped = stripComments(code);
    expect(stripped).not.toMatch(/\blocalStorage\b/);
    expect(stripped).not.toMatch(/\bsessionStorage\b/);
    expect(stripped).not.toMatch(/\bnew\s+WebSocket\b/);
    expect(stripped).not.toMatch(/\bfetch\s*\(/);
  });

  test("broadcast payload contains ONLY {type, at} · no key material anywhere in the module", () => {
    const code = readFile(LOCK_SWEEP);
    const stripped = stripComments(code);
    // Payload shape is pinned by a LockMessage type alias.
    expect(code).toMatch(/type\s+LockMessage\s*=\s*\{\s*type:\s*"lock";\s*at:\s*number\s*\}/);
    // No key / plaintext / PIN / passphrase names appear in code
    // (comments explicitly discuss what we DO NOT transmit · stripped
    // code must contain neither the transmitted key nor the key names).
    expect(stripped).not.toMatch(/\bK_c\b/);
    expect(stripped).not.toMatch(/\bVMK\b/);
    expect(stripped).not.toMatch(/\bPIN\b/);
    expect(stripped).not.toMatch(/passphrase/i);
    expect(stripped).not.toMatch(/wrapped/i);
    expect(stripped).not.toMatch(/plaintext/i);
  });

  test("receiver calls the sealed clearVmk + clearInMemoryConversationKeys · nothing else", () => {
    const code = readFile(LOCK_SWEEP);
    expect(code).toMatch(/clearVmk\s*\(\s*\)/);
    expect(code).toMatch(/clearInMemoryConversationKeys\s*\(\s*\)/);
    // No new VMK store · the sealed Phase A singleton remains
    // authoritative.
    expect(code).not.toMatch(/let\s+\w*[Vv][Mm][Kk]\w*\s*=/);
    expect(code).not.toMatch(/let\s+\w*lock\w*State\w*\s*=/);
  });

  test("receiver handler does not re-broadcast · one-way sink only", () => {
    const code = readFile(LOCK_SWEEP);
    // The handler body must not call broadcastLockSignal (would cause
    // a feedback loop between tabs).
    const handlerBlock = code.match(
      /const\s+handler\s*=\s*\(ev[\s\S]*?\n\s{2}\};/,
    );
    expect(handlerBlock, "handler block not found").toBeTruthy();
    expect(handlerBlock![0]).not.toMatch(/broadcastLockSignal/);
    expect(handlerBlock![0]).not.toMatch(/postMessage/);
  });

  test("sweep mount component exists · renders nothing · hooks installCrossTabLockReceiver", () => {
    expect(fs.existsSync(SWEEP_MOUNT)).toBe(true);
    const code = readFile(SWEEP_MOUNT);
    expect(code).toMatch(/^"use client";/m);
    expect(code).toMatch(/installCrossTabLockReceiver/);
    expect(code).toMatch(/return\s+null/);
  });

  test("Vault layout mounts the sweep client on every /vault route", () => {
    expect(fs.existsSync(VAULT_LAYOUT)).toBe(true);
    const code = readFile(VAULT_LAYOUT);
    expect(code).toMatch(/CrossTabLockSweepClient/);
  });

  test("B.4 Vault chat lock button broadcasts via lockVaultEverywhere", () => {
    const code = readFile(VAULT_CHAT_CLIENT);
    expect(code).toMatch(/from\s+["']@\/lib\/nex-native\/vault\/client\/lock-sweep["']/);
    expect(code).toMatch(/lockVaultEverywhere/);
  });
});

// ---------------------------------------------------------------------------
// B · Vault composer attachment send · reuses sealed canonical pipeline
// ---------------------------------------------------------------------------

describe("B.6A · Vault composer attachment send", () => {
  const code = readFile(VAULT_CHAT_CLIENT);

  test("imports the sealed uploadEncryptedAttachment · no Vault-only upload module", () => {
    expect(code).toMatch(
      /from\s+["']@\/lib\/nex-native\/crypto\/encrypted-attachment-upload["']/,
    );
    expect(code).toMatch(/uploadEncryptedAttachment/);
  });

  test("send path passes encryptedAttachment to the sealed sendEncryptedPeerMessage", () => {
    expect(code).toMatch(/encryptedAttachment:\s*pendingAttachment/);
  });

  test("file picker renders in the composer · accepts images/videos/audio", () => {
    expect(code).toMatch(/type="file"/);
    expect(code).toMatch(/accept="image\/\*,video\/\*,audio\/\*"/);
  });

  test("pending attachment is cleared on lock (founder-sealed drafts-discarded rule)", () => {
    expect(code).toMatch(/setPendingAttachment\(null\)/);
    // Must appear in the !vault.unlocked branch of the lock-transition
    // effect alongside setMessages([]) and setDraft("").
    const block = code.match(
      /else\s+if\s*\(\s*!vault\.unlocked\s*\)\s*\{[\s\S]*?\}/,
    );
    expect(block, "lock-transition else-branch not found").toBeTruthy();
    expect(block![0]).toMatch(/setMessages\(\s*\[\s*\]\s*\)/);
    expect(block![0]).toMatch(/setDraft\(\s*["']{2}\s*\)/);
    expect(block![0]).toMatch(/setPendingAttachment\(\s*null\s*\)/);
  });

  test("no Vault-only upload API introduced · no new /vault/upload route", () => {
    const stripped = stripComments(code);
    expect(stripped).not.toMatch(/\/vault\/upload/);
    expect(stripped).not.toMatch(/vault-attachment-upload/);
    // Zero direct fetch to any attachment endpoint from this file ·
    // the sealed uploadEncryptedAttachment owns the one fetch.
    expect(stripped).not.toMatch(/fetch\(\s*["']\/api\/[^"']*attachment/);
  });

  test("no new API route landed under /api/nex-native/vault/attachment or /api/nex-native/vault/upload", () => {
    const forbiddenDirs = [
      path.join(REPO_ROOT, "src/app/api/nex-native/vault/attachment"),
      path.join(REPO_ROOT, "src/app/api/nex-native/vault/upload"),
    ];
    for (const d of forbiddenDirs) {
      expect(fs.existsSync(d), `${d} must not exist (B.6A sealed scope)`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// C · call-privacy presentation (sealed call transport unchanged)
// ---------------------------------------------------------------------------

describe("B.6A · call-privacy presentation gating", () => {
  const code = readFile(CALL_HUB);

  test("hub imports useVaultSession + sealed vaulted-friend list action", () => {
    expect(code).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault\/client\/vault-session["']/,
    );
    expect(code).toMatch(/useVaultSession/);
    expect(code).toMatch(/listVaultedFriendIdsForViewerAction/);
  });

  test("call label switches to 'NEX call' when Vault is locked AND caller is a vaulted peer", () => {
    expect(code).toMatch(/callerIsVaulted/);
    expect(code).toMatch(/!vaultSession\.unlocked/);
    expect(code).toMatch(/hidePeerIdentity/);
    expect(code).toMatch(/["']NEX call["']/);
  });

  test("displayedCallerName replaces every raw callerDisplayName render site", () => {
    expect(code).not.toMatch(/\{active\.callerDisplayName\}/);
    expect(code).toMatch(/\{displayedCallerName\}/);
  });

  test("exposes a stable data attribute for the privacy state (Playwright hook)", () => {
    expect(code).toMatch(/data-nex-call-hub-privacy-hidden/);
  });

  test("call transport (RTCPeerConnection / signalling) is NOT modified · only presentation", () => {
    const stripped = stripComments(code);
    // The hub must not add any new peer-connection or signalling setup
    // for Vault · it already deep-links via router.push.
    expect(stripped).not.toMatch(/new\s+RTCPeerConnection/);
  });

  test("vaulted friends server action exists · reveals NO Vault content", () => {
    expect(fs.existsSync(VAULT_ACTIONS)).toBe(true);
    const actions = readFile(VAULT_ACTIONS);
    expect(actions).toMatch(/export\s+async\s+function\s+listVaultedFriendIdsForViewerAction/);
    // Response shape: {ok, friendIds} · no last-message / display-name /
    // preview / message count leaks through this action.
    expect(actions).toMatch(/friendIds:\s*string\[\]/);
    const actionCode = stripComments(actions);
    // Grep for leak-risk tokens in the action body (regionally scoped
    // to the action function would be ideal but a file-wide check
    // suffices for the surface we touched).
    const fn = actions.match(
      /listVaultedFriendIdsForViewerAction[\s\S]*?^}/m,
    );
    expect(fn, "action body not found").toBeTruthy();
    expect(fn![0]).not.toMatch(/last_message/i);
    expect(fn![0]).not.toMatch(/preview/i);
    expect(fn![0]).not.toMatch(/display_name/i);
    expect(actionCode).toContain("listVaultedFriendIdsForViewerAction");
  });
});

// ---------------------------------------------------------------------------
// D · DEFERRED NEX-wide infrastructure gaps · B.6A must NOT silently build
// ---------------------------------------------------------------------------

describe("B.6A · deferred NEX-wide infrastructure guards", () => {
  test("no Vault-only realtime message channel exists", () => {
    for (const rel of [
      "src/lib/nex-native/vault/client/vault-realtime.ts",
      "src/lib/nex-native/vault/client/message-realtime.ts",
      "src/lib/nex-native/realtime/vault-messages.ts",
    ]) {
      expect(
        fs.existsSync(path.join(REPO_ROOT, rel)),
        `${rel} must not exist · Vault must NOT ship a parallel realtime transport`,
      ).toBe(false);
    }
  });

  test("no Vault-only message postgres_changes subscription in the chat client", () => {
    const code = readFile(VAULT_CHAT_CLIENT);
    expect(code).not.toMatch(/postgres_changes/);
    expect(code).not.toMatch(/\.on\s*\(\s*["']postgres_changes["']/);
    // No ad-hoc polling disguised as realtime either.
    expect(code).not.toMatch(/setInterval\s*\(/);
  });

  test("no new Vault-only message push notification code", () => {
    for (const rel of [
      "src/lib/nex-native/vault/client/vault-push.ts",
      "src/lib/nex-native/vault/client/notification-policy.ts",
      "src/app/api/nex-native/vault/push",
    ]) {
      expect(
        fs.existsSync(path.join(REPO_ROOT, rel)),
        `${rel} must not exist · Vault push notifications are a NEX-wide infrastructure item`,
      ).toBe(false);
    }
  });

  test("sealed universal push-subscription service is unchanged by B.6A (no vault_* fields added)", () => {
    const push = path.join(REPO_ROOT, "src/lib/nex-native/push-subscription-service.ts");
    if (!fs.existsSync(push)) return;
    const code = readFile(push);
    // No vault-specific columns should have crept in.
    expect(code).not.toMatch(/vault_only/);
    expect(code).not.toMatch(/vault_message_push/);
  });

  test("B.6A does not fake realtime via polling, setInterval, or test-only paths", () => {
    const files = [LOCK_SWEEP, SWEEP_MOUNT, VAULT_CHAT_CLIENT, CALL_HUB];
    for (const f of files) {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/\bsetInterval\s*\(/);
      expect(stripped).not.toMatch(/polling.*messages/i);
    }
  });
});

// ---------------------------------------------------------------------------
// E · canonical conversation + plaintext-blind server (sealed B.1-B.5)
// ---------------------------------------------------------------------------

describe("B.6A · canonical conversation + plaintext-blind server · preserved", () => {
  const files = [LOCK_SWEEP, SWEEP_MOUNT, VAULT_LAYOUT, VAULT_CHAT_CLIENT, CALL_HUB];
  for (const f of files) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · never writes nex_peer_conversation or nex_peer_message directly`, () => {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.insert\b/);
      expect(stripped).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.insert\b/);
    });

    test(`${name} · no fictional vault message / vault conversation table`, () => {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/nex_vault_message/);
      expect(stripped).not.toMatch(/nex_vault_peer_message/);
      expect(stripped).not.toMatch(/nex_vault_peer_conversation/);
    });
  }

  test("no server-side decrypt / unwrap / plaintext-hash in B.6A files", () => {
    const files = [LOCK_SWEEP, SWEEP_MOUNT, VAULT_LAYOUT, VAULT_CHAT_CLIENT, CALL_HUB, VAULT_ACTIONS];
    for (const f of files) {
      const stripped = stripComments(readFile(f));
      expect(stripped).not.toMatch(/\baesGcmDecrypt\b/);
      expect(stripped).not.toMatch(/\bunwrapKey\b/);
      expect(stripped).not.toMatch(/\bsubtle\.digest\b/);
      expect(stripped).not.toMatch(/createHash\s*\(\s*["']sha-?256["']/i);
      expect(stripped).not.toMatch(/\bderiveKekFrom\w+/);
    }
  });

  test("no commercial-token references in any B.6A file", () => {
    const files = [LOCK_SWEEP, SWEEP_MOUNT, VAULT_LAYOUT, VAULT_CHAT_CLIENT, CALL_HUB];
    const banned = ["bisnis", "subscription", "entitlement", "quota", "allowance", "rp39", "10 gb"];
    for (const f of files) {
      const stripped = stripComments(readFile(f)).toLowerCase();
      for (const t of banned) {
        expect(stripped.includes(t), `${f} contains "${t}"`).toBe(false);
      }
    }
  });
});

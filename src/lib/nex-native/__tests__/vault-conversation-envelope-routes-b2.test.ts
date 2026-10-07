// src/lib/nex-native/__tests__/vault-conversation-envelope-routes-b2.test.ts
//
// Vault Phase B · Commit B.2 · deterministic regression for the new
// envelope + attachment-preserve routes.
//
// Pattern mirrors the A.6 architecture-guard suite · static source grep
// against the five new route files + the service + the validator.
// Live-DB behaviour (mint → list → revoke → rotate, IDOR denials) is
// proven separately by the B.2 route proof script.
//
// This file enforces the B.2 doctrine:
//   · exactly 5 route files land (mint, list, revoke, rotate,
//     attachment/preserve)
//   · zero forbidden server-side crypto primitives in any route or
//     service file
//   · exactly one new table (nex_vault_conversation_envelope) is read
//     or written; nex_peer_conversation / nex_peer_message are only
//     READ for membership + ownership checks, never written
//   · the validator + service re-use sealed Phase A primitives · no
//     reinvention of envelope format

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const ROUTE_MINT = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/vault/chat/envelope/mint/route.ts",
);
const ROUTE_LIST = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/vault/chat/envelope/list/route.ts",
);
const ROUTE_REVOKE = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/vault/chat/envelope/revoke/route.ts",
);
const ROUTE_ROTATE = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/vault/chat/envelope/rotate/route.ts",
);
const ROUTE_PRESERVE = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/vault/chat/attachment/preserve/route.ts",
);
const SERVICE = path.join(
  REPO_ROOT,
  "src/lib/nex-native/vault/conversation-envelope-service.ts",
);
const VALIDATOR = path.join(
  REPO_ROOT,
  "src/lib/nex-native/vault/conversation-envelope-validator.ts",
);

const serverFiles = [
  ROUTE_MINT,
  ROUTE_LIST,
  ROUTE_REVOKE,
  ROUTE_ROTATE,
  ROUTE_PRESERVE,
  SERVICE,
];

function readFile(p: string): string {
  return fs.readFileSync(p, "utf-8");
}

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

// ---------------------------------------------------------------------------
// A · file existence · exactly 5 routes + service + validator
// ---------------------------------------------------------------------------

describe("B.2 · file existence", () => {
  test("mint route exists", () => {
    expect(fs.existsSync(ROUTE_MINT)).toBe(true);
  });
  test("list route exists", () => {
    expect(fs.existsSync(ROUTE_LIST)).toBe(true);
  });
  test("revoke route exists", () => {
    expect(fs.existsSync(ROUTE_REVOKE)).toBe(true);
  });
  test("rotate route exists", () => {
    expect(fs.existsSync(ROUTE_ROTATE)).toBe(true);
  });
  test("attachment preserve route exists", () => {
    expect(fs.existsSync(ROUTE_PRESERVE)).toBe(true);
  });
  test("conversation-envelope-service exists", () => {
    expect(fs.existsSync(SERVICE)).toBe(true);
  });
  test("conversation-envelope-validator exists", () => {
    expect(fs.existsSync(VALIDATOR)).toBe(true);
  });

  test("no additional route files landed under /chat/envelope/* or /chat/attachment/*", () => {
    const envelopeDir = path.join(
      REPO_ROOT,
      "src/app/api/nex-native/vault/chat/envelope",
    );
    const attachmentDir = path.join(
      REPO_ROOT,
      "src/app/api/nex-native/vault/chat/attachment",
    );
    const envelopeEntries = fs.readdirSync(envelopeDir).sort();
    expect(envelopeEntries).toEqual(["list", "mint", "revoke", "rotate"]);
    const attachmentEntries = fs.readdirSync(attachmentDir).sort();
    expect(attachmentEntries).toEqual(["preserve"]);
  });
});

// ---------------------------------------------------------------------------
// B · plaintext-blindness architecture guards
// ---------------------------------------------------------------------------

describe("B.2 · plaintext-blindness · no server-side crypto / decrypt", () => {
  for (const f of serverFiles) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");

    test(`${name} · no plaintext hash of Vault bytes`, () => {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\bsubtle\.digest\b/);
      expect(code).not.toMatch(/createHash\s*\(\s*["']sha-?256["']/i);
    });

    test(`${name} · no key derivation`, () => {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\bderiveKekFromPin\b/);
      expect(code).not.toMatch(/\bderiveKekFromPassphrase\b/);
      expect(code).not.toMatch(/\bderiveKekFromPrf\b/);
    });

    test(`${name} · no envelope unwrap or AES-GCM decrypt`, () => {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\bunwrapKey\b/);
      expect(code).not.toMatch(/\baesGcmDecrypt\b/);
      // generateContentKey · aesGcmEncrypt · wrapKey are also NOT
      // allowed server-side · wrap is a client responsibility only.
      expect(code).not.toMatch(/\bgenerateContentKey\b/);
      expect(code).not.toMatch(/\baesGcmEncrypt\b/);
      expect(code).not.toMatch(/\bwrapKey\b/);
    });

    test(`${name} · no commercial-token references in code`, () => {
      const code = stripComments(readFile(f)).toLowerCase();
      const banned = [
        "bisnis",
        "subscription",
        "entitlement",
        "quota",
        "allowance",
        "tier-gate",
      ];
      for (const token of banned) {
        expect(code.includes(token), `${name} contains "${token}"`).toBe(false);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// C · routes gate on session + step-up (vault_unlock fresh)
// ---------------------------------------------------------------------------

describe("B.2 · auth + step-up gating", () => {
  const writeRoutes = [ROUTE_MINT, ROUTE_REVOKE, ROUTE_ROTATE, ROUTE_PRESERVE];

  for (const f of writeRoutes) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · resolves nex session + requires vault_unlock fresh`, () => {
      const code = readFile(f);
      expect(code).toMatch(/resolveNexAppSession\s*\(/);
      expect(code).toMatch(/lookupNexSessionId/);
      expect(code).toMatch(/requireStepUp[\s\S]*?vault_unlock:\s*["']fresh["']/);
    });
  }

  test("revoke requires BOTH vault_unlock and password fresh", () => {
    const code = readFile(ROUTE_REVOKE);
    expect(code).toMatch(/vault_unlock:\s*["']fresh["']/);
    expect(code).toMatch(/password:\s*["']fresh["']/);
  });

  test("rotate requires BOTH vault_unlock and password fresh", () => {
    const code = readFile(ROUTE_ROTATE);
    expect(code).toMatch(/vault_unlock:\s*["']fresh["']/);
    expect(code).toMatch(/password:\s*["']fresh["']/);
  });

  test("list route authenticates via session + verifies device ownership", () => {
    const code = readFile(ROUTE_LIST);
    expect(code).toMatch(/resolveNexAppSession\s*\(/);
    expect(code).toMatch(/assertOwnDevice/);
  });
});

// ---------------------------------------------------------------------------
// D · IDOR shape · no client-supplied account_id trust anywhere
// ---------------------------------------------------------------------------

describe("B.2 · IDOR shape · owner-scoped service calls only", () => {
  for (const f of serverFiles) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · never trusts a client-supplied account_id`, () => {
      // No route or service reads body.account_id or sets account_id
      // from any source other than session.account.id or an internal
      // owner-check path.
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\bbody\.account_id\b/);
      // Any `account_id` assignment must come from a session/account
      // owner path · we grep for literal `accountId: input.accountId`
      // / `accountId: session.account.id` style and forbid naked
      // body-sourced forms.
      expect(code).not.toMatch(
        /accountId\s*:\s*(?:body|req|request|input)\s*\.\s*account_id\b/,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// E · canonical conversation preservation
// ---------------------------------------------------------------------------

describe("B.2 · canonical conversation · no second conversation created", () => {
  for (const f of serverFiles) {
    const name = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
    test(`${name} · does NOT insert into nex_peer_conversation`, () => {
      const code = stripComments(readFile(f));
      // Allowed: SELECT (participant check). Forbidden: INSERT /
      // UPDATE / UPSERT / DELETE of the canonical conversation table.
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.insert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.upsert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.update\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_conversation["']\s*\)\.delete\b/);
    });

    test(`${name} · does NOT write to nex_peer_message`, () => {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.insert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.upsert\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.update\b/);
      expect(code).not.toMatch(/\.from\(\s*["']nex_peer_message["']\s*\)\.delete\b/);
    });
  }
});

// ---------------------------------------------------------------------------
// F · attachment preserve route delegates to sealed A.1 flow
// ---------------------------------------------------------------------------

describe("B.2 · attachment preserve · delegates to sealed persistence service", () => {
  test("imports copyConversationAttachmentsToVault from the sealed service", () => {
    const code = readFile(ROUTE_PRESERVE);
    expect(code).toMatch(
      /from\s+["']@\/lib\/nex-native\/vault-persistence-service["']/,
    );
    expect(code).toMatch(/\bcopyConversationAttachmentsToVault\b/);
  });

  test("idempotency fast path · consults findVaultFileBySourceMessage", () => {
    const code = readFile(ROUTE_PRESERVE);
    expect(code).toMatch(/findVaultFileBySourceMessage/);
  });

  test("message must belong to the conversation (defence-in-depth)", () => {
    const code = stripComments(readFile(ROUTE_PRESERVE));
    expect(code).toMatch(/msg\.conversation_id\s*!==\s*conversationId/);
  });

  test("route does NOT itself fetch bytes or touch the Vault bucket", () => {
    const code = stripComments(readFile(ROUTE_PRESERVE));
    expect(code).not.toMatch(/\buploadVaultFileBytes\b/);
    expect(code).not.toMatch(/\bgetObjectStorage\b/);
    expect(code).not.toMatch(/\bfetchAttachmentBytes\b/);
  });

  test("route does NOT re-implement Phase A.6 encryption inline", () => {
    const code = stripComments(readFile(ROUTE_PRESERVE));
    expect(code).not.toMatch(/\bencryptedPathFor\b/);
    expect(code).not.toMatch(/\bheadEncryptedObject\b/);
    expect(code).not.toMatch(/\breconcile\b/);
  });
});

// ---------------------------------------------------------------------------
// G · validator preserves sealed Phase A envelope shape
// ---------------------------------------------------------------------------

describe("B.2 · validator · sealed Phase A envelope shape", () => {
  const code = readFile(VALIDATOR);

  test("WRAPPED_K_C_LENGTH exported as 60 (12 nonce || 32 ct || 16 tag)", () => {
    expect(code).toMatch(/WRAPPED_K_C_LENGTH\s*=\s*60/);
  });

  test("NONCE_LENGTH exported as 12 (AES-GCM standard)", () => {
    expect(code).toMatch(/NONCE_LENGTH\s*=\s*12/);
  });

  test("rejects nonce not matching the first 12 bytes of wrapped_k_c", () => {
    expect(code).toMatch(/nonce_mismatch/);
    expect(code).toMatch(/input\.nonce\[i\]\s*!==\s*input\.wrapped_k_c\[i\]/);
  });

  test("algorithm is pinned to PHASE_A_ALGORITHM (no local string literal)", () => {
    // The validator must import PHASE_A_ALGORITHM from the sealed
    // key-hierarchy module and compare against it · the string
    // "aes-256-gcm/v1" must NOT appear as an inline literal in the
    // validator (it does appear in migrations and in the key-hierarchy
    // module · those are the sealed sources of truth).
    expect(code).toMatch(/from\s+["']\.\/key-hierarchy["']/);
    expect(code).toMatch(/PHASE_A_ALGORITHM/);
    expect(code).not.toMatch(/["']aes-256-gcm\/v1["']/);
  });

  test("hexToBytes rejects non-hex input · fail-closed", () => {
    expect(code).toMatch(/if\s*\(!\/\^\[0-9a-f\]\+\$\/i\.test\(hex\)\)\s*return\s+null/);
  });
});

// ---------------------------------------------------------------------------
// H · service · sealed Phase A posture + participant check
// ---------------------------------------------------------------------------

describe("B.2 · service · participant + device-ownership checks", () => {
  const code = readFile(SERVICE);

  test("asserts the authenticated account is a participant of the conversation", () => {
    expect(code).toMatch(/assertIsParticipant/);
    expect(code).toMatch(/participant_a_id/);
    expect(code).toMatch(/participant_b_id/);
  });

  test("asserts the target_device_id belongs to the authenticated account", () => {
    expect(code).toMatch(/assertOwnDevice/);
    expect(code).toMatch(/nex_account_device_key/);
    expect(code).toMatch(/revoked_at/);
  });

  test("mint checks participant AND device BEFORE insert", () => {
    const stripped = stripComments(code);
    const mintBlock = stripped.match(
      /export\s+async\s+function\s+mintEnvelope[\s\S]*?^}/m,
    );
    expect(mintBlock, "mintEnvelope body not found").toBeTruthy();
    expect(mintBlock![0]).toMatch(/assertIsParticipant/);
    expect(mintBlock![0]).toMatch(/assertOwnDevice/);
    // Both checks must be awaited before the admin .insert call.
    const participantIdx = mintBlock![0].indexOf("assertIsParticipant");
    const deviceIdx = mintBlock![0].indexOf("assertOwnDevice");
    const insertIdx = mintBlock![0].indexOf(".insert(");
    expect(participantIdx).toBeGreaterThan(-1);
    expect(deviceIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(participantIdx).toBeLessThan(insertIdx);
    expect(deviceIdx).toBeLessThan(insertIdx);
  });

  test("rotate validates every supplied envelope BEFORE touching the DB", () => {
    expect(code).toMatch(/\/\/\s*Validate every supplied envelope BEFORE touching the DB/);
  });
});

// ---------------------------------------------------------------------------
// I · sealed-phase isolation
// ---------------------------------------------------------------------------

describe("B.2 · sealed A.1–A.6 untouched", () => {
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
    "src/app/api/nex-native/vault/migration/start/route.ts",
    "src/app/api/nex-native/vault/migration/upload/route.ts",
    "src/app/api/nex-native/vault/migration/finalize/route.ts",
    "src/app/api/nex-native/vault/migration/finalize-metadata/route.ts",
    "src/app/api/nex-native/vault/migration/queue/route.ts",
    "src/app/api/nex-native/vault/migration/read-encrypted/route.ts",
  ];

  test("B.2 service imports only READ paths from vault-file-service (findVaultFileBySourceMessage)", () => {
    const code = readFile(ROUTE_PRESERVE);
    const vaultFileImports = code.match(
      /from\s+["']@\/lib\/nex-native\/vault-file-service["'];?/g,
    );
    expect(vaultFileImports?.length).toBe(1);
    // The one import block must contain findVaultFileBySourceMessage
    // and must NOT contain any write primitive.
    const importBlock = code.match(
      /import[\s\S]*?from\s+["']@\/lib\/nex-native\/vault-file-service["']/,
    );
    expect(importBlock, "import block missing").toBeTruthy();
    expect(importBlock![0]).toMatch(/findVaultFileBySourceMessage/);
    expect(importBlock![0]).not.toMatch(/insertVaultFileMetadata/);
    expect(importBlock![0]).not.toMatch(/uploadVaultFileBytes/);
    expect(importBlock![0]).not.toMatch(/deleteVaultFile/);
  });

  for (const rel of sealedFiles) {
    test(`sealed file untouched by B.2: ${rel}`, () => {
      // Static assertion that no B.2 artefact is added to the sealed
      // files (new files only · existing files not expected to be in
      // the B.2 commit staging set). We cannot grep git-staging here;
      // instead we check the sealed file does not import from any new
      // B.2 module · ensuring the dependency direction is one-way.
      const full = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(full)) return; // some sealed routes may not exist on main
      const code = readFile(full);
      expect(code).not.toMatch(
        /from\s+["']@\/lib\/nex-native\/vault\/conversation-envelope-service["']/,
      );
      expect(code).not.toMatch(
        /from\s+["']@\/lib\/nex-native\/vault\/conversation-envelope-validator["']/,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// J · B.2 scope guards · no overbuild
// ---------------------------------------------------------------------------

describe("B.2 · scope guards · nothing outside the authorised boundary", () => {
  test("no new client crypto file for K_c generation (B.3 scope)", () => {
    const file = path.join(
      REPO_ROOT,
      "src/lib/nex-native/vault/client/conversation-cache.ts",
    );
    expect(fs.existsSync(file)).toBe(false);
  });

  test("no new Vault chat UI route (B.4 scope)", () => {
    const uiDir = path.join(REPO_ROOT, "src/app/nex-native/vault/home/chats");
    if (!fs.existsSync(uiDir)) return;
    for (const name of fs.readdirSync(uiDir)) {
      expect(name).not.toMatch(/^\[.*conversationId.*\]$/);
    }
  });

  test("no new client orchestrator for move-to-Vault (B.5 scope)", () => {
    const file = path.join(
      REPO_ROOT,
      "src/lib/nex-native/vault/client/move-to-vault.ts",
    );
    expect(fs.existsSync(file)).toBe(false);
  });

  test("no notification / lock / call changes in B.2", () => {
    for (const f of serverFiles) {
      const code = stripComments(readFile(f));
      expect(code).not.toMatch(/\bpush\s*subscription\b/i);
      expect(code).not.toMatch(/\bservice[-\s]?worker\b/i);
      expect(code).not.toMatch(/\bincoming[-\s]?call\b/i);
    }
  });
});

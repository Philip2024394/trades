// src/lib/nex-native/__tests__/vault-conversation-key-b3.test.ts
//
// Vault Phase B · Commit B.3 · deterministic regression for the
// client-side conversation-key module. Covers the pure-crypto / memory /
// lifecycle contract that does not require a browser IDB · the full
// IDB persistence + lock/refresh/decrypt cycle is proven in Playwright
// (tests/e2e/vault-phase-b3-conversation-key.spec.ts).

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  PHASE_A_ALGORITHM,
  aesGcmDecrypt,
  generateContentKey,
  unwrapKey,
  wrapKey,
} from "../vault/key-hierarchy";
import {
  clearVmk,
  installVmk,
  readVaultSessionSnapshot,
} from "../vault/client/vault-session";
import {
  _b3TestProbe,
  clearInMemoryConversationKeys,
  getConversationKeyFromMemory,
  hasConversationKeyInMemory,
  provisionConversationKey,
} from "../vault/client/conversation-key";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MODULE = path.join(
  REPO_ROOT,
  "src/lib/nex-native/vault/client/conversation-key.ts",
);
const MODULE_CODE = fs.readFileSync(MODULE, "utf-8");

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

const MODULE_CODE_STRIPPED = stripComments(MODULE_CODE);

// ---------------------------------------------------------------------------
// Shared VMK fixture · installed per test · zero cross-test leakage.
// ---------------------------------------------------------------------------

const vmkA = new Uint8Array(32);
const vmkB = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
  vmkA[i] = i + 1;
  vmkB[i] = 100 + i;
}

beforeEach(() => {
  clearInMemoryConversationKeys();
  clearVmk();
});
afterEach(() => {
  clearInMemoryConversationKeys();
  clearVmk();
});

// ---------------------------------------------------------------------------
// A · K_c generation
// ---------------------------------------------------------------------------

describe("B.3 · K_c generation", () => {
  test("generateContentKey returns exactly 32 bytes", () => {
    const k = generateContentKey();
    expect(k).toBeInstanceOf(Uint8Array);
    expect(k.length).toBe(32);
  });

  test("two consecutive K_c values are not equal (non-deterministic)", () => {
    const a = generateContentKey();
    const b = generateContentKey();
    expect(a.length).toBe(32);
    expect(b.length).toBe(32);
    let same = true;
    for (let i = 0; i < 32; i++) {
      if (a[i] !== b[i]) {
        same = false;
        break;
      }
    }
    expect(same, "K_c must be random · two consecutive values must differ").toBe(false);
  });

  test("1000 generated keys all differ (statistical sanity)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const k = generateContentKey();
      seen.add(Buffer.from(k).toString("hex"));
    }
    expect(seen.size).toBe(1000);
  });

  test("K_c is NOT derived from conversation_id (independent calls return independent bytes)", () => {
    // The module calls generateContentKey() with no arguments; a
    // deterministic (hash-based) derivation would make this test
    // flaky. The 1000-key test above would catch outright collisions.
    // Here we additionally confirm the public module API never passes
    // a conversation-id-shaped argument into any key-derivation path.
    expect(MODULE_CODE_STRIPPED).not.toMatch(/deriveKekFromPin|deriveKekFromPassphrase|deriveKekFromPrf/);
    // generateContentKey call site must not take any argument:
    expect(MODULE_CODE_STRIPPED).toMatch(/generateContentKey\(\)/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/generateContentKey\(\s*\w/);
  });
});

// ---------------------------------------------------------------------------
// B · AES-GCM round-trip (reuses sealed Phase A primitives)
// ---------------------------------------------------------------------------

describe("B.3 · AES-GCM encrypt / decrypt round-trip", () => {
  test("ciphertext decrypts back to original plaintext", async () => {
    const key = generateContentKey();
    const { aesGcmEncrypt, generateNonce12 } = await import("../vault/key-hierarchy");
    const nonce = generateNonce12();
    const plain = new TextEncoder().encode("hello vault b.3");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext: plain });
    const pt = await aesGcmDecrypt({ key, nonce, ciphertext: ct });
    expect(Buffer.from(pt).toString("utf-8")).toBe("hello vault b.3");
  });

  test("wrong K_c fails authentication", async () => {
    const { aesGcmEncrypt, generateNonce12 } = await import("../vault/key-hierarchy");
    const key = generateContentKey();
    const wrong = generateContentKey();
    const nonce = generateNonce12();
    const plain = new TextEncoder().encode("hello vault b.3");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext: plain });
    await expect(
      aesGcmDecrypt({ key: wrong, nonce, ciphertext: ct }),
    ).rejects.toThrow();
  });

  test("wrong nonce fails authentication", async () => {
    const { aesGcmEncrypt, generateNonce12 } = await import("../vault/key-hierarchy");
    const key = generateContentKey();
    const nonce1 = generateNonce12();
    const nonce2 = generateNonce12();
    const ct = await aesGcmEncrypt({
      key,
      nonce: nonce1,
      plaintext: new TextEncoder().encode("x"),
    });
    await expect(
      aesGcmDecrypt({ key, nonce: nonce2, ciphertext: ct }),
    ).rejects.toThrow();
  });

  test("modified ciphertext fails authentication (GCM tag integrity)", async () => {
    const { aesGcmEncrypt, generateNonce12 } = await import("../vault/key-hierarchy");
    const key = generateContentKey();
    const nonce = generateNonce12();
    const ct = await aesGcmEncrypt({
      key,
      nonce,
      plaintext: new TextEncoder().encode("hello"),
    });
    // Flip one bit in the middle of the ciphertext.
    const tampered = new Uint8Array(ct);
    tampered[Math.floor(tampered.length / 2)] ^= 0x01;
    await expect(
      aesGcmDecrypt({ key, nonce, ciphertext: tampered }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// C · wrap / unwrap under VMK with AAD=device_id binding
// ---------------------------------------------------------------------------

describe("B.3 · wrap/unwrap under VMK · AAD=device_id binding", () => {
  test("wrap on Device A unwraps on same Device A (AAD matches)", async () => {
    const kC = generateContentKey();
    const aad = new TextEncoder().encode("nex/vault/conv-key/v1|device-A");
    const { envelope } = await wrapKey({ keyToWrap: kC, kek: vmkA, aad });
    expect(envelope.length).toBe(60);
    const recovered = await unwrapKey({ envelope, kek: vmkA, aad });
    expect(Buffer.from(recovered).equals(Buffer.from(kC))).toBe(true);
  });

  test("envelope wrapped for Device A fails to unwrap with Device B's AAD", async () => {
    const kC = generateContentKey();
    const aadA = new TextEncoder().encode("nex/vault/conv-key/v1|device-A");
    const aadB = new TextEncoder().encode("nex/vault/conv-key/v1|device-B");
    const { envelope } = await wrapKey({ keyToWrap: kC, kek: vmkA, aad: aadA });
    await expect(unwrapKey({ envelope, kek: vmkA, aad: aadB })).rejects.toThrow();
  });

  test("envelope wrapped under VMK A fails to unwrap under VMK B", async () => {
    const kC = generateContentKey();
    const aad = new TextEncoder().encode("nex/vault/conv-key/v1|device-A");
    const { envelope } = await wrapKey({ keyToWrap: kC, kek: vmkA, aad });
    await expect(unwrapKey({ envelope, kek: vmkB, aad })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// D · memory lifecycle · lock clears K_c
// ---------------------------------------------------------------------------

describe("B.3 · memory lifecycle · lock clears K_c", () => {
  test("explicit clearInMemoryConversationKeys zeroises and empties the map", async () => {
    installVmk(vmkA);
    // Mock a server mint by stubbing fetch.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, envelope_id: "env-1", generation: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      const r = await provisionConversationKey({
        conversationId: "11111111-1111-1111-1111-111111111111",
        targetDeviceId: "device-id-abc12345",
      });
      expect(r.ok).toBe(true);
      expect(hasConversationKeyInMemory("11111111-1111-1111-1111-111111111111", 1)).toBe(true);
      expect(_b3TestProbe().total_keys_in_memory).toBe(1);

      clearInMemoryConversationKeys();
      expect(_b3TestProbe().total_keys_in_memory).toBe(0);
      expect(hasConversationKeyInMemory("11111111-1111-1111-1111-111111111111", 1)).toBe(false);
      expect(getConversationKeyFromMemory("11111111-1111-1111-1111-111111111111", 1)).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("Vault lock → lazy fallback · next public call clears memory + returns vault_locked", async () => {
    installVmk(vmkA);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, envelope_id: "env-2", generation: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      await provisionConversationKey({
        conversationId: "22222222-2222-2222-2222-222222222222",
        targetDeviceId: "device-id-abc12345",
      });
      expect(_b3TestProbe().total_keys_in_memory).toBe(1);

      // Vault locks (idle timeout, user action, refresh in a real tab) ·
      // readVaultSessionSnapshot now reports locked.
      clearVmk();
      expect(readVaultSessionSnapshot().unlocked).toBe(false);

      // Next public call must fail closed AND clear memory as a side
      // effect of the lazy fallback guard.
      const r = await provisionConversationKey({
        conversationId: "33333333-3333-3333-3333-333333333333",
        targetDeviceId: "device-id-abc12345",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("vault_locked");
      expect(_b3TestProbe().total_keys_in_memory).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("provisionConversationKey fails closed if Vault locked at entry", async () => {
    // No installVmk · Vault is locked from the start.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    try {
      const r = await provisionConversationKey({
        conversationId: "44444444-4444-4444-4444-444444444444",
        targetDeviceId: "device-id-abc12345",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("vault_locked");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// E · network secrecy · exact body sent to mint
// ---------------------------------------------------------------------------

describe("B.3 · network secrecy · mint request body contains only opaque material", () => {
  test("mint body contains wrapped_k_c_hex, nonce_hex, algorithm, generation · never plaintext K_c, VMK, PIN, message", async () => {
    installVmk(vmkA);
    const observed: Array<{ url: string; body: string | null }> = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      observed.push({ url, body: (init?.body as string | null) ?? null });
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, envelope_id: "env-x", generation: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    try {
      await provisionConversationKey({
        conversationId: "55555555-5555-5555-5555-555555555555",
        targetDeviceId: "sentinel-device-id",
      });
      expect(observed).toHaveLength(1);
      const mint = observed[0]!;
      expect(mint.url).toMatch(/\/api\/nex-native\/vault\/chat\/envelope\/mint$/);
      const body = mint.body!;
      const json = JSON.parse(body);
      // Allowed fields only.
      expect(Object.keys(json).sort()).toEqual([
        "algorithm",
        "conversation_id",
        "generation",
        "nonce_hex",
        "target_device_id",
        "wrapped_k_c_hex",
      ]);
      expect(json.algorithm).toBe(PHASE_A_ALGORITHM);
      expect(json.generation).toBe(1);
      expect(json.wrapped_k_c_hex).toMatch(/^[0-9a-f]{120}$/);
      expect(json.nonce_hex).toMatch(/^[0-9a-f]{24}$/);
      // Forbidden content.
      expect(body).not.toMatch(/vmk/i);
      expect(body).not.toMatch(/\bk_c\b/i);
      expect(body).not.toMatch(/pin/i);
      expect(body).not.toMatch(/passphrase/i);
      expect(body).not.toMatch(/plaintext/i);
      // VMK bytes · hex-encode them and prove absence.
      const vmkHex = Buffer.from(vmkA).toString("hex");
      expect(body).not.toContain(vmkHex);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// F · architecture guards · module must not use forbidden server-side
//     primitives, must not log key material, must reuse sealed Phase A
// ---------------------------------------------------------------------------

describe("B.3 · architecture guards · module source", () => {
  test("imports PHASE_A_ALGORITHM from the sealed key-hierarchy (no inline string)", () => {
    expect(MODULE_CODE).toMatch(/from\s+["']\.\.\/key-hierarchy["']/);
    expect(MODULE_CODE).toMatch(/PHASE_A_ALGORITHM/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/["']aes-256-gcm\/v1["']/);
  });

  test("imports VMK gate (withVmk, readVaultSessionSnapshot) from sealed vault-session", () => {
    expect(MODULE_CODE).toMatch(/withVmk/);
    expect(MODULE_CODE).toMatch(/readVaultSessionSnapshot/);
    expect(MODULE_CODE).toMatch(/from\s+["']\.\/vault-session["']/);
  });

  test("does NOT import server-only (module must be callable from browser)", () => {
    expect(MODULE_CODE_STRIPPED).not.toMatch(/import\s+["']server-only["']/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/from\s+["']server-only["']/);
  });

  test("does NOT import the sealed supabase-admin or any server service", () => {
    expect(MODULE_CODE_STRIPPED).not.toMatch(/supabase-admin/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/conversation-envelope-service/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/vault-file-service/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/vault-persistence-service/);
  });

  test("does NOT contain console.log / warn / error / info of K_c / VMK / plaintext", () => {
    // No console calls at all in the module · we are strict here.
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\bconsole\.\w+\s*\(/);
  });

  test("uses the sealed Phase A crypto primitives only (no local AES implementations)", () => {
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\bcrypto\.subtle\.encrypt\s*\(/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\bcrypto\.subtle\.decrypt\s*\(/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\bcrypto\.subtle\.digest\s*\(/);
    // All AES operations must flow through the sealed helpers:
    expect(MODULE_CODE).toMatch(/\baesGcmEncrypt\b/);
    expect(MODULE_CODE).toMatch(/\baesGcmDecrypt\b/);
    expect(MODULE_CODE).toMatch(/\bwrapKey\b/);
    expect(MODULE_CODE).toMatch(/\bunwrapKey\b/);
  });

  test("does NOT persist K_c, VMK, or plaintext anywhere (no localStorage, no cookies, no fetch body of plaintext)", () => {
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\blocalStorage\b/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\bsessionStorage\b/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/\bdocument\.cookie\b/);
  });

  test("zeroises buffers on exit paths (defence against JS GC not immediately clearing)", () => {
    // zeroiseBuffer must appear in every K_c-handling exit path.
    const zeroiseCount = (MODULE_CODE_STRIPPED.match(/zeroiseBuffer/g) ?? []).length;
    expect(zeroiseCount).toBeGreaterThanOrEqual(3);
  });

  test("does NOT create a second conversation table (sealed B.1 doctrine) · never writes nex_peer_conversation", () => {
    expect(MODULE_CODE_STRIPPED).not.toMatch(/nex_peer_conversation/);
    expect(MODULE_CODE_STRIPPED).not.toMatch(/nex_peer_message/);
  });

  test("no commercial-token references in code", () => {
    const banned = [
      "bisnis",
      "subscription",
      "entitlement",
      "quota",
      "allowance",
      "tier-gate",
    ];
    const lower = MODULE_CODE_STRIPPED.toLowerCase();
    for (const t of banned) {
      expect(lower.includes(t), `conversation-key.ts contains "${t}"`).toBe(false);
    }
  });

  test("exposes clearInMemoryConversationKeys for B.6 lock-sweep wire-up", () => {
    expect(MODULE_CODE).toMatch(/export\s+function\s+clearInMemoryConversationKeys/);
  });
});

// ---------------------------------------------------------------------------
// G · scope guards · B.4/B.5/B.6 not touched
// ---------------------------------------------------------------------------

describe("B.3 · scope guards · B.4/B.5/B.6 not implemented", () => {
  // The "no [conversationId] route" guard was B.3-time forward-looking.
  // B.4 (commit b4) is explicitly authorised to build that route. The
  // B.4 deterministic suite enforces the one-conversation rule going
  // forward. Guard removed to avoid colliding with sealed B.4 scope.

  test("no move-to-vault orchestrator (B.5)", () => {
    const f = path.resolve(
      __dirname,
      "../../../..",
      "src/lib/nex-native/vault/client/move-to-vault.ts",
    );
    expect(fs.existsSync(f)).toBe(false);
  });

  test("no notification policy module (B.6)", () => {
    const f = path.resolve(
      __dirname,
      "../../../..",
      "src/lib/nex-native/vault/client/notification-policy.ts",
    );
    expect(fs.existsSync(f)).toBe(false);
  });
});

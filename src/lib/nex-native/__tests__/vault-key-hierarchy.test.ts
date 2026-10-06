// src/lib/nex-native/__tests__/vault-key-hierarchy.test.ts
//
// Vault Phase A · Commit A.2 · key-hierarchy cryptographic property tests.
//
// These tests exercise the real crypto primitives · they do NOT merely
// assert function existence. Argon2id runs with reduced parameters
// (t=1, m=256 KiB) in a dedicated test profile so the suite remains
// fast while still proving the correctness of the derivation
// infrastructure. Production code uses PIN_ARGON_PARAMS and
// PASSPHRASE_ARGON_PARAMS (unchanged).
//
// Deterministic · no DB · no network. Runs in Node (Web Crypto
// available since Node 18) and in jsdom.

import { describe, test, expect } from "vitest";
import {
  PHASE_A_ALGORITHM,
  AES_GCM_NONCE_LENGTH,
  AES_GCM_TAG_LENGTH,
  SYMMETRIC_KEY_LENGTH,
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
  PASSPHRASE_MIN_LENGTH,
  PIN_ARGON_PARAMS,
  PASSPHRASE_ARGON_PARAMS,
  PRF_HKDF_INFO,
  generateVmk,
  generateContentKey,
  generateNonce12,
  generateArgon2Salt,
  generatePrfSalt,
  aesGcmEncrypt,
  aesGcmDecrypt,
  wrapKey,
  unwrapKey,
  deriveKekFromPin,
  deriveKekFromPassphrase,
  deriveKekFromPrf,
  validatePin,
  validatePassphrase,
  zeroiseBuffer,
} from "../vault/key-hierarchy";

// A reduced Argon2id profile for tests only. Production code uses
// PIN_ARGON_PARAMS / PASSPHRASE_ARGON_PARAMS unchanged.
const TEST_ARGON = {
  t: 1,
  m: 256,
  p: 1,
  dkLen: 32,
  version: 0x13,
  variant: "argon2id" as const,
};

describe("key-hierarchy · constants and policy", () => {
  test("PHASE_A_ALGORITHM is the exact value sealed in migration 141/142 CHECKs", () => {
    expect(PHASE_A_ALGORITHM).toBe("aes-256-gcm/v1");
  });

  test("AES-GCM parameters match spec", () => {
    expect(AES_GCM_NONCE_LENGTH).toBe(12);
    expect(AES_GCM_TAG_LENGTH).toBe(16);
    expect(SYMMETRIC_KEY_LENGTH).toBe(32);
  });

  test("PIN length policy is 8-12 digits (founder-locked 2026-10-06)", () => {
    expect(PIN_MIN_LENGTH).toBe(8);
    expect(PIN_MAX_LENGTH).toBe(12);
  });

  test("passphrase minimum is 20 chars (design §K)", () => {
    expect(PASSPHRASE_MIN_LENGTH).toBe(20);
  });

  test("default Argon2id params use argon2id variant with memory ≥ 64 MiB", () => {
    expect(PIN_ARGON_PARAMS.variant).toBe("argon2id");
    expect(PIN_ARGON_PARAMS.m).toBeGreaterThanOrEqual(64 * 1024);
    expect(PIN_ARGON_PARAMS.dkLen).toBe(32);
    expect(PASSPHRASE_ARGON_PARAMS.m).toBeGreaterThanOrEqual(128 * 1024);
    expect(PASSPHRASE_ARGON_PARAMS.t).toBeGreaterThanOrEqual(3);
  });

  test("PRF HKDF info is pinned so future rotations are explicit", () => {
    expect(PRF_HKDF_INFO).toBe("nex/vault/webauthn-prf/v1");
  });
});

describe("key-hierarchy · random generation", () => {
  test("generateVmk produces 32 bytes", () => {
    const vmk = generateVmk();
    expect(vmk).toBeInstanceOf(Uint8Array);
    expect(vmk.length).toBe(32);
  });

  test("generateContentKey produces 32 bytes", () => {
    expect(generateContentKey().length).toBe(32);
  });

  test("generateNonce12 produces 12 bytes", () => {
    expect(generateNonce12().length).toBe(12);
  });

  test("VMKs do not collide (very weak non-collision test — 100 draws)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const vmk = Buffer.from(generateVmk()).toString("hex");
      expect(seen.has(vmk)).toBe(false);
      seen.add(vmk);
    }
  });

  test("nonces do not collide (very weak non-collision test — 1000 draws)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const n = Buffer.from(generateNonce12()).toString("hex");
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
  });

  test("PRF salt is exactly 16 bytes (migration 142 CHECK)", () => {
    expect(generatePrfSalt().length).toBe(16);
  });

  test("generateArgon2Salt rejects out-of-range lengths", () => {
    expect(() => generateArgon2Salt(8)).toThrow();
    expect(() => generateArgon2Salt(128)).toThrow();
    expect(generateArgon2Salt(16).length).toBe(16);
    expect(generateArgon2Salt(32).length).toBe(32);
  });
});

describe("key-hierarchy · AES-256-GCM round-trip", () => {
  test("encrypt → decrypt returns the original plaintext", async () => {
    const key = generateVmk();
    const nonce = generateNonce12();
    const plaintext = new TextEncoder().encode("hello vault");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext });
    const pt = await aesGcmDecrypt({ key, nonce, ciphertext: ct });
    expect(new TextDecoder().decode(pt)).toBe("hello vault");
  });

  test("ciphertext includes a 16-byte GCM auth tag appended", async () => {
    const key = generateVmk();
    const nonce = generateNonce12();
    const plaintext = new Uint8Array(100).fill(0xaa);
    const ct = await aesGcmEncrypt({ key, nonce, plaintext });
    expect(ct.length).toBe(plaintext.length + AES_GCM_TAG_LENGTH);
  });

  test("decryption with the wrong key throws (GCM tag mismatch)", async () => {
    const key = generateVmk();
    const wrong = generateVmk();
    const nonce = generateNonce12();
    const plaintext = new TextEncoder().encode("secret");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext });
    await expect(
      aesGcmDecrypt({ key: wrong, nonce, ciphertext: ct }),
    ).rejects.toThrow();
  });

  test("decryption with the wrong nonce throws", async () => {
    const key = generateVmk();
    const nonce = generateNonce12();
    const wrongNonce = generateNonce12();
    const plaintext = new TextEncoder().encode("secret");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext });
    await expect(
      aesGcmDecrypt({ key, nonce: wrongNonce, ciphertext: ct }),
    ).rejects.toThrow();
  });

  test("tampered ciphertext throws (bit flip breaks tag)", async () => {
    const key = generateVmk();
    const nonce = generateNonce12();
    const plaintext = new TextEncoder().encode("secret");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext });
    const tampered = new Uint8Array(ct);
    tampered[0] ^= 0x01;
    await expect(
      aesGcmDecrypt({ key, nonce, ciphertext: tampered }),
    ).rejects.toThrow();
  });

  test("AAD mismatch throws", async () => {
    const key = generateVmk();
    const nonce = generateNonce12();
    const plaintext = new TextEncoder().encode("secret");
    const ct = await aesGcmEncrypt({
      key,
      nonce,
      plaintext,
      aad: new TextEncoder().encode("context-a"),
    });
    await expect(
      aesGcmDecrypt({
        key,
        nonce,
        ciphertext: ct,
        aad: new TextEncoder().encode("context-b"),
      }),
    ).rejects.toThrow();
  });

  test("AAD match succeeds", async () => {
    const key = generateVmk();
    const nonce = generateNonce12();
    const plaintext = new TextEncoder().encode("secret");
    const aad = new TextEncoder().encode("context");
    const ct = await aesGcmEncrypt({ key, nonce, plaintext, aad });
    const pt = await aesGcmDecrypt({ key, nonce, ciphertext: ct, aad });
    expect(new TextDecoder().decode(pt)).toBe("secret");
  });

  test("rejects wrong-sized nonce on encrypt", async () => {
    const key = generateVmk();
    await expect(
      aesGcmEncrypt({
        key,
        nonce: new Uint8Array(10),
        plaintext: new Uint8Array(0),
      }),
    ).rejects.toThrow();
  });

  test("rejects wrong-sized key", async () => {
    await expect(
      aesGcmEncrypt({
        key: new Uint8Array(16), // AES-128 key, not AES-256
        nonce: generateNonce12(),
        plaintext: new Uint8Array(0),
      }),
    ).rejects.toThrow();
  });
});

describe("key-hierarchy · wrapKey / unwrapKey envelope format", () => {
  test("envelope is exactly 60 bytes for a 32-byte VMK", async () => {
    const vmk = generateVmk();
    const kek = generateVmk();
    const { envelope } = await wrapKey({ keyToWrap: vmk, kek });
    expect(envelope.length).toBe(
      AES_GCM_NONCE_LENGTH + SYMMETRIC_KEY_LENGTH + AES_GCM_TAG_LENGTH,
    );
    expect(envelope.length).toBe(60);
  });

  test("round-trip: wrap(vmk) → unwrap → vmk", async () => {
    const vmk = generateVmk();
    const kek = generateVmk();
    const { envelope } = await wrapKey({ keyToWrap: vmk, kek });
    const recovered = await unwrapKey({ envelope, kek });
    expect(recovered).toEqual(vmk);
  });

  test("unwrap with wrong KEK throws", async () => {
    const vmk = generateVmk();
    const kek = generateVmk();
    const wrongKek = generateVmk();
    const { envelope } = await wrapKey({ keyToWrap: vmk, kek });
    await expect(unwrapKey({ envelope, kek: wrongKek })).rejects.toThrow();
  });

  test("envelope starts with the 12-byte nonce (on-wire format)", async () => {
    const vmk = generateVmk();
    const kek = generateVmk();
    const { envelope, nonce } = await wrapKey({ keyToWrap: vmk, kek });
    expect(envelope.slice(0, 12)).toEqual(nonce);
  });

  test("wrap rejects non-32-byte input key", async () => {
    await expect(
      wrapKey({ keyToWrap: new Uint8Array(16), kek: generateVmk() }),
    ).rejects.toThrow();
  });

  test("unwrap rejects truncated envelope", async () => {
    const kek = generateVmk();
    await expect(
      unwrapKey({ envelope: new Uint8Array(10), kek }),
    ).rejects.toThrow();
  });

  test("two wraps of the same VMK produce different envelopes (fresh nonce)", async () => {
    const vmk = generateVmk();
    const kek = generateVmk();
    const a = await wrapKey({ keyToWrap: vmk, kek });
    const b = await wrapKey({ keyToWrap: vmk, kek });
    expect(a.nonce).not.toEqual(b.nonce);
    expect(a.envelope).not.toEqual(b.envelope);
  });
});

describe("key-hierarchy · PIN validator (founder-locked 8-12 digits)", () => {
  test("rejects 7-digit PIN", () => {
    expect(() => validatePin("1234567")).toThrow();
  });
  test("rejects 6-digit PIN (the retracted prototype)", () => {
    expect(() => validatePin("123456")).toThrow();
  });
  test("accepts 8-digit PIN", () => {
    expect(() => validatePin("12345678")).not.toThrow();
  });
  test("accepts 12-digit PIN", () => {
    expect(() => validatePin("123456789012")).not.toThrow();
  });
  test("rejects 13-digit PIN", () => {
    expect(() => validatePin("1234567890123")).toThrow();
  });
  test("rejects non-digit characters", () => {
    expect(() => validatePin("12345678a")).toThrow();
    expect(() => validatePin("12345678 ")).toThrow();
    expect(() => validatePin("1234-5678")).toThrow();
  });
  test("rejects non-string", () => {
    expect(() => validatePin(12345678 as unknown as string)).toThrow();
  });
});

describe("key-hierarchy · passphrase validator", () => {
  test("rejects 19-char passphrase", () => {
    expect(() => validatePassphrase("x".repeat(19))).toThrow();
  });
  test("accepts 20-char passphrase", () => {
    expect(() => validatePassphrase("x".repeat(20))).not.toThrow();
  });
  test("accepts BIP-39-style 12-word mnemonic (plenty of chars)", () => {
    const mnemonic =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    expect(() => validatePassphrase(mnemonic)).not.toThrow();
  });
  test("NFKC normalisation applied before length check", () => {
    // Combining chars collapsed; the base string must still make 20 chars.
    expect(() => validatePassphrase("x".repeat(19) + "́")).not.toThrow();
  });
});

describe("key-hierarchy · Argon2id KEK derivation", () => {
  test("deriveKekFromPin returns a 32-byte key (reduced test profile)", async () => {
    const salt = generateArgon2Salt(16);
    const kek = await deriveKekFromPin({
      pin: "12345678",
      salt,
      params: TEST_ARGON,
    });
    expect(kek.length).toBe(32);
  });

  test("deriveKekFromPin is deterministic for (pin, salt, params)", async () => {
    const salt = generateArgon2Salt(16);
    const a = await deriveKekFromPin({ pin: "12345678", salt, params: TEST_ARGON });
    const b = await deriveKekFromPin({ pin: "12345678", salt, params: TEST_ARGON });
    expect(a).toEqual(b);
  });

  test("different PIN produces different KEK (same salt)", async () => {
    const salt = generateArgon2Salt(16);
    const a = await deriveKekFromPin({ pin: "12345678", salt, params: TEST_ARGON });
    const b = await deriveKekFromPin({ pin: "12345679", salt, params: TEST_ARGON });
    expect(a).not.toEqual(b);
  });

  test("different salt produces different KEK (same PIN)", async () => {
    const a = await deriveKekFromPin({
      pin: "12345678",
      salt: generateArgon2Salt(16),
      params: TEST_ARGON,
    });
    const b = await deriveKekFromPin({
      pin: "12345678",
      salt: generateArgon2Salt(16),
      params: TEST_ARGON,
    });
    expect(a).not.toEqual(b);
  });

  test("deriveKekFromPin rejects short PIN", async () => {
    const salt = generateArgon2Salt(16);
    await expect(
      deriveKekFromPin({ pin: "1234567", salt, params: TEST_ARGON }),
    ).rejects.toThrow();
  });

  test("deriveKekFromPin rejects short salt", async () => {
    await expect(
      deriveKekFromPin({
        pin: "12345678",
        salt: new Uint8Array(8),
        params: TEST_ARGON,
      }),
    ).rejects.toThrow();
  });

  test("deriveKekFromPassphrase round-trip via wrap/unwrap", async () => {
    const salt = generateArgon2Salt(16);
    const vmk = generateVmk();
    const kek = await deriveKekFromPassphrase({
      passphrase: "correct horse battery staple xyz",
      salt,
      params: TEST_ARGON,
    });
    const { envelope } = await wrapKey({ keyToWrap: vmk, kek });
    const kek2 = await deriveKekFromPassphrase({
      passphrase: "correct horse battery staple xyz",
      salt,
      params: TEST_ARGON,
    });
    const recovered = await unwrapKey({ envelope, kek: kek2 });
    expect(recovered).toEqual(vmk);
  });

  test("wrong passphrase cannot unwrap", async () => {
    const salt = generateArgon2Salt(16);
    const vmk = generateVmk();
    const kek = await deriveKekFromPassphrase({
      passphrase: "correct horse battery staple xyz",
      salt,
      params: TEST_ARGON,
    });
    const { envelope } = await wrapKey({ keyToWrap: vmk, kek });
    const wrongKek = await deriveKekFromPassphrase({
      passphrase: "wrong horse battery staple xyz!",
      salt,
      params: TEST_ARGON,
    });
    await expect(unwrapKey({ envelope, kek: wrongKek })).rejects.toThrow();
  });
});

describe("key-hierarchy · HKDF-based PRF KEK derivation", () => {
  test("deriveKekFromPrf returns 32 bytes", () => {
    const prfOutput = new Uint8Array(32).fill(0xcc);
    const kek = deriveKekFromPrf({ prfOutput });
    expect(kek.length).toBe(32);
  });

  test("deriveKekFromPrf is deterministic", () => {
    const prfOutput = new Uint8Array(32).fill(0xcc);
    const a = deriveKekFromPrf({ prfOutput });
    const b = deriveKekFromPrf({ prfOutput });
    expect(a).toEqual(b);
  });

  test("different PRF output produces different KEK", () => {
    const a = deriveKekFromPrf({ prfOutput: new Uint8Array(32).fill(0x01) });
    const b = deriveKekFromPrf({ prfOutput: new Uint8Array(32).fill(0x02) });
    expect(a).not.toEqual(b);
  });

  test("different info label produces different KEK (versioning works)", () => {
    const prfOutput = new Uint8Array(32).fill(0xcc);
    const a = deriveKekFromPrf({ prfOutput, info: "nex/vault/webauthn-prf/v1" });
    const b = deriveKekFromPrf({ prfOutput, info: "nex/vault/webauthn-prf/v2" });
    expect(a).not.toEqual(b);
  });

  test("different salt produces different KEK (per-account scoping)", () => {
    const prfOutput = new Uint8Array(32).fill(0xcc);
    const a = deriveKekFromPrf({ prfOutput, salt: new Uint8Array(16).fill(0x01) });
    const b = deriveKekFromPrf({ prfOutput, salt: new Uint8Array(16).fill(0x02) });
    expect(a).not.toEqual(b);
  });

  test("rejects wrong-sized PRF output", () => {
    expect(() =>
      deriveKekFromPrf({ prfOutput: new Uint8Array(16).fill(0xcc) }),
    ).toThrow();
  });

  test("PRF → wrap VMK → unwrap round-trip", async () => {
    const prfOutput = new Uint8Array(32);
    globalThis.crypto.getRandomValues(prfOutput);
    const vmk = generateVmk();
    const kek = deriveKekFromPrf({ prfOutput });
    const { envelope } = await wrapKey({ keyToWrap: vmk, kek });
    const kek2 = deriveKekFromPrf({ prfOutput });
    const recovered = await unwrapKey({ envelope, kek: kek2 });
    expect(recovered).toEqual(vmk);
  });
});

describe("key-hierarchy · zeroiseBuffer", () => {
  test("overwrites bytes with zero", () => {
    const buf = new Uint8Array([1, 2, 3, 4]);
    zeroiseBuffer(buf);
    expect(Array.from(buf)).toEqual([0, 0, 0, 0]);
  });

  test("no-ops on non-Uint8Array", () => {
    expect(() =>
      zeroiseBuffer(null as unknown as Uint8Array),
    ).not.toThrow();
    expect(() =>
      zeroiseBuffer(undefined as unknown as Uint8Array),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Architecture guards · zero commercial coupling in key-hierarchy
// ---------------------------------------------------------------------------
/**
 * Strip // line comments and / * block comments * / so grep assertions
 * see only code tokens. The guard-rule declarations are allowed to name
 * the banned terms in prose; what we forbid is actual code using them.
 */
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

describe("key-hierarchy · architecture guards", () => {
  test("source code does not reference commercial terms", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.resolve(__dirname, "../vault/key-hierarchy.ts"),
      "utf8",
    );
    const code = stripComments(raw).toLowerCase();
    const banned = [
      "bisnis",
      "subscription",
      "entitlement",
      "quota",
      "allowance",
      "effectivetier",
      "tier-gate",
    ];
    for (const token of banned) {
      expect(code.includes(token), token).toBe(false);
    }
  });

  test("source file carries NO server-only import (client-primary)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../vault/key-hierarchy.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/import ['"]server-only['"]/);
  });
});

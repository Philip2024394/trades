// src/lib/nex/private/crypto.test.ts
//
// NEX Y-P3 · Client-side crypto contract tests
// Philip 2026-09-07
//
// Runs against Node's built-in Web Crypto (Node 20+). No jsdom needed.
// Every test is a functional invariant of the encryption boundary:
//   · round-trips work
//   · tampering fails authenticated decryption
//   · wrong password unwrap fails
//   · IVs are unique across a large batch
//   · never-log invariant (spy on console methods · secrets absent)
//
// If any of these break the encryption boundary is broken.

import { describe, it, expect, vi } from "vitest";
import {
  generateDek,
  generateSalt,
  generateIv,
  deriveKek,
  wrapDek,
  unwrapDek,
  encryptContent,
  decryptContent,
  bytesToBase64,
  base64ToBytes,
  NEX_IV_BYTES,
  NEX_SALT_BYTES,
  NEX_KDF_ITERATIONS_DEFAULT,
  NEX_KDF_ITERATIONS_MIN,
} from "./crypto";

describe("nex/private/crypto · random material", () => {
  it("generateSalt returns 32 bytes", () => {
    const s = generateSalt();
    expect(s).toBeInstanceOf(Uint8Array);
    expect(s.length).toBe(NEX_SALT_BYTES);
  });
  it("generateIv returns 12 bytes", () => {
    const iv = generateIv();
    expect(iv.length).toBe(NEX_IV_BYTES);
  });
  it("100 IVs are all distinct", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(bytesToBase64(generateIv()));
    expect(set.size).toBe(100);
  });
  it("100 salts are all distinct", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(bytesToBase64(generateSalt()));
    expect(set.size).toBe(100);
  });
});

describe("nex/private/crypto · KEK derivation", () => {
  it("deriveKek returns a usable AES-GCM key", async () => {
    const salt = generateSalt();
    // Reduce iterations for test speed — production defaults to 600k. Use
    // NEX_KDF_ITERATIONS_MIN to remain in the DB-CHECK-valid range.
    const kek = await deriveKek("correct-horse-battery-staple", salt, NEX_KDF_ITERATIONS_MIN);
    expect(kek).toBeDefined();
    expect(kek.type).toBe("secret");
    expect(kek.algorithm.name).toBe("AES-GCM");
  });

  it("deriveKek is deterministic given same password + salt + iterations", async () => {
    const salt = generateSalt();
    const password = "same-password-across-runs";
    // We can't extract two KEKs and compare (deriveKek returns non-extractable
    // keys by design). Instead prove determinism by using KEK #1 to wrap a
    // DEK and KEK #2 to unwrap it — should succeed iff both KEKs match.
    const kek1 = await deriveKek(password, salt, NEX_KDF_ITERATIONS_MIN);
    const kek2 = await deriveKek(password, salt, NEX_KDF_ITERATIONS_MIN);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek1);
    const unwrapped = await unwrapDek(wrapped.wrapped, wrapped.wrap_iv, kek2);
    expect(unwrapped.type).toBe("secret");
  });

  it("deriveKek rejects short salts", async () => {
    await expect(deriveKek("pw", new Uint8Array(8), NEX_KDF_ITERATIONS_MIN)).rejects.toThrow(/salt/i);
  });
  it("deriveKek rejects too-few iterations", async () => {
    await expect(deriveKek("pw", generateSalt(), 1_000)).rejects.toThrow(/iterations/i);
  });
  it("deriveKek rejects empty password", async () => {
    await expect(deriveKek("", generateSalt(), NEX_KDF_ITERATIONS_MIN)).rejects.toThrow(/password/i);
  });
  it("NEX_KDF_ITERATIONS_DEFAULT is at least the OWASP-2023 minimum (600k)", () => {
    expect(NEX_KDF_ITERATIONS_DEFAULT).toBeGreaterThanOrEqual(600_000);
  });
});

describe("nex/private/crypto · DEK wrap round-trip", () => {
  it("wraps and unwraps a DEK with the same KEK", async () => {
    const salt = generateSalt();
    const kek = await deriveKek("wrap-round-trip-pw", salt, NEX_KDF_ITERATIONS_MIN);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek);
    expect(wrapped.wrapped).toBeInstanceOf(Uint8Array);
    expect(wrapped.wrap_iv.length).toBe(12);
    // Ciphertext must not be the raw DEK (would mean no encryption happened).
    expect(wrapped.wrapped.length).toBeGreaterThan(32);
    const unwrapped = await unwrapDek(wrapped.wrapped, wrapped.wrap_iv, kek);
    // Prove the unwrapped DEK actually works by encrypting + decrypting.
    const { ciphertext, iv } = await encryptContent("hello via unwrapped DEK", unwrapped);
    const plain = await decryptContent(ciphertext, iv, unwrapped);
    expect(plain).toBe("hello via unwrapped DEK");
  });

  it("unwrap fails with the WRONG password (wrong KEK)", async () => {
    const salt = generateSalt();
    const kekRight = await deriveKek("the-real-password", salt, NEX_KDF_ITERATIONS_MIN);
    const kekWrong = await deriveKek("guess-of-the-password", salt, NEX_KDF_ITERATIONS_MIN);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kekRight);
    await expect(unwrapDek(wrapped.wrapped, wrapped.wrap_iv, kekWrong)).rejects.toThrow();
  });

  it("unwrap fails when wrapped bytes have been TAMPERED", async () => {
    const salt = generateSalt();
    const kek = await deriveKek("wrap-tamper-pw", salt, NEX_KDF_ITERATIONS_MIN);
    const dek = await generateDek();
    const { wrapped, wrap_iv } = await wrapDek(dek, kek);
    const tampered = new Uint8Array(wrapped);
    tampered[0] = tampered[0] ^ 0xff;
    await expect(unwrapDek(tampered, wrap_iv, kek)).rejects.toThrow();
  });

  it("unwrap fails when wrap_iv is wrong length", async () => {
    const salt = generateSalt();
    const kek = await deriveKek("wrap-ivlen-pw", salt, NEX_KDF_ITERATIONS_MIN);
    const dek = await generateDek();
    const { wrapped } = await wrapDek(dek, kek);
    await expect(unwrapDek(wrapped, new Uint8Array(10), kek)).rejects.toThrow(/wrap_iv/);
  });
});

describe("nex/private/crypto · content encryption round-trip", () => {
  it("encrypts and decrypts a plaintext round-trip", async () => {
    const dek = await generateDek();
    const plaintext = "NEX private note · unicode ok · 你好 · 🔒";
    const { ciphertext, iv } = await encryptContent(plaintext, dek);
    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(iv.length).toBe(12);
    expect(new TextDecoder().decode(ciphertext).includes(plaintext)).toBe(false); // ciphertext must NOT contain plaintext
    const decrypted = await decryptContent(ciphertext, iv, dek);
    expect(decrypted).toBe(plaintext);
  });

  it("decryption fails when the CIPHERTEXT has been tampered", async () => {
    const dek = await generateDek();
    const { ciphertext, iv } = await encryptContent("mutually agreed message", dek);
    const tampered = new Uint8Array(ciphertext);
    tampered[Math.floor(tampered.length / 2)] = tampered[Math.floor(tampered.length / 2)] ^ 0x01;
    await expect(decryptContent(tampered, iv, dek)).rejects.toThrow();
  });

  it("decryption fails when the IV has been tampered", async () => {
    const dek = await generateDek();
    const { ciphertext, iv } = await encryptContent("hello", dek);
    const wrongIv = new Uint8Array(iv);
    wrongIv[0] = wrongIv[0] ^ 0xff;
    await expect(decryptContent(ciphertext, wrongIv, dek)).rejects.toThrow();
  });

  it("decryption fails with a DIFFERENT DEK", async () => {
    const dekA = await generateDek();
    const dekB = await generateDek();
    const { ciphertext, iv } = await encryptContent("secret A", dekA);
    await expect(decryptContent(ciphertext, iv, dekB)).rejects.toThrow();
  });

  it("encrypt rejects a non-string plaintext", async () => {
    const dek = await generateDek();
    // @ts-expect-error deliberate misuse
    await expect(encryptContent(123, dek)).rejects.toThrow(/string/i);
  });
});

describe("nex/private/crypto · never-log invariant", () => {
  it("does not log the password, salt, DEK, wrapped_dek, iv, or ciphertext to console during a full flow", async () => {
    const spies = {
      log:  vi.spyOn(console, "log").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };
    try {
      const password = "never-log-me-XYZ-9911";
      const salt = generateSalt();
      const kek = await deriveKek(password, salt, NEX_KDF_ITERATIONS_MIN);
      const dek = await generateDek();
      const wrapped = await wrapDek(dek, kek);
      const enc = await encryptContent("secret plaintext body", dek);
      const kek2 = await deriveKek(password, salt, NEX_KDF_ITERATIONS_MIN);
      const dek2 = await unwrapDek(wrapped.wrapped, wrapped.wrap_iv, kek2);
      const plain = await decryptContent(enc.ciphertext, enc.iv, dek2);
      expect(plain).toBe("secret plaintext body");

      // Collect every string ever passed to console during the flow.
      const captured = ([] as unknown[])
        .concat(...spies.log.mock.calls)
        .concat(...spies.info.mock.calls)
        .concat(...spies.warn.mock.calls)
        .concat(...spies.error.mock.calls)
        .concat(...spies.debug.mock.calls)
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join(" | ");

      expect(captured).not.toContain(password);
      expect(captured).not.toContain("secret plaintext body");
      expect(captured).not.toContain(bytesToBase64(salt));
      expect(captured).not.toContain(bytesToBase64(wrapped.wrapped));
      expect(captured).not.toContain(bytesToBase64(enc.ciphertext));
      expect(captured).not.toContain(bytesToBase64(enc.iv));
    } finally {
      spies.log.mockRestore();
      spies.info.mockRestore();
      spies.warn.mockRestore();
      spies.error.mockRestore();
      spies.debug.mockRestore();
    }
  });
});

describe("nex/private/crypto · base64 helpers", () => {
  it("bytesToBase64 / base64ToBytes round-trip", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 254, 255]);
    const b64 = bytesToBase64(bytes);
    const back = base64ToBytes(b64);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });
  it("base64 handles empty bytes", () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
    expect(base64ToBytes("").length).toBe(0);
  });
});

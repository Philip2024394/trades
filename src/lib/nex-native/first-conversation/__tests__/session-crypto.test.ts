// src/lib/nex-native/first-conversation/__tests__/session-crypto.test.ts
//
// Bridge 99 · Stage 4a · session-crypto unit tests.
// Exercises every sealed §7 validity condition that the pure crypto
// layer is responsible for (signature + expiry + shape).

import { describe, it, expect } from "vitest";
import {
  assertSessionCryptoConfig,
  generateSessionId,
  signSessionToken,
  verifySessionToken,
  type NexSessionCryptoConfig,
  type NexSessionPayload,
} from "../session-crypto";

const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // 32 chars
const KEY_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const KEY_C = "cccccccccccccccccccccccccccccccc";

const cfg = (activeKey: string, accepted: string[]): NexSessionCryptoConfig => ({
  activeKey,
  acceptedKeys: accepted,
});

function makePayload(
  overrides: Partial<NexSessionPayload> = {},
): NexSessionPayload {
  return {
    account_id: "11111111-1111-4111-8111-111111111111",
    session_id: "22222222-2222-4222-8222-222222222222",
    issued_at_ms: 1_000_000,
    expires_at_ms: 2_000_000,
    ...overrides,
  };
}

describe("assertSessionCryptoConfig", () => {
  it("accepts a valid config", () => {
    expect(() => assertSessionCryptoConfig(cfg(KEY_A, [KEY_A]))).not.toThrow();
    expect(() =>
      assertSessionCryptoConfig(cfg(KEY_A, [KEY_A, KEY_B])),
    ).not.toThrow();
  });

  it("rejects short active key", () => {
    expect(() =>
      assertSessionCryptoConfig({
        activeKey: "shortkey",
        acceptedKeys: ["shortkey"],
      }),
    ).toThrow(/at least 32/);
  });

  it("rejects missing active key from accepted list", () => {
    expect(() => assertSessionCryptoConfig(cfg(KEY_A, [KEY_B]))).toThrow(
      /activeKey must be present in acceptedKeys/,
    );
  });

  it("rejects empty accepted list", () => {
    expect(() => assertSessionCryptoConfig(cfg(KEY_A, []))).toThrow(
      /non-empty array/,
    );
  });

  it("rejects a short accepted key", () => {
    expect(() =>
      assertSessionCryptoConfig(cfg(KEY_A, [KEY_A, "short"])),
    ).toThrow(/at least 32/);
  });
});

describe("signSessionToken + verifySessionToken · roundtrip", () => {
  it("returns the original payload for a self-signed token", () => {
    const c = cfg(KEY_A, [KEY_A]);
    const p = makePayload();
    const token = signSessionToken(p, c);
    const r = verifySessionToken(token, c, 1_500_000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toEqual(p);
  });

  it("produces a stable two-part token shape", () => {
    const token = signSessionToken(makePayload(), cfg(KEY_A, [KEY_A]));
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    // base64url · no '=' padding, no '+' or '/'
    expect(token).not.toMatch(/[=+/]/);
  });

  it("rejects payloads with invalid UUID shape at sign time", () => {
    expect(() =>
      signSessionToken(
        makePayload({ account_id: "not-a-uuid" }),
        cfg(KEY_A, [KEY_A]),
      ),
    ).toThrow(/invalid payload shape/);
  });

  it("rejects payloads where expires_at <= issued_at at sign time", () => {
    expect(() =>
      signSessionToken(
        makePayload({ issued_at_ms: 2000, expires_at_ms: 2000 }),
        cfg(KEY_A, [KEY_A]),
      ),
    ).toThrow(/invalid payload shape/);
  });
});

describe("verifySessionToken · structural failures", () => {
  const c = cfg(KEY_A, [KEY_A]);

  it("rejects empty string", () => {
    const r = verifySessionToken("", c);
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects token missing dot", () => {
    const r = verifySessionToken("abc", c);
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects token with too many dots", () => {
    const r = verifySessionToken("a.b.c", c);
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects token with empty signature", () => {
    const r = verifySessionToken("payload.", c);
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects token with empty payload half", () => {
    const r = verifySessionToken(".sig", c);
    expect(r).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("verifySessionToken · tamper detection", () => {
  it("rejects a token whose payload was flipped", () => {
    const c = cfg(KEY_A, [KEY_A]);
    const token = signSessionToken(makePayload(), c);
    const [enc, sig] = token.split(".");
    // Flip a character in the encoded payload
    const flipped =
      enc.slice(0, 2) + (enc[2] === "a" ? "b" : "a") + enc.slice(3) + "." + sig;
    const r = verifySessionToken(flipped, c, 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_signature");
  });

  it("rejects a token whose signature was flipped", () => {
    const c = cfg(KEY_A, [KEY_A]);
    const token = signSessionToken(makePayload(), c);
    const [enc, sig] = token.split(".");
    const flippedSig =
      sig.slice(0, 2) + (sig[2] === "a" ? "b" : "a") + sig.slice(3);
    const r = verifySessionToken(`${enc}.${flippedSig}`, c, 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_signature");
  });

  it("rejects a token signed with a key not in acceptedKeys", () => {
    const signCfg = cfg(KEY_C, [KEY_C]);
    const verifyCfg = cfg(KEY_A, [KEY_A, KEY_B]);
    const token = signSessionToken(makePayload(), signCfg);
    const r = verifySessionToken(token, verifyCfg, 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_signature");
  });
});

describe("verifySessionToken · expiry", () => {
  const c = cfg(KEY_A, [KEY_A]);

  it("accepts a token before expiry", () => {
    const p = makePayload({ issued_at_ms: 100, expires_at_ms: 200 });
    const token = signSessionToken(p, c);
    const r = verifySessionToken(token, c, 150);
    expect(r.ok).toBe(true);
  });

  it("rejects a token exactly at expiry", () => {
    const p = makePayload({ issued_at_ms: 100, expires_at_ms: 200 });
    const token = signSessionToken(p, c);
    const r = verifySessionToken(token, c, 200);
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token past expiry", () => {
    const p = makePayload({ issued_at_ms: 100, expires_at_ms: 200 });
    const token = signSessionToken(p, c);
    const r = verifySessionToken(token, c, 5000);
    expect(r).toEqual({ ok: false, reason: "expired" });
  });
});

describe("verifySessionToken · key rotation", () => {
  it("accepts a token signed with a previous key during rotation overlap", () => {
    // Rotation scenario: previously KEY_A was active. Now KEY_B is active.
    // Both remain in acceptedKeys during the overlap window.
    const oldCfg = cfg(KEY_A, [KEY_A]);
    const newCfg = cfg(KEY_B, [KEY_B, KEY_A]);

    const p = makePayload();
    const oldToken = signSessionToken(p, oldCfg);
    const r = verifySessionToken(oldToken, newCfg, 1_500_000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toEqual(p);
  });

  it("rejects a token when the old key is dropped from acceptedKeys", () => {
    const oldCfg = cfg(KEY_A, [KEY_A]);
    const rotatedCfg = cfg(KEY_B, [KEY_B]);

    const oldToken = signSessionToken(makePayload(), oldCfg);
    const r = verifySessionToken(oldToken, rotatedCfg, 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_signature");
  });
});

describe("verifySessionToken · payload shape rejections", () => {
  const c = cfg(KEY_A, [KEY_A]);

  it("rejects a valid-signature token whose payload adds an unknown field", () => {
    // Manually construct an unknown-field token signed with our key so
    // the signature verifies but the shape check fails.
    const jsonBad = JSON.stringify({
      account_id: "11111111-1111-4111-8111-111111111111",
      session_id: "22222222-2222-4222-8222-222222222222",
      issued_at_ms: 1000,
      expires_at_ms: 2000,
      injected: "extra",
    });
    const enc = Buffer.from(jsonBad, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const { createHmac } = require("node:crypto");
    const sig = createHmac("sha256", KEY_A)
      .update(enc, "utf8")
      .digest()
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `${enc}.${sig}`;
    const r = verifySessionToken(token, c, 1500);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_payload");
  });

  it("rejects a valid-signature token whose payload has non-UUID account_id", () => {
    const jsonBad = JSON.stringify({
      account_id: "not-a-uuid",
      session_id: "22222222-2222-4222-8222-222222222222",
      issued_at_ms: 1000,
      expires_at_ms: 2000,
    });
    const enc = Buffer.from(jsonBad, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const { createHmac } = require("node:crypto");
    const sig = createHmac("sha256", KEY_A)
      .update(enc, "utf8")
      .digest()
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `${enc}.${sig}`;
    const r = verifySessionToken(token, c, 1500);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_payload");
  });
});

describe("generateSessionId", () => {
  it("returns a uuid v4 shape", () => {
    const id = generateSessionId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns unique values across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateSessionId());
    expect(seen.size).toBe(100);
  });
});

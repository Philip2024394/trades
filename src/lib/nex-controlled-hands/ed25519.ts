// src/lib/nex-controlled-hands/ed25519.ts
//
// Phase 8 v0.1.0 · Ed25519 signing wrapper.
// v0.1.0 IMPLEMENTATION_TIER T2: keys held in-memory · not DPAPI-backed (T3 NOT_IMPLEMENTED).
// Uses Node's built-in crypto (no external dep · deterministic · zero cloud).

import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, KeyObject } from "node:crypto";

export interface KeyPair {
  readonly key_id: string;
  readonly key_version: number;
  readonly private: KeyObject;
  readonly public: KeyObject;
  readonly public_der_hex: string;
}

let counter = 0;

export function generateKeyPair(key_id_prefix: string): KeyPair {
  counter++;
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const public_der = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  return {
    key_id: `${key_id_prefix}-${counter}`,
    key_version: 1,
    private: privateKey,
    public: publicKey,
    public_der_hex: public_der.toString("hex"),
  };
}

export function signBytes(keypair: KeyPair, message: Buffer | string): string {
  const buf = typeof message === "string" ? Buffer.from(message, "utf8") : message;
  const sig = sign(null, buf, keypair.private);
  return sig.toString("hex");
}

export function verifyBytes(publicKey: KeyObject, message: Buffer | string, signature_hex: string): boolean {
  const buf = typeof message === "string" ? Buffer.from(message, "utf8") : message;
  const sig = Buffer.from(signature_hex, "hex");
  try {
    return verify(null, buf, publicKey, sig);
  } catch { return false; }
}

export function loadPublicKeyFromDerHex(der_hex: string): KeyObject {
  return createPublicKey({ key: Buffer.from(der_hex, "hex"), format: "der", type: "spki" });
}

// src/lib/nex-native/crypto/device-key.ts
//
// Bridge 74 · Per-device keypair for E2E encryption.
// ---------------------------------------------------
// Every browser install ("device") gets one Curve25519 keypair. The
// PRIVATE key is stored in this device's IndexedDB and never leaves.
// The PUBLIC key is uploaded to nex_account_device_key so senders
// can encrypt messages addressed to (account_id, device_id).
//
// Semantics match nacl.box (crypto_box_easy): X25519 ECDH for the
// shared secret + XSalsa20-Poly1305 for authenticated encryption.
// tweetnacl is a pure-JS port of NaCl with identical byte-for-byte
// output to libsodium's crypto_box_easy.
//
// Key management:
//   · ensureDeviceKey() is idempotent · reads existing keypair from
//     IndexedDB, generates a fresh one only when absent
//   · The device_id is generated once and never rotated for this
//     browser install · clearing IndexedDB (private browsing, reset,
//     new profile) creates a new device_id + new keypair · old
//     encrypted history sent to the previous device becomes
//     un-decryptable, which is the intentional cost of device-local
//     storage
//   · No serialization of the private key outside IDB · we never
//     expose it to the DOM, to server actions, to logs

"use client";

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const DB_NAME = "nex-native-crypto";
const DB_VERSION = 1;
const STORE = "device";
const RECORD_ID = "self";

export interface NexDeviceKey {
  /** Opaque per-install token · stable across page loads · resets when
   *  IndexedDB is cleared. Uploaded alongside the public key so the
   *  server can address messages to (account_id, device_id). */
  deviceId: string;
  /** Curve25519 secret key · 32 bytes · NEVER sent over the wire. */
  secretKey: Uint8Array;
  /** Curve25519 public key · 32 bytes · uploaded to the server. */
  publicKey: Uint8Array;
  createdAt: number;
}

interface StoredRecord {
  deviceId: string;
  secretKey: Uint8Array;
  publicKey: Uint8Array;
  createdAt: number;
}

/**
 * Idempotent · returns this device's keypair. Generates a fresh one
 * on first call, reads from IDB on every subsequent call.
 */
export async function ensureDeviceKey(): Promise<NexDeviceKey> {
  const existing = await readRecord();
  if (existing) {
    return existing;
  }
  const kp = nacl.box.keyPair();
  const record: StoredRecord = {
    deviceId: generateDeviceId(),
    secretKey: kp.secretKey,
    publicKey: kp.publicKey,
    createdAt: Date.now(),
  };
  await writeRecord(record);
  return record;
}

/** Base64-encode a public key for upload / JSON transport. */
export function publicKeyBase64(pk: Uint8Array): string {
  return naclUtil.encodeBase64(pk);
}

/** Base64-decode a public key received from the server. */
export function decodePublicKey(b64: string): Uint8Array {
  return naclUtil.decodeBase64(b64);
}

/** Wipe the stored keypair · used for sign-out or "reset device"
 *  affordances. Any encrypted history addressed to this device
 *  becomes un-decryptable after this. */
export async function forgetDeviceKey(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(RECORD_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/* ------------------------------------------------------------------ *
 * IndexedDB plumbing                                                  *
 * ------------------------------------------------------------------ */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readRecord(): Promise<StoredRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<StoredRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(RECORD_ID);
      req.onsuccess = () => resolve((req.result as StoredRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function writeRecord(rec: StoredRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec, RECORD_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback · IndexedDB is a modern-browser feature so this is
  // effectively unreachable, but avoid a runtime throw.
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

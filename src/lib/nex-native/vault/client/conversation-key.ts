// src/lib/nex-native/vault/client/conversation-key.ts
//
// Vault Phase B · Commit B.3 · client-side conversation-key (K_c)
// generation, VMK-wrapped minting, memory lifecycle, and encrypted
// IndexedDB cache for Vault conversation messages.
//
// Scope (strict):
//   · Browser-only. Imports Web Crypto + IndexedDB · never runs on the
//     server (the "server-only" module would throw if imported here).
//   · Reuses the sealed Phase A key hierarchy (key-hierarchy.ts) for
//     every primitive: generateContentKey · wrapKey · unwrapKey ·
//     aesGcmEncrypt · aesGcmDecrypt · PHASE_A_ALGORITHM. We do NOT
//     reinvent any crypto.
//   · Reuses the sealed Phase A memory singleton (vault-session.ts)
//     via withVmk + readVaultSessionSnapshot. We do NOT persist VMK or
//     any derivative anywhere.
//   · Reuses the sealed Phase B.2 server routes (mint + list) for
//     opaque envelope persistence. We do NOT send plaintext K_c to the
//     server · ever.
//
// Non-scope (do not expand without founder authorisation):
//   · No automatic lock-event subscription (B.6 scope · the sealed
//     vault-session.ts does not expose a non-React subscribe hook so
//     the auto-wire-up lands when the Vault chat UI mounts in B.4+
//     via useVaultSession). This module provides the explicit
//     primitive clearInMemoryConversationKeys() that B.4+/B.6 wiring
//     will invoke. Lazy fallback: every public method consults
//     readVaultSessionSnapshot() first and fails closed when Vault
//     is locked.
//   · No UI. The dev-only /nex-native/vault/dev/b3-proof page exposes
//     this module to window for the B.3 Playwright proof only.
//   · No commercial / quota / Bisnis awareness.
//   · No message delivery · no composer · no realtime subscription.

import {
  PHASE_A_ALGORITHM,
  aesGcmDecrypt,
  aesGcmEncrypt,
  generateContentKey,
  generateNonce12,
  unwrapKey,
  wrapKey,
  zeroiseBuffer,
} from "../key-hierarchy";
import { readVaultSessionSnapshot, withVmk } from "./vault-session";

// ---------------------------------------------------------------------------
// IndexedDB plumbing · pattern mirrors src/lib/nex-native/crypto/device-key.ts
// ---------------------------------------------------------------------------

const DB_NAME = "nex-native-vault-conversations";
const DB_VERSION = 1;
const STORE = "cached_messages";
const INDEX_BY_CONV = "by_conversation";

export interface CachedMessageRecord {
  conversation_id: string;
  message_id: string;
  generation: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  algorithm: string;
  created_at: string; // ISO
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: ["conversation_id", "message_id"],
        });
        store.createIndex(INDEX_BY_CONV, ["conversation_id", "created_at"]);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(record: CachedMessageRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGet(
  conversationId: string,
  messageId: string,
): Promise<CachedMessageRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<CachedMessageRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get([conversationId, messageId]);
      req.onsuccess = () =>
        resolve((req.result as CachedMessageRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbListByConversation(
  conversationId: string,
): Promise<CachedMessageRecord[]> {
  const db = await openDb();
  try {
    return await new Promise<CachedMessageRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const index = tx.objectStore(STORE).index(INDEX_BY_CONV);
      const range = IDBKeyRange.bound(
        [conversationId, ""],
        [conversationId, "￿"],
      );
      const req = index.getAll(range);
      req.onsuccess = () => resolve((req.result as CachedMessageRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbDeleteByConversation(conversationId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const index = tx.objectStore(STORE).index(INDEX_BY_CONV);
      const range = IDBKeyRange.bound(
        [conversationId, ""],
        [conversationId, "￿"],
      );
      const cursorReq = index.openCursor(range);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Memory map: conversation_id → generation → K_c bytes
// ---------------------------------------------------------------------------

type ConvGenerationMap = Map<number, Uint8Array>;
const memoryKeys = new Map<string, ConvGenerationMap>();

function putInMemory(
  conversationId: string,
  generation: number,
  key: Uint8Array,
): void {
  let gens = memoryKeys.get(conversationId);
  if (!gens) {
    gens = new Map<number, Uint8Array>();
    memoryKeys.set(conversationId, gens);
  }
  const existing = gens.get(generation);
  if (existing) zeroiseBuffer(existing);
  // Store a copy so the caller's buffer lifecycle is decoupled.
  const copy = new Uint8Array(key.length);
  copy.set(key);
  gens.set(generation, copy);
}

function getFromMemory(
  conversationId: string,
  generation: number,
): Uint8Array | null {
  return memoryKeys.get(conversationId)?.get(generation) ?? null;
}

/**
 * Zeroises every in-memory K_c and clears the map. Must be called when
 * Vault locks (today: explicitly by callers · B.6 will add auto-wire-up
 * from vault-session's listener set). Also called by the lazy fallback
 * guard inside every public method when the Vault session reports
 * locked.
 */
export function clearInMemoryConversationKeys(): void {
  for (const gens of memoryKeys.values()) {
    for (const key of gens.values()) {
      zeroiseBuffer(key);
    }
    gens.clear();
  }
  memoryKeys.clear();
}

/** Returns the current in-memory key for (conversation, generation) or
 *  null if absent. Does NOT fetch from the server · callers that need
 *  the server-fetch path should call `ensureConversationKeyLoaded`. */
export function getConversationKeyFromMemory(
  conversationId: string,
  generation: number,
): Uint8Array | null {
  return getFromMemory(conversationId, generation);
}

/** True when the memory map has an entry for (conversation, generation). */
export function hasConversationKeyInMemory(
  conversationId: string,
  generation: number,
): boolean {
  return memoryKeys.get(conversationId)?.has(generation) ?? false;
}

// ---------------------------------------------------------------------------
// AAD · device-binding for wrap/unwrap
// ---------------------------------------------------------------------------

/**
 * Each envelope is bound to its target device by using the device_id
 * bytes as AES-GCM Additional Authenticated Data (AAD). This means a
 * wrapped K_c for Device A cannot be unwrapped on Device B · the AAD
 * mismatch causes the GCM authentication tag to fail. The B.1 migration
 * doctrine states this contract explicitly.
 */
function aadFor(targetDeviceId: string): Uint8Array {
  return new TextEncoder().encode(`nex/vault/conv-key/v1|${targetDeviceId}`);
}

// ---------------------------------------------------------------------------
// Guard · fail-closed when Vault is locked
// ---------------------------------------------------------------------------

function assertVaultUnlocked(): { ok: true } | { ok: false; error: "vault_locked" } {
  const snap = readVaultSessionSnapshot();
  if (!snap.unlocked) {
    // Lazy clear · in case the active lock happened without an explicit
    // call to clearInMemoryConversationKeys · we never want to serve
    // stale K_c material after a lock.
    clearInMemoryConversationKeys();
    return { ok: false, error: "vault_locked" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public API · provision / ensure / cache / read
// ---------------------------------------------------------------------------

export interface ProvisionResult {
  ok: true;
  envelope_id: string;
  generation: number;
}
export interface ProvisionError {
  ok: false;
  error:
    | "vault_locked"
    | "mint_failed"
    | "duplicate_active_envelope"
    | "forbidden"
    | "invalid_hex"
    | "step_up_required"
    | "unknown";
  detail?: string;
}

/**
 * Generate a fresh K_c for this conversation, wrap it under the active
 * VMK with AAD=device_id, POST the opaque envelope to B.2's mint route,
 * and park the plaintext K_c in the in-memory map. Returns the
 * generation + server-side envelope id on success.
 *
 * Intended first-time call per (account, conversation, device). On
 * subsequent sessions use `ensureConversationKeyLoaded`.
 */
export async function provisionConversationKey(input: {
  conversationId: string;
  targetDeviceId: string;
}): Promise<ProvisionResult | ProvisionError> {
  const gate = assertVaultUnlocked();
  if (!gate.ok) return { ok: false, error: "vault_locked" };

  const kC = generateContentKey(); // 32 random bytes · sealed Phase A primitive
  const aad = aadFor(input.targetDeviceId);

  const wrapOutcome = await withVmk(async (vmk) =>
    wrapKey({ keyToWrap: kC, kek: vmk, aad }),
  );
  if (!wrapOutcome) {
    zeroiseBuffer(kC);
    return { ok: false, error: "vault_locked" };
  }
  const wrap = await wrapOutcome;

  const wrappedHex = bytesToHex(wrap.envelope);
  const nonceHex = bytesToHex(wrap.nonce);
  const generation = 1;

  try {
    const res = await fetch("/api/nex-native/vault/chat/envelope/mint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversation_id: input.conversationId,
        target_device_id: input.targetDeviceId,
        wrapped_k_c_hex: wrappedHex,
        nonce_hex: nonceHex,
        algorithm: PHASE_A_ALGORITHM,
        generation,
      }),
    });
    if (!res.ok) {
      zeroiseBuffer(kC);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 403) return { ok: false, error: body.error === "step_up_required" ? "step_up_required" : "forbidden" };
      if (res.status === 409 && body.error === "duplicate_active_envelope") {
        return { ok: false, error: "duplicate_active_envelope" };
      }
      return { ok: false, error: "mint_failed", detail: body.error ?? `status_${res.status}` };
    }
    const body = (await res.json()) as { ok: boolean; envelope_id?: string; generation?: number };
    if (!body.ok || !body.envelope_id || typeof body.generation !== "number") {
      zeroiseBuffer(kC);
      return { ok: false, error: "mint_failed", detail: "malformed_response" };
    }
    putInMemory(input.conversationId, body.generation, kC);
    zeroiseBuffer(kC); // we stored a copy · zeroise the original local reference
    return { ok: true, envelope_id: body.envelope_id, generation: body.generation };
  } catch (err) {
    zeroiseBuffer(kC);
    return {
      ok: false,
      error: "mint_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * On post-unlock first access, fetch every active envelope for this
 * device via B.2's list route, unwrap each with the active VMK +
 * device-id AAD, and populate the in-memory map. Returns the number of
 * K_c keys loaded. Idempotent · safe to call every unlock.
 */
export async function ensureAllConversationKeysLoaded(input: {
  targetDeviceId: string;
}): Promise<{ ok: true; loaded: number } | { ok: false; error: "vault_locked" | "list_failed"; detail?: string }> {
  const gate = assertVaultUnlocked();
  if (!gate.ok) return { ok: false, error: "vault_locked" };

  let res: Response;
  try {
    res = await fetch(
      `/api/nex-native/vault/chat/envelope/list?device_id=${encodeURIComponent(input.targetDeviceId)}`,
      { method: "GET" },
    );
  } catch (err) {
    return {
      ok: false,
      error: "list_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    return { ok: false, error: "list_failed", detail: `status_${res.status}` };
  }
  const body = (await res.json()) as {
    ok: boolean;
    envelopes?: Array<{
      envelope_id: string;
      conversation_id: string;
      target_device_id: string;
      wrapped_k_c_hex: string;
      nonce_hex: string;
      algorithm: string;
      generation: number;
      revoked_at: string | null;
    }>;
  };
  if (!body.ok || !body.envelopes) {
    return { ok: false, error: "list_failed", detail: "malformed_response" };
  }

  let loaded = 0;
  for (const env of body.envelopes) {
    if (env.revoked_at !== null) continue;
    if (env.algorithm !== PHASE_A_ALGORITHM) continue;
    if (env.target_device_id !== input.targetDeviceId) continue;
    const wrappedBytes = hexToBytes(env.wrapped_k_c_hex);
    if (!wrappedBytes || wrappedBytes.length !== 60) continue;

    const aad = aadFor(env.target_device_id);
    const unwrapOutcome = await withVmk(async (vmk) =>
      unwrapKey({ envelope: wrappedBytes, kek: vmk, aad }),
    );
    if (!unwrapOutcome) continue; // vault locked mid-batch
    try {
      const kC = await unwrapOutcome;
      if (kC.length !== 32) {
        zeroiseBuffer(kC);
        continue;
      }
      putInMemory(env.conversation_id, env.generation, kC);
      zeroiseBuffer(kC);
      loaded += 1;
    } catch {
      // AAD mismatch or GCM tag failure · skip this envelope · it was
      // not meant for this device.
      continue;
    }
  }
  return { ok: true, loaded };
}

/**
 * Encrypt plaintext under the current K_c for (conversation, highest-
 * generation) and persist the ciphertext record to IndexedDB. Fails
 * closed if no key is in memory for this conversation.
 */
export async function cacheEncryptedMessage(input: {
  conversationId: string;
  messageId: string;
  plaintext: Uint8Array;
}): Promise<{ ok: true; generation: number } | { ok: false; error: "vault_locked" | "no_key" | "encrypt_failed"; detail?: string }> {
  const gate = assertVaultUnlocked();
  if (!gate.ok) return { ok: false, error: "vault_locked" };

  const gens = memoryKeys.get(input.conversationId);
  if (!gens || gens.size === 0) {
    return { ok: false, error: "no_key" };
  }
  const generation = Math.max(...Array.from(gens.keys()));
  const kC = gens.get(generation);
  if (!kC) return { ok: false, error: "no_key" };

  const nonce = generateNonce12();
  let ciphertext: Uint8Array;
  try {
    ciphertext = await aesGcmEncrypt({ key: kC, nonce, plaintext: input.plaintext });
  } catch (err) {
    return {
      ok: false,
      error: "encrypt_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const record: CachedMessageRecord = {
    conversation_id: input.conversationId,
    message_id: input.messageId,
    generation,
    ciphertext,
    nonce,
    algorithm: PHASE_A_ALGORITHM,
    created_at: new Date().toISOString(),
  };
  await idbPut(record);
  return { ok: true, generation };
}

export interface DecryptedMessage {
  conversationId: string;
  messageId: string;
  generation: number;
  plaintext: Uint8Array;
  created_at: string;
}

export async function readCachedMessage(input: {
  conversationId: string;
  messageId: string;
}): Promise<DecryptedMessage | { error: "vault_locked" | "not_found" | "no_key_for_generation" | "decrypt_failed"; detail?: string }> {
  const gate = assertVaultUnlocked();
  if (!gate.ok) return { error: "vault_locked" };
  const row = await idbGet(input.conversationId, input.messageId);
  if (!row) return { error: "not_found" };
  const kC = getFromMemory(row.conversation_id, row.generation);
  if (!kC) return { error: "no_key_for_generation" };
  try {
    const plaintext = await aesGcmDecrypt({
      key: kC,
      nonce: row.nonce,
      ciphertext: row.ciphertext,
    });
    return {
      conversationId: row.conversation_id,
      messageId: row.message_id,
      generation: row.generation,
      plaintext,
      created_at: row.created_at,
    };
  } catch (err) {
    return {
      error: "decrypt_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function readCachedMessages(input: {
  conversationId: string;
}): Promise<
  | { ok: true; messages: DecryptedMessage[] }
  | { ok: false; error: "vault_locked"; detail?: string }
> {
  const gate = assertVaultUnlocked();
  if (!gate.ok) return { ok: false, error: "vault_locked" };
  const rows = await idbListByConversation(input.conversationId);
  const out: DecryptedMessage[] = [];
  for (const row of rows) {
    const kC = getFromMemory(row.conversation_id, row.generation);
    if (!kC) continue; // skip rows whose K_c isn't loaded for this device
    try {
      const plaintext = await aesGcmDecrypt({
        key: kC,
        nonce: row.nonce,
        ciphertext: row.ciphertext,
      });
      out.push({
        conversationId: row.conversation_id,
        messageId: row.message_id,
        generation: row.generation,
        plaintext,
        created_at: row.created_at,
      });
    } catch {
      // undecryptable with current keys · skip silently (wrong device
      // or revoked generation).
    }
  }
  return { ok: true, messages: out };
}

export async function deleteConversationCache(input: {
  conversationId: string;
}): Promise<void> {
  await idbDeleteByConversation(input.conversationId);
  const gens = memoryKeys.get(input.conversationId);
  if (gens) {
    for (const key of gens.values()) zeroiseBuffer(key);
    gens.clear();
    memoryKeys.delete(input.conversationId);
  }
}

// ---------------------------------------------------------------------------
// Hex helpers (reused shape from B.2 validator · keeps this module self-
// contained so the server module and client module never share runtime).
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (typeof hex !== "string") return null;
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Test-only probe · opaque counts for the deterministic suite.
// ---------------------------------------------------------------------------

export function _b3TestProbe(): {
  conversations_with_key: number;
  total_keys_in_memory: number;
} {
  let total = 0;
  for (const gens of memoryKeys.values()) total += gens.size;
  return {
    conversations_with_key: memoryKeys.size,
    total_keys_in_memory: total,
  };
}

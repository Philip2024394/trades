// src/lib/nex-native/crypto/message-store.ts
//
// Bridge 77 · IndexedDB-backed local message store.
// -------------------------------------------------
// The "phone is storage" doctrine (sealed 2026-09-29) makes the
// server a transient encrypted relay — once a recipient device acks
// delivery (Bridge 76) and the retention window elapses, the Bridge
// 78 purge drops the ciphertext. This module is what keeps the
// message history alive on THIS device after that.
//
// Called by:
//   · _e2e-decryptor.tsx — writes a cache row for every message it
//     successfully decrypts (fire-and-forget after DOM replacement)
//   · Bridge 79 (future) — reads the cache first on peer-chat mount,
//     merges server rows, produces the visible message list
//
// Storage layout: one object store `messages`, primary key is the
// message id (server-assigned uuid). A secondary index on
// `conversation_id` supports the per-conversation range read.
//
// This store is intentionally SEPARATE from the device-key store
// (Bridge 74) so that clearing the message cache during a "forget
// history" affordance doesn't wipe the device keys.

"use client";

const DB_NAME = "nex-native-messages";
const DB_VERSION = 1;
const STORE = "messages";
const IDX_CONV = "conversation_id_sent_at";

export interface CachedMessage {
  id: string;
  conversation_id: string;
  sender_account_id: string;
  body: string;
  sent_at: string;
  /** true if this row was originally encrypted server-side · false
   *  if it was already plaintext at fetch time. Kept for provenance
   *  so the UI can show a "🔒" indicator if it wants to. */
  from_encrypted: boolean;
  cached_at: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex(IDX_CONV, ["conversation_id", "sent_at"], {
          unique: false,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Insert or update a cached message. Idempotent · re-writing the
 *  same id is safe (last write wins on cached_at + body). */
export async function putMessage(msg: Omit<CachedMessage, "cached_at">): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...msg, cached_at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Bulk write · useful for the initial hydration pass in Bridge 79. */
export async function putMessages(
  msgs: Array<Omit<CachedMessage, "cached_at">>,
): Promise<void> {
  if (msgs.length === 0) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const now = Date.now();
      for (const m of msgs) store.put({ ...m, cached_at: now });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** All cached messages for a conversation, ordered by sent_at asc. */
export async function getMessagesForConversation(
  conversationId: string,
): Promise<CachedMessage[]> {
  const db = await openDb();
  try {
    return await new Promise<CachedMessage[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const idx = tx.objectStore(STORE).index(IDX_CONV);
      const range = IDBKeyRange.bound(
        [conversationId, ""],
        [conversationId, "￿"],
      );
      const req = idx.getAll(range);
      req.onsuccess = () => resolve((req.result as CachedMessage[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Read a single cached message by id · returns null if not present. */
export async function getMessage(id: string): Promise<CachedMessage | null> {
  const db = await openDb();
  try {
    return await new Promise<CachedMessage | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as CachedMessage | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Purge cache for a specific conversation · used by "clear this
 *  chat" affordance (not yet wired in v1). */
export async function forgetConversation(conversationId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const idx = tx.objectStore(STORE).index(IDX_CONV);
      const range = IDBKeyRange.bound(
        [conversationId, ""],
        [conversationId, "￿"],
      );
      const req = idx.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Purge everything · sign-out affordance. */
export async function forgetAllMessages(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

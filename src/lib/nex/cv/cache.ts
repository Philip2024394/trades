// In-process cache for vision analyses.
//
// Vision API calls cost money AND take multiple seconds. Same image
// URL asked twice in a browsing session gets the same reply from
// cache — up to a 24-hour TTL.
//
// Key = SHA-256 of (imageUrl + analysisKind + contextHash) so context
// changes bust the cache. Cleared on server restart.

import { createHash } from "node:crypto";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours

type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

export function _clearCvCache(): void { store.clear(); }

export function cacheKey(imageUrl: string | string[], kind: string, context: object = {}): string {
  const urlPart = Array.isArray(imageUrl) ? imageUrl.join("|") : imageUrl;
  const ctxPart = JSON.stringify(context, Object.keys(context).sort());
  return createHash("sha256").update(`${kind}:${urlPart}:${ctxPart}`).digest("hex").slice(0, 32);
}

export function getCached<T>(key: string, now = Date.now()): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt < now) { store.delete(key); return null; }
  return e.value as T;
}

export function setCached<T>(key: string, value: T, now = Date.now()): void {
  store.set(key, { value, expiresAt: now + CACHE_TTL_MS });
}

/** Snapshot for tests — count of live entries. */
export function _cacheSize(): number { return store.size; }

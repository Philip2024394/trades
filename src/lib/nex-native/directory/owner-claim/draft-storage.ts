// src/lib/nex-native/directory/owner-claim/draft-storage.ts
//
// NEX Directory · Owner Claim · client-side draft persistence.
//
// What this module is
//   · A tiny sessionStorage helper the owner-claim UI uses to persist
//     a partial draft across page reloads so an interrupted claim
//     flow doesn't lose their work.
//
// What this module is NOT
//   · Not a server-side draft store. The server-side draft table is
//     DEFERRED (see `./actions.ts` for the honest blocker).
//   · Not an identity surface. Nothing here is tied to an account id.
//     Drafts are per-canonical-id, scoped to the current browser tab.
//
// No fabrication
//   · If sessionStorage parse fails, loadDraft returns `null` (NOT a
//     default draft, NOT a reconstructed shape). The UI treats null
//     as "no saved draft" and starts the owner fresh.
//
// SSR safety
//   · All three functions are a no-op (or return null) when
//     `typeof window === "undefined"`. This module is safe to import
//     from a server/edge module as long as it is only invoked in a
//     client-side effect.

"use client";

import type { OwnerClaimDraft } from "./types";

/**
 * Key prefix for sessionStorage entries. Namespaced to avoid collision
 * with the Vault's `nex:vault-*` keys and the Socials `nex:socials-*`
 * keys. One entry per canonical business id.
 */
const KEY_PREFIX = "nex:owner-claim-draft:";

function keyFor(canonicalId: string): string {
  return `${KEY_PREFIX}${canonicalId}`;
}

function hasSessionStorage(): boolean {
  return typeof window !== "undefined"
    && typeof window.sessionStorage !== "undefined";
}

/**
 * Loads an owner-claim draft for a specific canonical business id.
 * Returns `null` when:
 *   · sessionStorage is unavailable (SSR or private-mode browsers)
 *   · no entry exists for this canonicalId
 *   · the stored string is not valid JSON
 *   · the parsed object is not a plausible draft shape
 */
export function loadDraft(canonicalId: string): OwnerClaimDraft | null {
  if (!canonicalId || !hasSessionStorage()) {
    return null;
  }
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(keyFor(canonicalId));
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null
        || typeof parsed !== "object"
        || typeof (parsed as { kind?: unknown }).kind !== "string") {
      return null;
    }
    return parsed as OwnerClaimDraft;
  } catch {
    return null;
  }
}

/**
 * Persists an owner-claim draft to sessionStorage for the given
 * canonical business id. Silent no-op when sessionStorage is
 * unavailable (SSR, quota exceeded, private mode). Any failure is
 * swallowed — the owner's working session continues in-memory.
 */
export function saveDraft(canonicalId: string, draft: OwnerClaimDraft): void {
  if (!canonicalId || !hasSessionStorage()) {
    return;
  }
  try {
    window.sessionStorage.setItem(
      keyFor(canonicalId),
      JSON.stringify(draft),
    );
  } catch {
    /* ignore · quota or security exception */
  }
}

/**
 * Removes any saved draft for the given canonical business id. No-op
 * when the entry does not exist. Silent on any sessionStorage failure.
 */
export function clearDraft(canonicalId: string): void {
  if (!canonicalId || !hasSessionStorage()) {
    return;
  }
  try {
    window.sessionStorage.removeItem(keyFor(canonicalId));
  } catch {
    /* ignore */
  }
}

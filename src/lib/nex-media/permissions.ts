// src/lib/nex-media/permissions.ts
//
// NEX Media Foundation · read/write permission checks · Philip 2026-08-27.
// Enforces ADR-0118 § 4 (visibility defaults) + § 5 (provenance is stamped once).

import type { MediaObject, MediaVisibility } from "./types";

export type CallerContext = {
  identity: string | null;   // NEX identity string, or null for anonymous
  isAdmin?: boolean;
};

/** Can this caller read this media row?
 *  Order (first match wins):
 *   - admin → yes
 *   - public + ready → yes (anyone)
 *   - unlisted + ready → yes (caller has the id, that's the auth)
 *   - private + ready + caller.identity === owner_id → yes
 *   - deleted → owner + admin only
 *   - otherwise → no
 */
export function canRead(row: MediaObject, caller: CallerContext): boolean {
  if (caller.isAdmin) return true;
  if (row.state === "deleted") return caller.identity === row.owner_id;
  if (row.state !== "ready" && row.state !== "processing") {
    // uploading / failed → owner only
    return caller.identity === row.owner_id;
  }
  if (row.visibility === "public") return true;
  if (row.visibility === "unlisted") return true;  // knowing the id IS the auth
  return caller.identity === row.owner_id;
}

/** Can this caller mutate (soft-delete) this media row?
 *  Owner + admin only.
 */
export function canMutate(row: MediaObject, caller: CallerContext): boolean {
  if (caller.isAdmin) return true;
  return caller.identity != null && caller.identity === row.owner_id;
}

/** Normalise a visibility input · defaults to private (ADR-0118 § 4). */
export function normaliseVisibility(v: unknown): MediaVisibility {
  if (v === "public" || v === "unlisted") return v;
  return "private";
}

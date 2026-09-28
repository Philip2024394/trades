// src/lib/nex-native/nex-official.ts
//
// NEX1 · canonical support account constant + helpers.
// -----------------------------------------------------
// Sealed 2026-09-28 · Bridge 31. Founder direction: every user can
// chat with a single official NEX account for upgrade help, feature
// questions, and account support. That account is a real row in
// nex_account seeded by migration 084 with a fixed UUID so application
// code can link to it without a lookup.
//
// The chat surface reuses the existing peer chat page:
//   /nex-native/chat/peer/{NEX_OFFICIAL_ACCOUNT_ID}
//
// It doesn't require a friend edge · peer chat's
// getOrCreatePeerConversation is idempotent on the (viewer, NEX)
// canonical pair, so first click creates the thread + subsequent
// clicks resume it.

import type { NexUuid } from "./types";

/** Fixed UUID of the NEX official support account · seeded by
 *  migration 084. Never allocated to a real user. */
export const NEX_OFFICIAL_ACCOUNT_ID: NexUuid =
  "00000000-0000-0000-0000-000000000001";

/** Public NEX handle for the official account · below the sequential
 *  handle allocator's 10000-counter boundary so it can never collide. */
export const NEX_OFFICIAL_HANDLE = "nex-00001";

/** Display name shown on the official account's chat surface + cards. */
export const NEX_OFFICIAL_DISPLAY_NAME = "NEX";

/** Convenience href for the "Chat with NEX" CTA · use everywhere the
 *  user needs to reach NEX (settings/tier, packages, help pages). */
export const NEX_OFFICIAL_CHAT_HREF =
  `/nex-native/chat/peer/${NEX_OFFICIAL_ACCOUNT_ID}` as const;

/** True when the given account id is the NEX official account. */
export function isNexOfficialAccount(id: string | null | undefined): boolean {
  return id === NEX_OFFICIAL_ACCOUNT_ID;
}

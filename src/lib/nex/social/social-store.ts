// src/lib/nex/social/social-store.ts
//
// NEX Social · local state helpers · Phase Social §14 §16 §22
// Philip 2026-09-07
//
// Owns the client-side state for the four Social states:
//   · SAVED       (§14 · private · never notifies)
//   · PENDING     (§16 · invitation sent · awaiting other user)
//   · FRIENDS     (§17 · mutual acceptance completed)
//   · DECLINED    (§18 · other user declined · closed silently)
//
// Persistence: localStorage only. Server-side persistence is a separate
// authorised slice per §37 · this module honestly labels the storage
// scope so no caller can pretend it's a server round-trip.
//
// Safe on SSR (window guards). Never throws.
//
// PURE MODULE. No React. No DOM.

import type { MeetingPreferenceId } from "./meeting-preferences";

export const SOCIAL_STORAGE_KEYS = {
  saved:    "nex.social.saved",
  pending:  "nex.social.pending",
  friends:  "nex.social.friends",
  declined: "nex.social.declined",
  discoveryCategory: "nex.social.discovery-category",
} as const;

/** A minimal pointer to a profile · the Discover surface owns the full
 *  DiscoverProfile shape · we only persist what we need to display the
 *  saved / pending / friends list later. */
export type SocialProfileRef = {
  id: string;
  first_name: string;
  city: string | null;
  photo_url: string | null;
  business_info: string | null;
};

export type SavedProfile = {
  ref: SocialProfileRef;
  saved_at_iso: string;
};

export type PendingInvite = {
  ref: SocialProfileRef;
  meeting_pref: MeetingPreferenceId;
  sent_at_iso: string;
  /** Present only if we've simulated the recipient's response · null
   *  while awaiting. Uses null (not undefined) so JSON round-trip keeps
   *  the field visible. */
  responded_at_iso: string | null;
  response: "pending" | "accepted" | "declined";
};

export type FriendConnection = {
  ref: SocialProfileRef;
  meeting_pref: MeetingPreferenceId;
  connected_at_iso: string;
};

export type DiscoveryCategory = "female" | "male" | "everyone";

// ── Storage guards ─────────────────────────────────────────────

function safeGet<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}
function safeSet<T>(key: string, value: T): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage blocked · silent */ }
}

// ── Saved (§14) ────────────────────────────────────────────────

export function readSaved(): SavedProfile[] {
  return safeGet<SavedProfile[]>(SOCIAL_STORAGE_KEYS.saved, []);
}
export function isSaved(id: string): boolean {
  return readSaved().some((s) => s.ref.id === id);
}
export function saveProfile(ref: SocialProfileRef): SavedProfile[] {
  const list = readSaved();
  if (list.some((s) => s.ref.id === ref.id)) return list;   // idempotent
  const next: SavedProfile[] = [...list, { ref, saved_at_iso: new Date().toISOString() }];
  safeSet(SOCIAL_STORAGE_KEYS.saved, next);
  return next;
}
export function unsaveProfile(id: string): SavedProfile[] {
  const next = readSaved().filter((s) => s.ref.id !== id);
  safeSet(SOCIAL_STORAGE_KEYS.saved, next);
  return next;
}

// ── Pending invitations (§16) ─────────────────────────────────

export function readPending(): PendingInvite[] {
  return safeGet<PendingInvite[]>(SOCIAL_STORAGE_KEYS.pending, []);
}
export function findPendingByProfile(id: string): PendingInvite | null {
  return readPending().find((p) => p.ref.id === id) ?? null;
}
export function sendInvite(ref: SocialProfileRef, meeting_pref: MeetingPreferenceId): PendingInvite {
  const invite: PendingInvite = {
    ref,
    meeting_pref,
    sent_at_iso: new Date().toISOString(),
    responded_at_iso: null,
    response: "pending",
  };
  const list = readPending();
  const filtered = list.filter((p) => p.ref.id !== ref.id);
  safeSet(SOCIAL_STORAGE_KEYS.pending, [...filtered, invite]);
  return invite;
}

// ── Response resolution (§17 · §18) ───────────────────────────

/** Resolves a pending invitation. When the response is "accepted" a
 *  FriendConnection is created and returned. When "declined" the
 *  invitation is closed silently and null is returned. */
export function resolveInvite(id: string, response: "accepted" | "declined"): FriendConnection | null {
  const list = readPending();
  const idx = list.findIndex((p) => p.ref.id === id);
  if (idx < 0) return null;
  const invite = list[idx];
  const now = new Date().toISOString();
  const updated: PendingInvite = { ...invite, responded_at_iso: now, response };
  const nextPending = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
  safeSet(SOCIAL_STORAGE_KEYS.pending, nextPending);

  if (response === "declined") {
    // §18 · closed silently · declined list preserved for observability
    const declined = safeGet<PendingInvite[]>(SOCIAL_STORAGE_KEYS.declined, []);
    safeSet(SOCIAL_STORAGE_KEYS.declined, [...declined, updated]);
    return null;
  }

  // §17 · accepted · create Friend connection
  const friends = readFriends();
  if (friends.some((f) => f.ref.id === id)) return friends.find((f) => f.ref.id === id) ?? null;
  const friend: FriendConnection = { ref: invite.ref, meeting_pref: invite.meeting_pref, connected_at_iso: now };
  safeSet(SOCIAL_STORAGE_KEYS.friends, [...friends, friend]);
  return friend;
}

// ── Friends (§17) ─────────────────────────────────────────────

export function readFriends(): FriendConnection[] {
  return safeGet<FriendConnection[]>(SOCIAL_STORAGE_KEYS.friends, []);
}
export function isFriend(id: string): boolean {
  return readFriends().some((f) => f.ref.id === id);
}

// ── Discovery category persistence (§23) ──────────────────────

export function readDiscoveryCategory(): DiscoveryCategory {
  const raw = safeGet<string | null>(SOCIAL_STORAGE_KEYS.discoveryCategory, null);
  if (raw === "female" || raw === "male" || raw === "everyone") return raw;
  return "everyone";
}
export function writeDiscoveryCategory(category: DiscoveryCategory): void {
  safeSet(SOCIAL_STORAGE_KEYS.discoveryCategory, category);
}

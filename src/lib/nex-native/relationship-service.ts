// src/lib/nex-native/relationship-service.ts
//
// Wave B Slice 3f-a · per-relationship preferences.
// ---------------------------------------------------
// Backend for the /nex-app ContactsPanel rewire: each contact card exposes
// a "share my theme with this person" toggle. Storage is canonical-pair
// (a_account_id < b_account_id) so one row represents one relationship
// regardless of who first toggled a pref, matching nex_friend_edge.
//
// Doctrine:
//   · Every FK is nex_account.id (UUID)
//   · Self-pref rejected · canonical pair enforced app-side AND DB-side
//   · Opt-in default (both share booleans start false)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface RelationshipPrefsRow {
  a_account_id: NexUuid;
  b_account_id: NexUuid;
  a_shares_theme: boolean;
  b_shares_theme: boolean;
  created_at: string;
  updated_at: string;
}

/** From-the-caller's perspective view of the prefs. */
export interface ActorPrefsView {
  actor_shares_theme: boolean;
  other_shares_theme: boolean;
}

/** Return canonical [a, b] with a < b · rejects self-pref. */
export function canonicalPair(x: NexUuid, y: NexUuid): [NexUuid, NexUuid] {
  if (x === y) throw new Error("relationship-service: self-pref rejected");
  return x < y ? [x, y] : [y, x];
}

async function getRow(a: NexUuid, b: NexUuid): Promise<RelationshipPrefsRow | null> {
  const [x, y] = canonicalPair(a, b);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .select("*")
    .eq("a_account_id", x)
    .eq("b_account_id", y)
    .maybeSingle();
  if (error) throw new Error(`relationship-service.getRow: ${error.message}`);
  return (data as RelationshipPrefsRow | null) ?? null;
}

/** Read prefs from the actor's perspective. Missing row → both false. */
export async function getPrefs(
  actor: NexUuid,
  other: NexUuid,
): Promise<ActorPrefsView> {
  const [x] = canonicalPair(actor, other);
  const row = await getRow(actor, other);
  if (!row) return { actor_shares_theme: false, other_shares_theme: false };
  if (actor === x) {
    return { actor_shares_theme: row.a_shares_theme, other_shares_theme: row.b_shares_theme };
  }
  return { actor_shares_theme: row.b_shares_theme, other_shares_theme: row.a_shares_theme };
}

/** Set whether the actor shares their theme with the other party.
 *  Only writes the actor's side · other party's flag is untouched.
 *  Creates the row if missing · updates in place otherwise. */
export async function setThemeShare(
  actor: NexUuid,
  other: NexUuid,
  share: boolean,
): Promise<ActorPrefsView> {
  const [x, y] = canonicalPair(actor, other);
  const actorIsA = actor === x;
  // Upsert on canonical PK · preserve the OTHER side's value if row exists.
  const existing = await getRow(actor, other);
  const nextA = actorIsA ? share : existing?.a_shares_theme ?? false;
  const nextB = actorIsA ? existing?.b_shares_theme ?? false : share;

  const { error: upErr } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .upsert(
      {
        a_account_id: x,
        b_account_id: y,
        a_shares_theme: nextA,
        b_shares_theme: nextB,
      },
      { onConflict: "a_account_id,b_account_id" },
    );
  if (upErr) throw new Error(`relationship-service.setThemeShare: ${upErr.message}`);
  return getPrefs(actor, other);
}

/** Should `viewer` see `other`'s chat theme? Reads other's share flag. */
export async function shouldSeeThemeOf(
  viewer: NexUuid,
  other: NexUuid,
): Promise<boolean> {
  const prefs = await getPrefs(viewer, other);
  return prefs.other_shares_theme;
}

/** List all prefs where `account` participates · returns rows verbatim
 *  (canonical shape · caller can normalise per view). */
export async function listPrefsForAccount(account: NexUuid): Promise<RelationshipPrefsRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .select("*")
    .or(`a_account_id.eq.${account},b_account_id.eq.${account}`);
  if (error) throw new Error(`relationship-service.listPrefsForAccount: ${error.message}`);
  return (data as RelationshipPrefsRow[] | null) ?? [];
}

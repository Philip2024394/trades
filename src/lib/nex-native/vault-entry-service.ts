// src/lib/nex-native/vault-entry-service.ts
//
// Stage 3 · Vault entry service · founder-sealed vault-build-plan-2026-10-03.
//
// Reads and writes nex_vault_entry rows (migration 128). Enforces the D1
// invariants from the sealed build plan:
//
//   · per-viewer visibility shim · never a shared/global vaulted-ness row
//   · moved_at only · no observation columns (SA6 absolute)
//   · 'conversation' entry hides ONE conversation only; friend stays visible
//   · 'friend' entry hides the friend AND every conversation with them
//   · one-sided hide · counterparty's view is unchanged
//   · idempotent moves (UNIQUE constraint absorbs duplicates)
//
// All functions are server-only and use the admin client because callers
// vouch for the viewer via session resolution. The service enforces
// authorisation explicitly before any insert/delete:
//
//   · moveConversationToVault asserts the viewer is a participant.
//   · moveFriendToVault asserts an accepted friend-edge exists between
//     the viewer and the target account.
//   · removeConversationFromVault / removeFriendFromVault scope the delete
//     to (account_id = viewer) so unauthorised deletions are no-ops at
//     worst, never cross-account damage.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import * as peerConvService from "./peer-conversation-service";
import * as friendService from "./friend-service";
import type { NexPeerConversationRow } from "./peer-conversation-service";

export type VaultEntryKind = "conversation" | "friend";

export interface VaultEntryRow {
  id: NexUuid;
  account_id: NexUuid;
  entry_kind: VaultEntryKind;
  ref_id: NexUuid;
  moved_at: string;
}

// ─── primitives ─────────────────────────────────────────────────────────

/** Raw list of vault entries for a viewer. UI should prefer the
 *  derived helpers (listVaultedConversationIds / listVaultedFriendIds)
 *  which return sets suitable for filtering. */
export async function listVaultEntriesForAccount(
  accountId: NexUuid,
): Promise<VaultEntryRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .select("*")
    .eq("account_id", accountId)
    .order("moved_at", { ascending: false });
  if (error) {
    throw new Error(
      `vault-entry-service.listVaultEntriesForAccount: ${error.message}`,
    );
  }
  return (data as VaultEntryRow[]) ?? [];
}

export async function listVaultedConversationIds(
  accountId: NexUuid,
): Promise<Set<NexUuid>> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .select("ref_id")
    .eq("account_id", accountId)
    .eq("entry_kind", "conversation");
  if (error) {
    throw new Error(
      `vault-entry-service.listVaultedConversationIds: ${error.message}`,
    );
  }
  return new Set((data ?? []).map((r) => (r as { ref_id: NexUuid }).ref_id));
}

export async function listVaultedFriendIds(
  accountId: NexUuid,
): Promise<Set<NexUuid>> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .select("ref_id")
    .eq("account_id", accountId)
    .eq("entry_kind", "friend");
  if (error) {
    throw new Error(
      `vault-entry-service.listVaultedFriendIds: ${error.message}`,
    );
  }
  return new Set((data ?? []).map((r) => (r as { ref_id: NexUuid }).ref_id));
}

export async function isConversationVaulted(
  accountId: NexUuid,
  conversationId: NexUuid,
): Promise<boolean> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .select("id")
    .eq("account_id", accountId)
    .eq("entry_kind", "conversation")
    .eq("ref_id", conversationId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `vault-entry-service.isConversationVaulted: ${error.message}`,
    );
  }
  return !!data;
}

export async function isFriendVaulted(
  accountId: NexUuid,
  friendAccountId: NexUuid,
): Promise<boolean> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .select("id")
    .eq("account_id", accountId)
    .eq("entry_kind", "friend")
    .eq("ref_id", friendAccountId)
    .maybeSingle();
  if (error) {
    throw new Error(`vault-entry-service.isFriendVaulted: ${error.message}`);
  }
  return !!data;
}

// ─── mutations · move ───────────────────────────────────────────────────

/** Move a single conversation into the viewer's Vault. Idempotent.
 *  The counterparty's view is unchanged. Returns the resulting row.
 *  Rejects if the viewer is not a participant of the conversation. */
export async function moveConversationToVault(
  accountId: NexUuid,
  conversationId: NexUuid,
): Promise<VaultEntryRow> {
  const isParticipant = await peerConvService.isPeerConversationParticipant(
    conversationId,
    accountId,
  );
  if (!isParticipant) {
    throw new Error(
      "vault-entry-service.moveConversationToVault: viewer is not a participant",
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .upsert(
      {
        account_id: accountId,
        entry_kind: "conversation",
        ref_id: conversationId,
      },
      { onConflict: "account_id,entry_kind,ref_id", ignoreDuplicates: false },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `vault-entry-service.moveConversationToVault: ${error?.message ?? "no row"}`,
    );
  }
  return data as VaultEntryRow;
}

/** Move an entire friend (and implicitly every conversation with them)
 *  into the viewer's Vault. Idempotent. The friend's view is unchanged.
 *  Rejects if no accepted friend-edge exists between the two accounts. */
export async function moveFriendToVault(
  accountId: NexUuid,
  friendAccountId: NexUuid,
): Promise<VaultEntryRow> {
  if (accountId === friendAccountId) {
    throw new Error(
      "vault-entry-service.moveFriendToVault: cannot move self to vault",
    );
  }
  const myFriends = await friendService.listFriends(accountId);
  if (!myFriends.includes(friendAccountId)) {
    throw new Error(
      "vault-entry-service.moveFriendToVault: no accepted friendship with target",
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .upsert(
      {
        account_id: accountId,
        entry_kind: "friend",
        ref_id: friendAccountId,
      },
      { onConflict: "account_id,entry_kind,ref_id", ignoreDuplicates: false },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `vault-entry-service.moveFriendToVault: ${error?.message ?? "no row"}`,
    );
  }
  return data as VaultEntryRow;
}

// ─── mutations · remove ─────────────────────────────────────────────────

export async function removeConversationFromVault(
  accountId: NexUuid,
  conversationId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .delete()
    .eq("account_id", accountId)
    .eq("entry_kind", "conversation")
    .eq("ref_id", conversationId);
  if (error) {
    throw new Error(
      `vault-entry-service.removeConversationFromVault: ${error.message}`,
    );
  }
}

export async function removeFriendFromVault(
  accountId: NexUuid,
  friendAccountId: NexUuid,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_entry")
    .delete()
    .eq("account_id", accountId)
    .eq("entry_kind", "friend")
    .eq("ref_id", friendAccountId);
  if (error) {
    throw new Error(
      `vault-entry-service.removeFriendFromVault: ${error.message}`,
    );
  }
}

// ─── derived · "outside vault" filters ──────────────────────────────────

/** The peer-conversations the viewer sees in their MAIN inbox — i.e.
 *  everything from peer-conversation-service, minus:
 *    · conversations with a 'conversation' vault-entry, AND
 *    · conversations whose peer (other participant) has a 'friend'
 *      vault-entry (whole-friend hide implicitly hides every conv).
 *
 *  This is the ONE helper main-inbox surfaces must use. Never call the
 *  raw peer-conversation-service list from the inbox directly. */
export async function listMainInboxConversationsForAccount(
  accountId: NexUuid,
): Promise<NexPeerConversationRow[]> {
  const [all, vaultedConvIds, vaultedFriendIds] = await Promise.all([
    peerConvService.listPeerConversationsForAccount(accountId),
    listVaultedConversationIds(accountId),
    listVaultedFriendIds(accountId),
  ]);
  return all.filter((c) => {
    if (vaultedConvIds.has(c.id)) return false;
    const peerId =
      c.participant_a_id === accountId ? c.participant_b_id : c.participant_a_id;
    if (vaultedFriendIds.has(peerId)) return false;
    return true;
  });
}

/** The friends the viewer sees in their MAIN contacts list / search —
 *  friendService.listFriends minus vaulted friend ids. Never call
 *  friendService.listFriends from contact surfaces directly; use this. */
export async function listMainContactsFriendIdsForAccount(
  accountId: NexUuid,
): Promise<NexUuid[]> {
  const [friendIds, vaultedFriendIds] = await Promise.all([
    friendService.listFriends(accountId),
    listVaultedFriendIds(accountId),
  ]);
  return friendIds.filter((id) => !vaultedFriendIds.has(id));
}

// ─── derived · "inside vault" lists ─────────────────────────────────────

export interface VaultedConversationView {
  conversation: NexPeerConversationRow;
  peerAccountId: NexUuid;
  movedAt: string;
}

/** The peer conversations the viewer sees INSIDE Vault — i.e. the
 *  conversations the viewer has moved to vault explicitly, plus every
 *  conversation with a friend who has been moved to vault.
 *
 *  Deduplicated: a conversation that is BOTH explicitly vaulted AND whose
 *  peer is a vaulted friend appears only once. moved_at is the earliest
 *  entry so recent activity bubbles up without being overridden by the
 *  original move timestamp. */
export async function listVaultedConversationsForAccount(
  accountId: NexUuid,
): Promise<VaultedConversationView[]> {
  const [allConvs, entries] = await Promise.all([
    peerConvService.listPeerConversationsForAccount(accountId),
    listVaultEntriesForAccount(accountId),
  ]);
  const convEntryMovedAt = new Map<NexUuid, string>();
  const vaultedFriendIds = new Set<NexUuid>();
  for (const e of entries) {
    if (e.entry_kind === "conversation") {
      convEntryMovedAt.set(e.ref_id, e.moved_at);
    } else {
      vaultedFriendIds.add(e.ref_id);
    }
  }
  const views: VaultedConversationView[] = [];
  for (const c of allConvs) {
    const peerId =
      c.participant_a_id === accountId ? c.participant_b_id : c.participant_a_id;
    const explicit = convEntryMovedAt.get(c.id);
    const viaFriend = vaultedFriendIds.has(peerId);
    if (!explicit && !viaFriend) continue;
    views.push({
      conversation: c,
      peerAccountId: peerId,
      movedAt: explicit ?? c.last_message_at ?? c.created_at,
    });
  }
  return views;
}

/** The friends the viewer sees INSIDE Vault · just the ones they've
 *  moved whole into Vault. (Explicit per-conversation vaults do NOT
 *  move the friend; the friend stays in Contacts per D1.a.) */
export async function listVaultedFriendIdsForAccount(
  accountId: NexUuid,
): Promise<NexUuid[]> {
  const set = await listVaultedFriendIds(accountId);
  return [...set];
}

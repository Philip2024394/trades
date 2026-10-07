// src/app/nex-native/vault/home/contacts/page.tsx
//
// Vault · Contacts (founder-authorised 2026-10-07).
// --------------------------------------------------
// First-class Vault destination at the same level as Chats and
// Settings · reached from the Vault Home navigation tile.
//
// DATA · reuses existing NEX systems · zero new tables.
//   · Friend list              → friend-service.listFriends
//   · Identity (name/handle)   → account-service.getAccountById
//   · Vault membership         → vault-entry-service.listVaultedConversationIds
//   · Canonical conversation   → peer-conversation-service.findPeerConversation
//
// SECURITY
//   · Session-gated (redirect to sign-in).
//   · Vault setup must exist (redirect to /vault/setup otherwise ·
//     parity with every other /vault/home surface).
//   · Only the viewer's own friend + vault-entry rows are read.
//   · The page renders ONLY identity + a "is-in-Vault" boolean per
//     row · zero message previews, zero attachments, zero plaintext.
//     This mirrors the normal /friends page and is safe to show in
//     every lock state.
//
// CANONICAL CONVERSATION PRESERVATION
//   · For each friend we resolve findPeerConversation(viewer, friend)
//     to look up the single sealed nex_peer_conversation row for the
//     pair (if one exists). Routing uses THAT id · we never create a
//     second conversation.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import { NEX } from "../_palette";
import { VaultContactsClient, type VaultContactRow } from "./_contacts-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultContactsPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/contacts");
  }
  const viewerId = session.account.id;

  // Vault must be configured · same gate as every other /vault/home
  // surface. We do NOT check unlocked state here · Contacts is safe
  // to show locked (identities only, no protected content).
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", viewerId)
    .maybeSingle();
  if (!setup) {
    redirect("/nex-native/vault/setup");
  }

  // 1 · Friend ids via the sealed friend-service.
  const friendIds = await friendService.listFriends(viewerId);

  // 2 · Vault-membership set (owner-scoped by the sealed service · a
  //     Set lookup per friend is O(1)).
  const vaultedConvIds = await vaultEntryService.listVaultedConversationIds(
    viewerId,
  );

  // 3 · For each friend · resolve identity + canonical conversation
  //     id. We fan out in parallel · each call is sealed and already
  //     participant/owner-scoped at its service boundary.
  const rows: VaultContactRow[] = await Promise.all(
    friendIds.map(async (friendId) => {
      const [account, conv] = await Promise.all([
        accountService.getAccountById(friendId),
        peerConversationService.findPeerConversation(viewerId, friendId),
      ]);
      const conversationId = conv?.id ?? null;
      return {
        friendId,
        displayName: account?.display_name ?? "Private contact",
        handle: account?.nex_handle ?? null,
        conversationId,
        isVaulted:
          conversationId !== null && vaultedConvIds.has(conversationId),
      };
    }),
  );

  // Alphabetical for a predictable list · tiny-list friendly (phones).
  rows.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    }),
  );

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-vault-contacts] * { box-sizing: border-box; }
        [data-nex-vault-contacts] a { text-decoration: none; color: inherit; }
      `}</style>
      <VaultContactsClient viewerAccountId={viewerId} rows={rows} />
    </>
  );
}

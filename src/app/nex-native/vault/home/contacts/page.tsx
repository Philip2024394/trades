// src/app/nex-native/vault/home/contacts/page.tsx
//
// Vault · Contacts (founder-authorised 2026-10-07 · richer-cards
// + friend-vault recognition + vaulted-row action menu follow-up
// 2026-10-07).
// -----------------------------------------------------------------
// First-class Vault destination at the same level as Chats and
// Settings · reached from the Vault Home navigation tile.
//
// DATA · reuses existing NEX systems · zero new tables.
//   · Friend list              → friend-service.listFriends
//   · Identity (name/handle)   → account-service.getAccountById
//   · Vault membership         → vault-entry-service.
//                                  listVaultedConversationIds +
//                                  listVaultedFriendIds
//   · Canonical conversation   → peer-conversation-service.
//                                  findPeerConversation
//   · Peer last-seen + country → nex_session (Phase 1 Security) ·
//                                most-recent live session per friend
//
// SECURITY · locked-Vault safe
//   · Session-gated (redirect to sign-in).
//   · Vault setup must exist (redirect to /vault/setup otherwise ·
//     parity with every other /vault/home surface).
//   · Only the viewer's own friend + vault-entry rows are read.
//   · Vault-membership badge is pure metadata (Set.has() · owner-
//     scoped). No message previews, no attachments, no plaintext.
//
// PEER VISIBILITY POLICY (founder-authorised 2026-10-07)
//   · Only visible to accepted friends (sealed friend-service enforces).
//   · Country shown as nex_session.approx_country (country-level ·
//     NOT city).
//   · Last-seen shown as a RELATIVE phrase through the new Phase B.7
//     formatRelativeFrom helper (never an exact timestamp, never a
//     "currently online" dot).
//   · IP · user-agent · device label · exact timestamp · city · all
//     NEVER exposed on this surface.
//
// CANONICAL CONVERSATION PRESERVATION
//   · For each friend we resolve findPeerConversation(viewer, friend)
//     to look up the single sealed nex_peer_conversation row for the
//     pair (if one exists). Routing uses THAT id · we never create a
//     second conversation.
//
// FRIEND-VAULT RECOGNITION (bug fix 2026-10-07)
//   · A contact's row counts as "vaulted" when EITHER the pair's
//     canonical conversation is in nex_vault_entry OR the friend
//     itself is friend-vaulted (entry_kind='friend'). Previously
//     only the conversation branch was checked · a friend-vaulted
//     contact without a conversation-level vault entry rendered the
//     "Move to Vault" chip incorrectly.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import { resolveServerLocale } from "@/lib/nex/i18n/server";
import { formatRelativeFrom } from "@/lib/nex/i18n/format";
import { NEX } from "../_palette";
import { VaultContactsClient, type VaultContactRow } from "./_contacts-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PeerSessionSummary {
  approxCountry: string | null;
  lastSeenAt: string | null;
}

/** Fetch the most-recent live session per friend id. One query ·
 *  N-row list where N = friends. Uses the sealed service-role
 *  client so Phase 1 Security RLS does not need relaxing · the
 *  select is restricted to the three fields this surface is
 *  authorised to expose. */
async function fetchPeerSessionSummaries(
  friendIds: readonly string[],
): Promise<Map<string, PeerSessionSummary>> {
  const out = new Map<string, PeerSessionSummary>();
  if (friendIds.length === 0) return out;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select("account_id, approx_country, last_seen_at")
    .in("account_id", friendIds as string[])
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });
  if (error) {
    // Fail-soft · richer-card data is a UX enhancement · the page
    // still renders without it. Any error here is logged but does
    // NOT break the surface.
    // eslint-disable-next-line no-console
    console.warn("vault-contacts peer-session fetch:", error.message);
    return out;
  }
  const rows =
    (data as Array<{
      account_id: string;
      approx_country: string | null;
      last_seen_at: string;
    }> | null) ?? [];
  // Query is already ordered by last_seen_at desc · the first row we
  // see per account is the most-recent one. Later rows for the same
  // account are older · we skip them.
  for (const r of rows) {
    if (out.has(r.account_id)) continue;
    out.set(r.account_id, {
      approxCountry: r.approx_country,
      lastSeenAt: r.last_seen_at,
    });
  }
  return out;
}

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

  // 2 · Vault-membership · BOTH axes.
  //       · conversation-vault (sealed B.5 moveConversationToVault)
  //       · friend-vault       (sealed moveFriendToVault)
  //     Either one in the viewer's vault counts as "vaulted" on the
  //     Contacts surface · bug fix 2026-10-07 (previously only the
  //     conversation branch was consulted).
  const [vaultedConvIds, vaultedFriendIds] = await Promise.all([
    vaultEntryService.listVaultedConversationIds(viewerId),
    vaultEntryService.listVaultedFriendIds(viewerId),
  ]);

  // 3 · Peer session summaries (country + last-seen) · one batched
  //     query via the sealed Phase 1 Security table · peer-visibility
  //     policy sealed 2026-10-07 restricts the surface to country +
  //     relative last-seen.
  const peerSessions = await fetchPeerSessionSummaries(friendIds);

  // 4 · Resolve the server-side locale so the relative-time strings
  //     come out in the user's chosen NEX language via the Phase B.7
  //     formatter. Phase B.7 made this one-liner safe to call from
  //     any server component.
  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const now = new Date();

  // 5 · For each friend · resolve identity + canonical conversation
  //     id + session summary. We fan out in parallel · each call is
  //     sealed and already participant/owner-scoped.
  const rows: VaultContactRow[] = await Promise.all(
    friendIds.map(async (friendId) => {
      const [account, conv] = await Promise.all([
        accountService.getAccountById(friendId),
        peerConversationService.findPeerConversation(viewerId, friendId),
      ]);
      const conversationId = conv?.id ?? null;
      const summary = peerSessions.get(friendId) ?? null;
      const lastSeenRelative = summary?.lastSeenAt
        ? formatRelativeFrom(summary.lastSeenAt, locale, now)
        : null;
      return {
        friendId,
        displayName: account?.display_name ?? "Private contact",
        handle: account?.nex_handle ?? null,
        conversationId,
        isVaulted:
          (conversationId !== null && vaultedConvIds.has(conversationId)) ||
          vaultedFriendIds.has(friendId),
        approxCountry: summary?.approxCountry ?? null,
        lastSeenRelative,
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

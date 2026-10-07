// src/app/nex-native/vault/home/chats/[conversationId]/page.tsx
//
// Vault Phase B · Commit B.4 · the canonical Vault chat surface.
//
// Route: /nex-native/vault/home/chats/[conversationId]
//
// The `conversationId` is always the id of an existing canonical
// `nex_peer_conversation` row. There is no second conversation table.
// This page renders the SAME relationship + the SAME message history
// as the normal chat surface at /nex-native/chat/peer/[accountId],
// gated behind VMK unlock and the per-viewer `nex_vault_entry`
// placement marker.
//
// Server-side responsibilities (plaintext-blind):
//   · resolve session
//   · verify Vault is configured for this account (nex_vault_setup)
//   · verify the viewer is one of the two canonical participants
//     (nex_peer_conversation.participant_a_id / participant_b_id)
//   · verify the viewer has moved this conversation into Vault
//     (nex_vault_entry OR friend-vault entry for the peer) · if not,
//     redirect to the Vault doorway home (do NOT silently create the
//     entry · that is B.5 scope)
//   · fetch the peer's non-secret display info for the chat header
//   · fetch nex_peer_message history (ciphertext + metadata only ·
//     the body column is '(encrypted)' sentinel for encrypted rows ·
//     the server never materialises plaintext)
//
// Everything decryption / caching / composer-side runs in the client
// component via the sealed B.3 K_c + IDB layer and the sealed Bridge
// 76 Curve25519 per-device fan-out.
//
// This page does NOT:
//   · create or mutate nex_peer_conversation (canonical doctrine)
//   · create a nex_vault_message or any second message table
//   · fetch plaintext · the body column is the sentinel for encrypted
//     rows · plaintext never leaves the client

import { redirect, notFound } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { listPeerMessages } from "@/lib/nex-native/peer-message-service";
import { VaultChatClient } from "./_vault-chat-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ conversationId: string }>;
}

export default async function VaultChatPage({ params }: Params) {
  const { conversationId } = await params;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=/nex-native/vault/home/chats/${encodeURIComponent(conversationId)}`,
    );
  }
  const viewerAccountId = session.account.id;

  // Vault must be configured for this account.
  const setup = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", viewerAccountId)
    .maybeSingle();
  if (setup.error || !setup.data) {
    redirect("/nex-native/vault/setup");
  }

  // Viewer must be a participant of the canonical conversation.
  const conv = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("id, participant_a_id, participant_b_id, created_at, last_message_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (conv.error || !conv.data) {
    notFound();
  }
  const row = conv.data as {
    id: string;
    participant_a_id: string;
    participant_b_id: string;
    created_at: string;
    last_message_at: string | null;
  };
  if (
    row.participant_a_id !== viewerAccountId &&
    row.participant_b_id !== viewerAccountId
  ) {
    notFound();
  }
  const peerAccountId =
    row.participant_a_id === viewerAccountId
      ? row.participant_b_id
      : row.participant_a_id;

  // Viewer must have moved this conversation (or the peer) into Vault.
  // Direct-conversation vault takes precedence · friend-vault is the
  // symmetric fallback (same shape Bridge 78's purge predicate uses).
  const [vaultConvEntry, vaultFriendEntry] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_vault_entry")
      .select("id")
      .eq("account_id", viewerAccountId)
      .eq("entry_kind", "conversation")
      .eq("ref_id", conversationId)
      .maybeSingle(),
    nexSupabaseAdmin
      .from("nex_vault_entry")
      .select("id")
      .eq("account_id", viewerAccountId)
      .eq("entry_kind", "friend")
      .eq("ref_id", peerAccountId)
      .maybeSingle(),
  ]);
  const inVault =
    (vaultConvEntry.data !== null && vaultConvEntry.data !== undefined) ||
    (vaultFriendEntry.data !== null && vaultFriendEntry.data !== undefined);
  if (!inVault) {
    // Conversation is not vaulted for this viewer · redirect to the
    // doorway home where the user can see what's actually inside.
    // We do NOT silently create a nex_vault_entry · that is a sealed
    // B.5 responsibility.
    redirect("/nex-native/vault/home/chats");
  }

  // Peer display name for the header · non-secret from nex_account.
  const peer = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name")
    .eq("id", peerAccountId)
    .maybeSingle();
  const peerDisplayName =
    (peer.data as { display_name: string | null } | null)?.display_name ?? "Peer";

  // Fetch message history · the ciphertext/nonce/sender_public_key etc.
  // are server-side opaque bytes (Bridge 76). Row body is '(encrypted)'
  // sentinel for encrypted rows.
  const messages = await listPeerMessages(conversationId);

  // Pass to client · only serialisable fields.
  const serialisedMessages = messages.map((m) => {
    const r = m as unknown as {
      id: string;
      conversation_id: string;
      sender_account_id: string;
      body: string;
      sent_at: string;
      read_at: string | null;
      encrypted: boolean | null;
      ciphertext: string | null;
      nonce: string | null;
      sender_public_key: string | null;
      sender_device_id: string | null;
      recipient_device_id: string | null;
      message_group_id: string | null;
      reply_to_id: string | null;
      attachment_url: string | null;
      attachment_type: string | null;
      deleted_for_everyone: boolean | null;
    };
    return {
      id: r.id,
      sender_account_id: r.sender_account_id,
      sent_at: r.sent_at,
      read_at: r.read_at,
      encrypted: Boolean(r.encrypted),
      body: r.body,
      ciphertext_b64: r.ciphertext ?? null,
      nonce_b64: r.nonce ?? null,
      sender_public_key: r.sender_public_key,
      sender_device_id: r.sender_device_id,
      recipient_device_id: r.recipient_device_id,
      message_group_id: r.message_group_id,
      reply_to_id: r.reply_to_id,
      attachment_url: r.attachment_url,
      attachment_type: r.attachment_type,
      deleted_for_everyone: Boolean(r.deleted_for_everyone),
    };
  });

  return (
    <VaultChatClient
      viewerAccountId={viewerAccountId}
      peerAccountId={peerAccountId}
      peerDisplayName={peerDisplayName}
      conversationId={row.id}
      initialMessages={serialisedMessages}
    />
  );
}

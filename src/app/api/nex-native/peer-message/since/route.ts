// src/app/api/nex-native/peer-message/since/route.ts
//
// R1 · Universal Live Messaging · reconciliation fetch endpoint.
// --------------------------------------------------------------
// GET /api/nex-native/peer-message/since
//     ?conversation_id=<uuid>
//     &since_iso=<iso8601>
//     &limit=<1..50>
//
// Returns the same encrypted-row shape the sealed Vault chat page
// already renders · see src/app/nex-native/vault/home/chats/
// [conversationId]/page.tsx `serialisedMessages`.
//
// Rules
//   · Session required. Non-signed-in → 401.
//   · Caller must be a participant of the conversation. Non-
//     participant → 403.
//   · `since_iso` is strict GT · the client passes its newest known
//     sent_at and we return only rows strictly newer than that.
//   · Hard max limit = 50 · larger values are clamped silently so a
//     bad client can't DOS this endpoint with huge pages.
//   · This endpoint is the CORRECTNESS mechanism for live messaging
//     · the realtime arrival event is the optimistic nudge · a client
//     that misses the broadcast still catches up through this GET.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getPeerConversationById } from "@/lib/nex-native/peer-conversation-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HARD_MAX_LIMIT = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SinceMessageRow {
  id: string;
  sender_account_id: string;
  sent_at: string;
  read_at: string | null;
  encrypted: boolean;
  body: string;
  ciphertext_b64: string | null;
  nonce_b64: string | null;
  sender_public_key: string | null;
  sender_device_id: string | null;
  recipient_device_id: string | null;
  message_group_id: string | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  deleted_for_everyone: boolean;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_signed_in" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversation_id") ?? "";
  const sinceIso = url.searchParams.get("since_iso") ?? "";
  const limitRaw = url.searchParams.get("limit") ?? "50";

  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_conversation_id" },
      { status: 400 },
    );
  }
  if (!sinceIso || Number.isNaN(Date.parse(sinceIso))) {
    return NextResponse.json(
      { ok: false, error: "invalid_since_iso" },
      { status: 400 },
    );
  }
  const limitParsed = Number.parseInt(limitRaw, 10);
  const limit =
    Number.isFinite(limitParsed) && limitParsed > 0
      ? Math.min(limitParsed, HARD_MAX_LIMIT)
      : HARD_MAX_LIMIT;

  // Participant gate · the service lookup is cheap and the only
  // authoritative source for conversation membership.
  const conversation = await getPeerConversationById(conversationId);
  if (!conversation) {
    return NextResponse.json(
      { ok: false, error: "conversation_not_found" },
      { status: 404 },
    );
  }
  const viewerId = session.account.id;
  if (
    conversation.participant_a_id !== viewerId &&
    conversation.participant_b_id !== viewerId
  ) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select(
      [
        "id",
        "sender_account_id",
        "sent_at",
        "read_at",
        "encrypted",
        "body",
        "ciphertext",
        "nonce",
        "sender_public_key",
        "sender_device_id",
        "recipient_device_id",
        "message_group_id",
        "reply_to_id",
        "attachment_url",
        "attachment_type",
        "deleted_for_everyone",
      ].join(","),
    )
    .eq("conversation_id", conversationId)
    .gt("sent_at", sinceIso)
    .order("sent_at", { ascending: true })
    .limit(limit);
  if (error) {
    return NextResponse.json(
      { ok: false, error: `fetch_failed: ${error.message}` },
      { status: 500 },
    );
  }

  const rows: SinceMessageRow[] = (data ?? []).map((r) => {
    const raw = r as unknown as {
      id: string;
      sender_account_id: string;
      sent_at: string;
      read_at: string | null;
      encrypted: boolean | null;
      body: string;
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
      id: raw.id,
      sender_account_id: raw.sender_account_id,
      sent_at: raw.sent_at,
      read_at: raw.read_at,
      encrypted: Boolean(raw.encrypted),
      body: raw.body,
      ciphertext_b64: raw.ciphertext ?? null,
      nonce_b64: raw.nonce ?? null,
      sender_public_key: raw.sender_public_key,
      sender_device_id: raw.sender_device_id,
      recipient_device_id: raw.recipient_device_id,
      message_group_id: raw.message_group_id,
      reply_to_id: raw.reply_to_id,
      attachment_url: raw.attachment_url,
      attachment_type: raw.attachment_type,
      deleted_for_everyone: Boolean(raw.deleted_for_everyone),
    };
  });

  return NextResponse.json({ ok: true, messages: rows });
}

/** Public ONLY so the R1 deterministic test suite can grep-static the
 *  hard cap. The route code path above uses the local constant. */
export const R1_SINCE_HARD_MAX_LIMIT = HARD_MAX_LIMIT;

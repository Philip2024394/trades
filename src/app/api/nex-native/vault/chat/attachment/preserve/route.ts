// POST /api/nex-native/vault/chat/attachment/preserve
//
// Vault Phase B · Commit B.2 · delegates to the sealed Phase A.1
// attachment-copy flow (vault-persistence-service.ts) for a single
// message. Does NOT introduce any plaintext handling or new persistence
// pathway · reuses `copyConversationAttachmentsToVault` which is
// idempotent via nex_vault_file.source_message_id partial unique
// index (migration 140). The route is a thin owner-gated trigger.
//
// Request body: { conversation_id: uuid, message_id: uuid }
//
// Behaviour:
//   · If the attachment has already been preserved (vault_file row
//     exists with matching source_message_id) → 200 { state:
//     "already_preserved", vault_file_id }.
//   · Otherwise invoke the sealed batch copy for the conversation ·
//     the sealed function skips already-copied attachments and
//     processes new ones · re-query by source_message_id to return
//     the resulting vault_file_id · 200 { state: "preserved" }.
//
// Note on encryption: the sealed Phase A.1 copy lands the attachment
// bytes in migration_state='legacy' (plaintext in the private Vault
// bucket). The sealed A.6 migration runner on vault/home encrypts
// legacy files to 'encrypted' on next Vault unlock. This route does
// NOT encrypt the attachment inline · it only persists · the same
// posture every other Vault attachment uses today.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { currentSessionKey } from "@/lib/nex-native/app/security-request";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { requireStepUp } from "@/lib/nex-native/vault/step-up-service";
import { assertIsParticipant } from "@/lib/nex-native/vault/conversation-envelope-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { findVaultFileBySourceMessage } from "@/lib/nex-native/vault-file-service";
import { copyConversationAttachmentsToVault } from "@/lib/nex-native/vault-persistence-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  conversation_id?: unknown;
  message_id?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const sessionKey = currentSessionKey(req);
  if (!sessionKey) {
    return NextResponse.json({ ok: false, error: "no_session_token" }, { status: 401 });
  }
  const nexSessionId = await lookupNexSessionId({
    accountId: session.account.id,
    supabaseSessionKey: sessionKey,
  });
  if (!nexSessionId) {
    return NextResponse.json(
      { ok: false, error: "session_touch_not_yet_landed" },
      { status: 409 },
    );
  }

  const unlock = await requireStepUp(nexSessionId, { vault_unlock: "fresh" });
  if (!unlock.ok) {
    return NextResponse.json(
      { ok: false, error: "step_up_required", required: ["vault_unlock"] },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  const messageId = typeof body.message_id === "string" ? body.message_id : "";
  if (!conversationId || !messageId) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  // Account must be a participant of the conversation · otherwise
  // return forbidden (same posture as mint · existence hidden).
  const participant = await assertIsParticipant({
    accountId: session.account.id,
    conversationId,
  });
  if (!participant.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Message must belong to the conversation and carry an attachment.
  const { data: msgData, error: msgErr } = await nexSupabaseAdmin
    .from("nex_peer_message")
    .select("id, conversation_id, attachment_url")
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) {
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 500 });
  }
  if (!msgData) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const msg = msgData as {
    id: string;
    conversation_id: string;
    attachment_url: string | null;
  };
  if (msg.conversation_id !== conversationId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!msg.attachment_url) {
    return NextResponse.json({ ok: false, error: "no_attachment" }, { status: 400 });
  }

  // Idempotency fast path.
  const already = await findVaultFileBySourceMessage(session.account.id, messageId);
  if (already) {
    return NextResponse.json({
      ok: true,
      state: "already_preserved",
      vault_file_id: already.id,
    });
  }

  // Delegate to the sealed A.1 copy flow · idempotent per-attachment
  // via source_message_id partial unique index. The sealed function
  // iterates every attachment in the conversation and skips those
  // already copied · the net effect for this request is "copy this
  // one + any siblings that were missed earlier".
  await copyConversationAttachmentsToVault(session.account.id, conversationId);

  const after = await findVaultFileBySourceMessage(session.account.id, messageId);
  if (!after) {
    // Copy did not land for this message (e.g. SSRF guard rejected
    // the source URL · fetch failed · transient). Report explicitly
    // so the client orchestrator can retry.
    return NextResponse.json(
      { ok: false, error: "copy_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    state: "preserved",
    vault_file_id: after.id,
  });
}

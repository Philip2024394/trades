// src/app/api/nex-native/chat/conversations/route.ts
//
// Wave 5 · GET /api/nex-native/chat/conversations
// -----------------------------------------------
// Returns the inbox for the current NEX user: every conversation the
// caller participates in (either as business seat or customer), newest
// activity first, with business + product context, last message
// preview, and unread count.
//
// Auth: same session boundary as Wave 4 (Bearer JWT or ssr cookie).
// Zero business logic here · just plumbing.

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import * as conversationService from "@/lib/nex-native/conversation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await resolveNexAppSession(req);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));

  const summaries = await conversationService.listConversationsForAccount(session.account.id, { limit });
  return NextResponse.json({
    account: { id: session.account.id, display_name: session.account.display_name },
    conversations: summaries.map((s) => ({
      id: s.conversation.id,
      business_id: s.conversation.business_id,
      about_product_id: s.conversation.about_product_id,
      created_at: s.conversation.created_at,
      my_side: s.my_side,
      my_last_read_at: s.my_last_read_at,
      business: s.business,
      product: s.product,
      last_message: s.last_message
        ? {
            id: s.last_message.id,
            sender_account_id: s.last_message.sender_account_id,
            body: s.last_message.body.length > 240 ? s.last_message.body.slice(0, 240) + "…" : s.last_message.body,
            created_at: s.last_message.created_at,
          }
        : null,
      other_display_name: s.other_display_name,
      unread_count: s.unread_count,
    })),
  });
}

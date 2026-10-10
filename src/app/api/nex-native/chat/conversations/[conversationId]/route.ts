// src/app/api/nex-native/chat/conversations/[conversationId]/route.ts
//
// Wave 5 · GET /api/nex-native/chat/conversations/:conversationId
// ---------------------------------------------------------------
// Returns the full message history of a specific conversation the
// caller participates in, plus business + product context. Marks the
// conversation "read" for the caller as a side-effect.
//
// Access enforcement:
//   · caller must be authenticated (Bearer JWT or ssr cookie)
//   · caller must be a participant in the conversation
//   otherwise 401/403.

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as conversationService from "@/lib/nex-native/conversation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ conversationId: string }> }
) {
  const session = await resolveNexAppSession(req);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { conversationId } = await ctx.params;
  if (!conversationId) return NextResponse.json({ error: "missing_conversationId" }, { status: 400 });

  // Participation check · service-role bypasses RLS · this route is the
  // authorisation boundary
  const participation = await conversationService.getParticipation(conversationId, session.account.id);
  if (!participation) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  const conv = await conversationService.getConversationById(conversationId);
  if (!conv) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });

  const [business, product, messages] = await Promise.all([
    businessService.getBusinessById(conv.business_id),
    conv.about_product_id ? productService.getProductById(conv.about_product_id) : Promise.resolve(null),
    conversationService.listMessages(conversationId),
  ]);
  if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 500 });

  // Update last_read_at as a side-effect · idempotent · does not affect the
  // response the caller sees (except on next fetch, unread_count will drop).
  await conversationService.updateLastRead(conversationId, session.account.id);

  return NextResponse.json({
    account: { id: session.account.id, display_name: session.account.display_name },
    conversation: {
      id: conv.id,
      business_id: conv.business_id,
      about_product_id: conv.about_product_id,
      created_at: conv.created_at,
    },
    my_side: participation.side,
    business: { id: business.id, display_name: business.display_name, slug: business.slug },
    product: product ? { id: product.id, name: product.name, price_pence: product.price_pence, currency: product.currency } : null,
    messages: messages.map((m) => ({
      id: m.id,
      sender_account_id: m.sender_account_id,
      body: m.body,
      created_at: m.created_at,
    })),
  });
}

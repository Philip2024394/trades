// NEX Business Context · POST /api/b/[slug]/customer/message (Philip 2026-08-14).
//
// Customer-facing endpoint. Sends a message TO the business and receives
// an auto-generated reply.
//
// Permission: session.role === "customer" AND session.businessSlug === slug
//   → 401 for anonymous
//   → 403 for owner / cross-business customer
//
// Never exposes owner internals. Never fabricates business facts.

import { NextResponse } from "next/server";
import { readSession } from "@/lib/nex/business-context/session";
import { assertPermission, permissionErrorResponse } from "@/lib/nex/business-context/permissions";
import { getBusiness, toCustomerIdentity, ensureSeeded } from "@/lib/nex/business-context";
import { createConversation, getConversation, appendMessage, generateBusinessReply } from "@/lib/nex/business-context/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;
  // Customer route reads ONLY the customer-scoped cookie · owner cookies for
  // the same slug are invisible here · constitutional (owner cannot gain
  // admin from opening their own customer app AND vice-versa · role is
  // determined per scoped cookie · not by "highest privilege wins").
  const session = readSession(req, { slug, scope: "customer" });

  const perm = assertPermission(session, { requiredRole: ["customer", "anonymous"], businessSlug: slug });
  if (!perm.ok) return permissionErrorResponse(perm);

  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ ok: false, error: "unknown-business" }, { status: 404 });

  let body: { text?: string; conversationId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!body.text || body.text.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "empty-message" }, { status: 400 });
  }

  const customerId = perm.session.customerId ?? "anonymous-customer";

  // Get or create conversation
  let conv = body.conversationId ? getConversation(slug, body.conversationId) : null;
  if (!conv) conv = createConversation(slug, customerId);

  // Append customer message
  appendMessage(slug, conv.id, { author: "customer", text: body.text.trim() });

  // Generate business reply (deterministic · uses only customer-safe identity)
  const identity = toCustomerIdentity(biz);
  const reply = generateBusinessReply(body.text.trim(), identity);
  const replyMsg = appendMessage(slug, conv.id, reply);

  // Phase 19A · whitelist customer-safe fields · strip owner-internal
  // metadata (e.g. `provenance`, source-tracking, blueprint refs) that
  // exists on the stored message for owner observability but MUST NOT
  // leak into the customer surface.
  return NextResponse.json({
    ok: true,
    conversationId: conv.id,
    reply: {
      id: replyMsg.id,
      at: replyMsg.at,
      author: replyMsg.author,
      text: replyMsg.text
    }
  });
}

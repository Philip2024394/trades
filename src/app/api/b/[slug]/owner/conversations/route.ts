// NEX Business Context · GET /api/b/[slug]/owner/conversations (Philip 2026-08-14).
//
// Owner-facing endpoint. Lists conversations the customers had with this
// business. This is the "Conversations" module in the NEX workspace side
// drawer.
//
// Permission: session.role === "owner" AND session.businessSlug === slug
//   → 401 for anonymous
//   → 403 for customer session or cross-business owner
//
// Owner sees provenance (proves NEX responses were traceable · not fabricated).

import { NextResponse } from "next/server";
import { readSession } from "@/lib/nex/business-context/session";
import { assertPermission, permissionErrorResponse } from "@/lib/nex/business-context/permissions";
import { getBusiness, ensureSeeded } from "@/lib/nex/business-context";
import { listConversationsForBusiness } from "@/lib/nex/business-context/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;
  const session = readSession(req, { slug, scope: "owner" });

  const perm = assertPermission(session, { requiredRole: "owner", businessSlug: slug });
  if (!perm.ok) return permissionErrorResponse(perm);

  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ ok: false, error: "unknown-business" }, { status: 404 });

  const conversations = listConversationsForBusiness(slug).map((c) => ({
    id: c.id,
    customerId: c.customerId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
    lastMessage: c.messages[c.messages.length - 1] ?? null,
    // FULL message trail — owner has permission
    messages: c.messages
  }));

  return NextResponse.json({
    ok: true,
    business: { slug: biz.slug, displayName: biz.blueprint.identity.displayName },
    conversations,
    total: conversations.length
  });
}

// NEX Mutations · POST /api/b/[slug]/owner/nex/apply (Philip 2026-08-14).
// Owner-only. Requires proposalId + confirmed=true.
// Applies the mutation · records audit · updates the business registry.

import { NextResponse } from "next/server";
import { readSession, assertPermission, permissionErrorResponse } from "@/lib/nex/business-context";
import { ensureSeeded, getBusiness, registerBusiness } from "@/lib/nex/business-context";
import { applyProposedMutation } from "@/lib/nex/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;

  const session = readSession(req, { slug, scope: "owner" });
  const perm = assertPermission(session, { requiredRole: "owner", businessSlug: slug });
  if (!perm.ok) return permissionErrorResponse(perm);
  if (!session.ownerAccountId) return NextResponse.json({ ok: false, error: "session-missing-owner-id" }, { status: 400 });

  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ ok: false, error: "unknown-business" }, { status: 404 });

  let body: { proposalId?: string; confirmed?: boolean; undoOfMutationId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!body.proposalId) return NextResponse.json({ ok: false, error: "missing-proposalId" }, { status: 400 });
  if (body.confirmed !== true) return NextResponse.json({ ok: false, error: "explicit-approval-required · set confirmed=true" }, { status: 400 });

  const result = applyProposedMutation(
    biz.blueprint,
    body.proposalId,
    session.ownerAccountId,
    body.undoOfMutationId ? { undoOfMutationId: body.undoOfMutationId } : undefined
  );
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  // Persist the new Blueprint back to the business registry — customer chat
  // + owner workspace re-derive from this on their next request.
  registerBusiness(slug, result.blueprint);

  return NextResponse.json({
    ok: true,
    audit: result.audit,
    say: `Done. ${result.audit.kind} applied · recorded against ${slug}.`,
    newRevision: result.blueprint.meta.revision
  });
}

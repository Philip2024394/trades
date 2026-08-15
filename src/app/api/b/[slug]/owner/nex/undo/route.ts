// NEX Mutations · POST /api/b/[slug]/owner/nex/undo (Philip 2026-08-14 · Phase 16).
//
// Owner-only. Given a prior mutationId, produce a governed UNDO PROPOSAL
// (same shape as any other proposal · same propose/approve/apply flow).
// The apply endpoint links the two audit entries via undoOfMutationId.

import { NextResponse } from "next/server";
import { readSession, assertPermission, permissionErrorResponse } from "@/lib/nex/business-context";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";
import { proposeUndo } from "@/lib/nex/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;

  const session = readSession(req, { slug, scope: "owner" });
  const perm = assertPermission(session, { requiredRole: "owner", businessSlug: slug });
  if (!perm.ok) return permissionErrorResponse(perm);

  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ ok: false, error: "unknown-business" }, { status: 404 });

  let body: { mutationId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }
  if (!body.mutationId) return NextResponse.json({ ok: false, error: "missing-mutationId" }, { status: 400 });

  const undoResult = proposeUndo(biz.blueprint, slug, body.mutationId);
  if (!undoResult.ok) {
    return NextResponse.json({ ok: false, error: undoResult.error, resolution: undoResult.resolution }, { status: 400 });
  }

  const p = undoResult.proposeResult.proposal;
  return NextResponse.json({
    ok: true,
    proposal: p,
    undoOfMutationId: undoResult.originalMutationId,
    currentValueDiffersFromOriginalAfter: undoResult.currentValueDiffersFromOriginalAfter,
    say: `Restore previous value?\n\n${p.describe}` +
      (undoResult.currentValueDiffersFromOriginalAfter
        ? `\n\n⚠  Note: this field has been changed since. Undo will still restore the recorded value.`
        : "")
  });
}

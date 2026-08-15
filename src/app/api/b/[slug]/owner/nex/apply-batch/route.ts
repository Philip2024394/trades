// NEX Mutations · POST /api/b/[slug]/owner/nex/apply-batch (Philip 2026-08-14 · Phase 17B).
//
// One approval, N applies. Each individual mutation still records its own
// audit entry · stamped with the same batchId to preserve the grouping.
// If any sub-apply fails, partial results are surfaced (never hidden).

import { NextResponse } from "next/server";
import { readSession, assertPermission, permissionErrorResponse } from "@/lib/nex/business-context";
import { ensureSeeded, getBusiness, registerBusiness } from "@/lib/nex/business-context";
import { applyBatch } from "@/lib/nex/mutations";

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

  let body: { batchId?: string; confirmed?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }
  if (!body.batchId) return NextResponse.json({ ok: false, error: "missing-batchId" }, { status: 400 });
  if (body.confirmed !== true) return NextResponse.json({ ok: false, error: "explicit-approval-required · set confirmed=true" }, { status: 400 });

  const result = applyBatch(biz.blueprint, body.batchId, session.ownerAccountId);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      partiallyApplied: result.partiallyApplied ?? [],
      say: `The batch was rejected: ${result.error}` + ((result.partiallyApplied ?? []).length > 0 ? ` (${(result.partiallyApplied ?? []).length} sub-changes were already applied before this failure).` : "")
    }, { status: 400 });
  }

  registerBusiness(slug, result.blueprint);
  return NextResponse.json({
    ok: true,
    audits: result.audits,
    batchId: body.batchId,
    newRevision: result.blueprint.meta.revision,
    say: `Done. ${result.audits.length} changes applied together · Blueprint rev ${result.blueprint.meta.revision}.`
  });
}

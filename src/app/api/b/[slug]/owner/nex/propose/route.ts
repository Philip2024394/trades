// NEX Mutations · POST /api/b/[slug]/owner/nex/propose (Philip 2026-08-14).
// Owner-only. Accepts a plain-English instruction OR a structured proposal.
// NEVER applies — only returns the proposal for owner approval.

import { NextResponse } from "next/server";
import { readSession, assertPermission, permissionErrorResponse } from "@/lib/nex/business-context";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";
import { interpret, proposeMutation } from "@/lib/nex/mutations";
import type { MutationProposal } from "@/lib/nex/mutations";

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

  let body: { instruction?: string; proposal?: MutationProposal };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const interpreted = interpret(body.proposal ?? body.instruction ?? "");
  if (!interpreted.ok) {
    return NextResponse.json({ ok: false, error: interpreted.error, candidates: interpreted.candidates }, { status: 400 });
  }

  const result = proposeMutation(biz.blueprint, slug, interpreted.proposal);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, resolution: result.resolution }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    proposal: result.proposal,
    say: `${result.proposal.describe}\n\nApply?`
  });
}

// NEX Mutations · POST /api/b/[slug]/owner/nex/propose-batch (Philip 2026-08-14 · Phase 17B).
//
// Owner sends ONE compound instruction · NEX splits · interprets each
// fragment · validates each · returns a single change plan.
// If any fragment is unclear, NEX asks (never silently drops).
// If any fragment fails validation, the whole batch is rejected up-front.

import { NextResponse } from "next/server";
import { readSession, assertPermission, permissionErrorResponse } from "@/lib/nex/business-context";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";
import { proposeBatch } from "@/lib/nex/mutations";

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

  let body: { instruction?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const instr = String(body.instruction ?? "").trim();
  if (!instr) return NextResponse.json({ ok: false, error: "missing-instruction" }, { status: 400 });

  const result = proposeBatch(biz.blueprint, slug, instr);
  if (!result.ok) {
    // Ambiguity is a legitimate honest state · we surface the specific fragments
    return NextResponse.json({
      ok: false,
      error: result.error,
      unclearFragments: result.unclearFragments ?? [],
      needsClarification: (result.unclearFragments ?? []).length > 0,
      say: (result.unclearFragments ?? []).length > 0
        ? `I understood some of that, but not all. Could you rephrase or clarify:\n\n${(result.unclearFragments ?? []).map((f) => `  · "${f}"`).join("\n")}`
        : result.error
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    batch: result.batch,
    say: `I've prepared ${result.batch.proposals.length} change${result.batch.proposals.length === 1 ? "" : "s"}:\n\n${result.batch.planDescription}\n\nApply all?`
  });
}

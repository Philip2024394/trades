// POST /api/studio/versions/[id]/restore
//
// Rollback semantics:
//   • Never mutates a historical published row (immutable timeline).
//   • Overwrites the current DRAFT with the target version's layout_json.
//     If no draft exists yet for that (merchant, brand, page, breakpoint),
//     inserts a new draft.
//   • Merchant then re-publishes to make the restore go live — which
//     creates yet another immutable snapshot in the history. So even
//     "restore then republish" leaves a full audit trail.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const target = await supabaseAdmin
    .from("studio_layouts")
    .select("id, page_id, breakpoint, layout_json, version")
    .eq("id", id)
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("status", "published")
    .maybeSingle();
  if (target.error || !target.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const pageId = target.data.page_id;
  const breakpoint = target.data.breakpoint;

  const existingDraft = await supabaseAdmin
    .from("studio_layouts")
    .select("id")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "draft")
    .maybeSingle();

  if (existingDraft.data) {
    const upd = await supabaseAdmin
      .from("studio_layouts")
      .update({ layout_json: target.data.layout_json })
      .eq("id", existingDraft.data.id);
    if (upd.error) {
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
  } else {
    const ins = await supabaseAdmin.from("studio_layouts").insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: pageId,
      breakpoint,
      layout_json: target.data.layout_json,
      status: "draft",
      version: 1
    });
    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    restoredFrom: target.data.id,
    restoredVersion: target.data.version,
    pageId
  });
}

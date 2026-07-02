// GET /api/studio/versions/[id]
//   Returns the full layout_json for a single historical version so
//   the editor can preview it before restoring.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const res = await supabaseAdmin
    .from("studio_layouts")
    .select("id, page_id, breakpoint, version, published_at, layout_json")
    .eq("id", id)
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("status", "published")
    .maybeSingle();
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  if (!res.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, version: res.data });
}

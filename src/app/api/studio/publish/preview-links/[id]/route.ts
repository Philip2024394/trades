// DELETE /api/studio/publish/preview-links/[id]
//
// Soft-revokes the preview link. Reviewers who still have the URL will
// get a 404 from /studio/share/<token>.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const upd = await supabaseAdmin
    .from("studio_preview_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .is("revoked_at", null);
  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

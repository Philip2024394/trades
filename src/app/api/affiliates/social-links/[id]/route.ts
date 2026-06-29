// DELETE /api/affiliates/social-links/[id] — remove an affiliate's
// own social link. Validates ownership before deleting.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  const { id } = await params;
  const existing = await supabaseAdmin
    .from("hammerex_affiliate_social_links")
    .select("id, affiliate_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing.data || existing.data.affiliate_id !== session.affiliate_id) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 }
    );
  }
  await supabaseAdmin
    .from("hammerex_affiliate_social_links")
    .delete()
    .eq("id", id);
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "social_link.delete",
    target_id: id
  });
  return NextResponse.json({ ok: true });
}

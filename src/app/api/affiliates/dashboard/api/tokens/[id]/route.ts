// DELETE /api/affiliates/dashboard/api/tokens/[id] — soft-revoke a
// token by stamping revoked_at. The row stays for audit; auth route
// rejects any token with revoked_at not null.
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
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }
  const { id } = await params;
  const upd = await supabaseAdmin
    .from("hammerex_affiliate_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("affiliate_id", session.affiliate_id)
    .is("revoked_at", null);
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "api_token.revoke",
    target_id: id
  });
  return NextResponse.json({ ok: true });
}

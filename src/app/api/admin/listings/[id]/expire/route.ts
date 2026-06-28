// POST /api/admin/listings/<id>/expire
//
// Manually flips a listing's tier to app_expired and clears
// paid_expires_at. Auth: the same xrated_admin_session cookie used by
// the /admin dashboard. After the write we 303-redirect back to
// /admin/payments so the table refreshes cleanly when the form lives
// in the row.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ tier: "app_expired", paid_expires_at: null })
    .eq("id", id);

  if (upd.error) {
    console.error("[admin/expire] update failed:", upd.error);
    return NextResponse.json(
      { error: `Update failed: ${upd.error.message}` },
      { status: 500 }
    );
  }

  const origin = new URL(req.url).origin;
  const referer = req.headers.get("referer");
  const back =
    referer && referer.startsWith(origin)
      ? referer
      : `${origin}/admin/payments`;
  return NextResponse.redirect(back, { status: 303 });
}

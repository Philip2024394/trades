// POST /api/admin/listings/<id>/extend
//
// Bumps paid_expires_at by 30 days from whichever is later: the existing
// expiry or right now. Also flips tier back to app_paid if it was sitting
// at app_expired (so the listing comes back to life with one click). Auth
// matches the dashboard's signed cookie.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXTEND_DAYS = 30;

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

  const current = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("tier, paid_expires_at")
    .eq("id", id)
    .maybeSingle();

  if (current.error || !current.data) {
    return NextResponse.json(
      { error: "Listing not found" },
      { status: 404 }
    );
  }

  // Start from whichever is later — current expiry or now — so an
  // already-active listing earns extra runway instead of losing days.
  const base = current.data.paid_expires_at
    ? new Date(current.data.paid_expires_at).getTime()
    : 0;
  const startMs = Math.max(base, Date.now());
  const newExpiry = new Date(startMs + EXTEND_DAYS * DAY_MS).toISOString();

  const patch: Record<string, unknown> = { paid_expires_at: newExpiry };
  // Re-activating an expired listing — flip back to app_paid. We don't
  // touch app_verified or app_trial because the admin clearly wants to
  // resurrect a paid sub, not promote it.
  if (current.data.tier === "app_expired") {
    patch.tier = "app_paid";
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", id);

  if (upd.error) {
    console.error("[admin/extend] update failed:", upd.error);
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

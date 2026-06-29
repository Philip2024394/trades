// POST /api/admin/password-recovery/sent
//
// Called by the /admin/password-recovery page when the admin clicks the
// per-row "Send via WhatsApp" button. Stamps password_recovery_sent_at
// on the listing so:
//   1. The row leaves the pending queue (partial index excludes it).
//   2. The recovery_code becomes redeemable at /trade-off/set-password
//      (the queue-snooping guard requires sent_at IS NOT NULL).
//
// Auth: the shared xrated_admin_session HMAC cookie.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { listing_id?: unknown };
  try {
    body = (await req.json()) as { listing_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const listingId =
    typeof body.listing_id === "string" ? body.listing_id.trim() : "";
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ password_recovery_sent_at: new Date().toISOString() })
    .eq("id", listingId)
    // Only mark sent if there's actually a pending request — defensive
    // guard against the admin button being replayed after the row's
    // already been cleared by a successful redemption.
    .not("password_recovery_requested_at", "is", null);

  if (upd.error) {
    console.error("[admin/password-recovery/sent] update failed:", upd.error);
    return NextResponse.json(
      { error: `Update failed: ${upd.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

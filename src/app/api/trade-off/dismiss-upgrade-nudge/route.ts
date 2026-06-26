// POST /api/trade-off/dismiss-upgrade-nudge
// Tradie clicked "Remind me later" on the WhatsApp-leads nudge modal.
// Body: { slug, edit_token } — token must match the listing's edit_token.
// Sets upgrade_nudge_dismissed_at = now() so the modal stays hidden for
// 7 days (re-evaluated client-side).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const token = typeof body.edit_token === "string" ? body.edit_token.trim() : "";
  if (!slug || !token) {
    return NextResponse.json({ ok: false, error: "Missing slug or token." }, { status: 400 });
  }

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (row.data.edit_token !== token) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 403 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ upgrade_nudge_dismissed_at: new Date().toISOString() })
    .eq("id", row.data.id);
  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// GET /api/canteens/[slug]/membership
//
// Lightweight probe for the canteen page's header — tells the client
// whether the viewer is a member, the host, or neither so it can
// swap between Join / Joined / Manage states.
//
// Anonymous callers get { isMember: false, isHost: false } — the
// endpoint never fails on missing session; the header falls back to
// the "not a member" state.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const viewerSlug = await getMerchantSlug();
  if (!viewerSlug) {
    return NextResponse.json({ ok: true, isMember: false, isHost: false, viewerSlug: null });
  }

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", slug)
    .maybeSingle();
  if (canteen.error || !canteen.data) {
    return NextResponse.json({ ok: true, isMember: false, isHost: false, viewerSlug });
  }

  const isHost = canteen.data.host_slug === viewerSlug;

  // Host is always considered a member (they own the canteen). Skip
  // the extra DB round-trip when we already know the answer.
  if (isHost) {
    return NextResponse.json({ ok: true, isMember: true, isHost: true, viewerSlug });
  }

  const member = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("id")
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", viewerSlug)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    isMember: Boolean(member.data),
    isHost,
    viewerSlug
  });
}

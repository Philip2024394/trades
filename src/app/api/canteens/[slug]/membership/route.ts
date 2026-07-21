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
import { MOCK_CANTEENS } from "@/lib/canteens";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const viewerSlug = await getMerchantSlug();
  if (!viewerSlug) {
    return NextResponse.json({ ok: true, isMember: false, isHost: false, viewerSlug: null });
  }

  // Resolve the canteen. DB first; when missing, fall back to
  // MOCK_CANTEENS so fixture-defined canteens (uk-kitchen-fitters,
  // north-uk-sparks, uk-scaffolders) still report the correct host.
  // Without this fallback, hosts like Mike Watson show isHost=false
  // on their own fixture canteens and lose the Edit-mode toggle.
  const canteenRes = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", slug)
    .maybeSingle();
  let canteenData: { id: string; host_slug: string } | null = canteenRes.data;
  if (!canteenData) {
    const fixture = MOCK_CANTEENS.find((c) => c.slug === slug);
    if (fixture) {
      canteenData = { id: fixture.id, host_slug: fixture.hostSlug };
    }
  }
  if (!canteenData) {
    return NextResponse.json({ ok: true, isMember: false, isHost: false, viewerSlug });
  }

  // Dev override — when NETWORK_SESSION_STUB=1, treat any signed-in
  // viewer as the host of whichever canteen they open. Lets Philip
  // iterate on merchant-side UX without matching cookie values to
  // host_slug per canteen. Ignored entirely in production.
  const devForceHost = process.env.NETWORK_SESSION_STUB === "1";
  const isHost = devForceHost || canteenData.host_slug === viewerSlug;

  // Host is always considered a member (they own the canteen). Skip
  // the extra DB round-trip when we already know the answer.
  if (isHost) {
    return NextResponse.json({ ok: true, isMember: true, isHost: true, viewerSlug });
  }

  const member = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("id")
    .eq("canteen_id", canteenData.id)
    .eq("member_slug", viewerSlug)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    isMember: Boolean(member.data),
    isHost,
    viewerSlug
  });
}

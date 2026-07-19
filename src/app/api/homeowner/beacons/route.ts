// POST /api/homeowner/beacons — cross-post a SiteBook post to the Yard
// as a beacon so trades outside the project can see + respond.
//
// Body: { projectId, postId, title, body, city? }
//
// The Yard row is stripped of anything private — no owner name, no
// address, only approximate city (region). Trades respond via the
// existing beacon flow; responders can be accepted into the SiteBook
// project via the same channel that owner-directed invites use.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Beacons expire in 7 days by default (owner can always re-post).
const BEACON_TTL_DAYS = 7;

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    projectId?: string;
    postId?:    string;
    title?:     string;
    body?:      string;
    city?:      string;
  } | null;
  if (!body?.projectId || !body.body) {
    return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });
  }

  // Verify project ownership
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, address_city")
    .eq("id", body.projectId)
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();
  if (!proj.data) return NextResponse.json({ ok: false, error: "project-not-found" }, { status: 404 });
  const project = proj.data as { id: string; title: string; address_city: string | null };

  const expiresAt = new Date(Date.now() + BEACON_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const region    = body.city || project.address_city || homeowner.city || null;
  const title     = (body.title?.trim() || project.title).slice(0, 200);
  const bodyText  = body.body.trim().slice(0, 4000);

  const ins = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      // Homeowner-origin beacon — listing_id + trade_slug are null,
      // sitebook_project_id + sitebook_homeowner_id carry the link.
      listing_id:            null,
      trade_slug:            null,
      kind:                  "beacon",
      title,
      body:                  bodyText,
      country:               "UK",
      region,
      status:                "live",
      sitebook_project_id:   project.id,
      sitebook_homeowner_id: homeowner.id,
      expires_at:            expiresAt
    })
    .select("id")
    .maybeSingle();

  if (ins.error || !ins.data) {
    console.error("[homeowner/beacons] insert failed", ins.error);
    return NextResponse.json({ ok: false, error: "insert-failed", detail: ins.error?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, beaconId: ins.data.id });
}

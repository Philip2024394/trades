// POST /api/homeowner/projects/[id]/publish — publish a draft project.
// Fires the beacon: creates a hammerex_trade_off_yard_posts row with
// kind='beacon' linked back to this SiteBook project. The existing
// beacon SLA sweep (/api/cron/beacon-sla-sweep) handles trade
// notifications and the response flow.
//
// When a trade responds to the beacon, a downstream hook creates a
// hammerex_sitebook_members row automatically (see
// /api/merchant/sitebook/beacon-response which is called by the
// existing beacon-response flow).

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookProject } from "@/lib/homeowners/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default fanout radius (km) when the homeowner didn't specify
const DEFAULT_BEACON_RADIUS_KM = 25;

// Default beacon TTL — 48 hours for SiteBook beacons (longer than
// urgent yard beacons because SiteBook projects usually have more
// planning runway).
const BEACON_TTL_HOURS = 48;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const projRes = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("*")
    .eq("id", id)
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();
  if (!projRes.data) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  const project = projRes.data as SiteBookProject;

  const now       = new Date();
  const expiresAt = new Date(now.getTime() + BEACON_TTL_HOURS * 60 * 60 * 1000);

  // Build beacon body from project details
  const bodyLines: string[] = [];
  if (project.description) bodyLines.push(project.description);
  bodyLines.push("");
  bodyLines.push(`Trades needed: ${project.trade_types.join(", ") || "any"}`);
  if (project.address_city)     bodyLines.push(`Area: ${project.address_city}`);
  if (project.address_postcode) bodyLines.push(`Postcode: ${project.address_postcode}`);
  if (project.budget_min_gbp !== null && project.budget_max_gbp !== null) {
    bodyLines.push(`Budget: £${project.budget_min_gbp}-£${project.budget_max_gbp}`);
  }
  if (project.timeline) bodyLines.push(`Timeline: ${project.timeline}`);

  // Insert the beacon into the yard-posts system
  const beaconIns = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      kind:                    "beacon",
      title:                   project.title,
      body:                    bodyLines.join("\n"),
      author_display_name:     homeowner.first_name || "Homeowner",
      status:                  "live",
      beacon_expires_at:       expiresAt.toISOString(),
      beacon_radius_km:        DEFAULT_BEACON_RADIUS_KM,
      beacon_response_count:   0,
      sitebook_project_id:     project.id,
      sitebook_homeowner_id:   homeowner.id,
      // Trade filter (existing yard schema may use tags/trade_types field)
      trade_types_filter:      project.trade_types
    })
    .select("id")
    .maybeSingle();

  // Update the project's own status
  await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .update({
      status:           "active",
      posted_to_beacon: true,
      beacon_posted_at: now.toISOString()
    })
    .eq("id", id);

  // Log SiteBook event
  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id:  id,
    event_type:  "project_published",
    actor_type:  "homeowner",
    actor_id:    homeowner.id,
    actor_name:  homeowner.first_name || homeowner.email,
    metadata:    { beacon_id: beaconIns.data?.id, ttl_hours: BEACON_TTL_HOURS }
  });

  return NextResponse.redirect(new URL(`/sitebook/${id}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}

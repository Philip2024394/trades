// GET /api/os/projects/[id]
//
// Full project view: latest specification + renders + timeline events
// scoped to this project. Access gated by an active claim.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { id: projectId } = await ctx.params;

  const { data: project } = await supabaseAdmin
    .from("os_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }

  // Check the caller has a claim on the parent property
  const { data: claim } = await supabaseAdmin
    .from("os_property_claims")
    .select("id")
    .eq("property_id", project.property_id)
    .eq("party_id", party.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "Project not found." },
      { status: 404 }
    );
  }

  const [specsRes, rendersRes, timelineRes] = await Promise.all([
    supabaseAdmin
      .from("os_specifications")
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false }),
    supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select("id, render_url, source_photo_url, leaf_slug, created_at, status")
      .eq("project_id", projectId)
      .eq("status", "complete")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("os_home_timeline_events")
      .select("*")
      .eq("project_id", projectId)
      .order("occurred_at", { ascending: false })
      .limit(50)
  ]);

  return NextResponse.json({
    ok: true,
    project,
    specifications: specsRes.data || [],
    renders: rendersRes.data || [],
    timeline: timelineRes.data || []
  });
}

// POST /api/homeowner/projects — create a new SiteBook project.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ProjectTimeline } from "@/lib/homeowners/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    title?: string; description?: string; trade_types?: string[];
    address_postcode?: string; address_city?: string;
    budget_min_gbp?: number; budget_max_gbp?: number;
    timeline?: ProjectTimeline;
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: "missing-title" }, { status: 400 });

  const ins = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .insert({
      homeowner_id:     homeowner.id,
      title:            body.title.trim(),
      description:      body.description || null,
      trade_types:      body.trade_types || [],
      address_postcode: body.address_postcode?.trim().toUpperCase() || null,
      address_city:     body.address_city?.trim() || null,
      budget_min_gbp:   body.budget_min_gbp ?? null,
      budget_max_gbp:   body.budget_max_gbp ?? null,
      timeline:         body.timeline || null,
      status:           "draft"
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) return NextResponse.json({ ok: false, error: "insert-failed" }, { status: 500 });

  // Log the creation event
  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id:  ins.data.id,
    event_type:  "project_created",
    actor_type:  "homeowner",
    actor_id:    homeowner.id,
    actor_name:  homeowner.first_name || homeowner.email
  });

  return NextResponse.json({ ok: true, projectId: ins.data.id });
}

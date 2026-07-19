// POST /api/homeowner/projects/[id]/hire — homeowner hires a trade
// (picks their quote). Body: { member_id: string }
//
// Moves the picked trade to status='hired' and exposes homeowner
// contact info (WhatsApp + full postcode) to them.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as { member_id?: string } | null;
  if (!body?.member_id) return NextResponse.json({ ok: false, error: "missing-member" }, { status: 400 });

  // Verify ownership
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title")
    .eq("id", projectId)
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();
  if (!proj.data) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  const now = new Date().toISOString();

  const memRes = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .update({ status: "hired", hired_at: now })
    .eq("id", body.member_id)
    .eq("project_id", projectId)
    .select("merchant_name")
    .maybeSingle();

  if (memRes.error || !memRes.data) return NextResponse.json({ ok: false, error: "update-failed" }, { status: 500 });

  await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .update({ status: "in-progress", started_at: now })
    .eq("id", projectId);

  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id: projectId,
    event_type: "trade_hired",
    actor_type: "homeowner",
    actor_id:   homeowner.id,
    actor_name: homeowner.first_name || homeowner.email,
    metadata:   { member_id: body.member_id }
  });

  const merchantName = (memRes.data as { merchant_name: string }).merchant_name;
  await supabaseAdmin.from("hammerex_sitebook_messages").insert({
    project_id:  projectId,
    author_type: "system",
    author_name: "SiteBook",
    body:        `${homeowner.first_name || "Homeowner"} hired ${merchantName} for this project.`
  });

  return NextResponse.json({ ok: true });
}

// POST /api/homeowner/projects/[id]/messages — post a message.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as { body?: string } | null;
  if (!body?.body?.trim()) return NextResponse.json({ ok: false, error: "empty-message" }, { status: 400 });

  // Verify ownership
  const projRes = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", id)
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();
  if (!projRes.data) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  const ins = await supabaseAdmin.from("hammerex_sitebook_messages").insert({
    project_id:  id,
    author_type: "homeowner",
    author_id:   homeowner.id,
    author_name: homeowner.first_name || homeowner.email,
    body:        body.body.trim(),
    visibility:  "all"
  });
  if (ins.error) return NextResponse.json({ ok: false, error: "insert-failed" }, { status: 500 });

  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id:  id,
    event_type:  "message_posted",
    actor_type:  "homeowner",
    actor_id:    homeowner.id,
    actor_name:  homeowner.first_name || homeowner.email
  });

  return NextResponse.json({ ok: true });
}

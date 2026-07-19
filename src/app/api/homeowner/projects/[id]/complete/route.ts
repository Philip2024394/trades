// POST /api/homeowner/projects/[id]/complete — mark project complete.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .update({ status: "complete", completed_at: now })
    .eq("id", id)
    .eq("homeowner_id", homeowner.id);
  if (upd.error) return NextResponse.json({ ok: false, error: "update-failed" }, { status: 500 });

  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id: id, event_type: "project_completed", actor_type: "homeowner",
    actor_id: homeowner.id, actor_name: homeowner.first_name || homeowner.email
  });

  return NextResponse.redirect(new URL(`/sitebook/${id}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}

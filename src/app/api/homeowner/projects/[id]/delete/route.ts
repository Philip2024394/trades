// POST /api/homeowner/projects/[id]/delete — delete project permanently.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  // Cascades via FK — all messages/photos/members/events/warranties for this project get deleted
  await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .delete()
    .eq("id", id)
    .eq("homeowner_id", homeowner.id);

  return NextResponse.redirect(new URL("/sitebook", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}

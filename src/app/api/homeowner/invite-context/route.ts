// GET /api/homeowner/invite-context — returns the currently-signed-in
// homeowner's first name, nickname, and live project list. Used by
// InviteModeWrapper on the canteens directory to seed the invitation
// modal without exposing homeowner data pre-session.
//
// Returns { ok: false } silently when unauthed so the wrapper can
// no-op cleanly.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false });

  const res = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, address_city, budget_min_gbp, budget_max_gbp, status")
    .eq("homeowner_id", homeowner.id)
    .in("status", ["active", "in-progress"])
    .order("created_at", { ascending: false });

  type Row = {
    id:             string;
    title:          string;
    address_city:   string | null;
    budget_min_gbp: number | null;
    budget_max_gbp: number | null;
  };
  const rows = (res.data as Row[]) ?? [];
  const projects = rows.map((r) => ({
    id:        r.id,
    title:     r.title,
    city:      r.address_city,
    budgetMin: r.budget_min_gbp,
    budgetMax: r.budget_max_gbp
  }));

  return NextResponse.json({
    ok: true,
    context: {
      firstName: homeowner.first_name,
      nickname:  homeowner.house_nickname,
      projects
    }
  });
}

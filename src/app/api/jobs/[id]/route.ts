// GET /api/jobs/[id]
//
// Fetch a Job by id or share_token. Returns the full record + actors
// + latest health + last N events. Permission check: caller must be
// listed as an actor OR the id must actually be a share_token.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Look up by id first, fall back to share_token
  let { data: job } = await supabaseAdmin
    .from("hammerex_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!job) {
    const alt = await supabaseAdmin
      .from("hammerex_jobs")
      .select("*")
      .eq("share_token", id)
      .maybeSingle();
    job = alt.data;
  }
  if (!job) return NextResponse.json({ ok: false, error: "job-not-found" }, { status: 404 });

  // Actor + permission resolution
  const merchantSlug = await getMerchantSlug();
  const homeowner    = merchantSlug ? null : await getHomeownerFromCookie();

  const [actorsRes, healthRes, eventsRes] = await Promise.all([
    supabaseAdmin.from("hammerex_job_actors").select("*").eq("job_id", job.id).is("removed_at", null),
    supabaseAdmin.from("hammerex_job_health").select("*").eq("job_id", job.id).maybeSingle(),
    supabaseAdmin.from("hammerex_job_events").select("*").eq("job_id", job.id).order("created_at", { ascending: false }).limit(30)
  ]);

  const actors = actorsRes.data ?? [];

  // Determine caller role
  let callerRole: string | null = null;
  if (merchantSlug) {
    callerRole = actors.find((a: any) => a.actor_kind === "trade" && a.actor_id === merchantSlug)?.role ?? null;
  } else if (homeowner) {
    callerRole = actors.find((a: any) => a.actor_kind === "homeowner" && a.actor_id === homeowner.id)?.role ?? null;
  }
  const isShareTokenAccess = id === job.share_token;
  if (!callerRole && !isShareTokenAccess) {
    // No access — return limited public view (spec only, no invoices etc)
    return NextResponse.json({
      ok:   true,
      view: "public",
      job:  {
        id:              job.id,
        title:           job.title,
        job_type_slug:   job.job_type_slug,
        preset_slug:     job.preset_slug,
        dimensions_json: job.dimensions_json,
        calculated_json: job.calculated_json,
        status:          job.status
      }
    });
  }

  return NextResponse.json({
    ok:          true,
    view:        callerRole ? "actor" : "share",
    caller_role: callerRole,
    job,
    actors,
    health:      healthRes.data ?? null,
    events:      eventsRes.data ?? []
  });
}

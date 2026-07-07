// GET /api/apps/job-diary/[jobId] — merchant loads full job with entries.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data: job } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const [entries, team, signoff] = await Promise.all([
    supabaseAdmin
      .from("app_job_diary_entries")
      .select("*")
      .eq("job_id", jobId)
      .order("occurred_at", { ascending: false }),
    supabaseAdmin
      .from("app_job_diary_team_members")
      .select("id, display_name, role")
      .eq("job_id", jobId),
    supabaseAdmin
      .from("app_job_diary_signoffs")
      .select("*")
      .eq("job_id", jobId)
      .maybeSingle()
  ]);
  return NextResponse.json({
    ok: true,
    job,
    entries: entries.data || [],
    team: team.data || [],
    signoff: signoff.data
  });
}

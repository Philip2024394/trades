// GET /api/site/editor/video/[job_id]
//
// Polling endpoint. Client hits this every 3s after /compose to know
// when the composed MP4 is ready. Returns the row's status + output_url
// (populated on completion).
//
// Auth: only the job owner can read status. Prevents job-id enumeration
// leaking cross-merchant output URLs.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ job_id: string }> }
): Promise<NextResponse> {
  const { job_id: jobId } = await ctx.params;
  if (!jobId) return NextResponse.json({ ok: false, error: "job_id_required" }, { status: 400 });

  const res = await supabaseAdmin
    .from("hammerex_site_editor_video_jobs")
    .select("id, status, output_url, error, owner_merchant_slug, owner_email, attempts, ran_at, completed_at, frame_slug, input_duration_s")
    .eq("id", jobId)
    .maybeSingle();
  if (res.error || !res.data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Owner-only.
  const slug  = await getMerchantSlug();
  const email = await readSiteBuyerEmailCookie();
  const owned = (res.data.owner_merchant_slug && res.data.owner_merchant_slug === slug)
             || (res.data.owner_email         && res.data.owner_email         === email);
  if (!owned) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ok:               true,
    id:               res.data.id,
    status:           res.data.status,
    output_url:       res.data.output_url,
    error:            res.data.error,
    attempts:         res.data.attempts,
    ran_at:           res.data.ran_at,
    completed_at:     res.data.completed_at,
    frame_slug:       res.data.frame_slug,
    input_duration_s: res.data.input_duration_s
  });
}

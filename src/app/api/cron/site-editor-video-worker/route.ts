// GET /api/cron/site-editor-video-worker
//
// Vercel Cron target — picks the oldest pending video composition
// job, marks it running, executes composeVideoJob, updates status to
// done (with output_url) or failed (with error + attempts+1).
//
// We process ONE job per invocation to stay inside Vercel's function
// time budget. Cron is scheduled every 30s in vercel.json so a
// backlog drains quickly. If the queue is empty the endpoint returns
// `{ ok: true, picked: null }` and exits cheap.
//
// Idempotency: the compose step is safe to re-run — same output
// path, upsert=true on Storage. Attempts counter prevents infinite
// retries after 3 failures.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { composeVideoJob, VIDEO_JOB_MAX_ATTEMPTS } from "@/lib/siteEditor/videoCompose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Match Vercel's Node function timeout ceiling (Pro 60s / Enterprise
// 900s). ffmpeg on a 60s video takes ~15-45s at libx264 veryfast.
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; also
  // permit plain manual runs by an admin with the service role key
  // in the same header for local testing.
  const auth = req.headers.get("authorization") ?? "";
  const cron = process.env.CRON_SECRET;
  if (cron && auth === `Bearer ${cron}`) return true;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (svc && auth === `Bearer ${svc}`)   return true;
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Pick oldest pending job under the retry cap.
  const pick = await supabaseAdmin
    .from("hammerex_site_editor_video_jobs")
    .select("id, input_url, frame_slug, overlays_json, paid, attempts")
    .eq("status", "pending")
    .lt("attempts", VIDEO_JOB_MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pick.error) {
    console.error("[video-worker] pick failed:", pick.error.message);
    return NextResponse.json({ ok: false, error: "pick_failed" }, { status: 500 });
  }
  if (!pick.data) {
    return NextResponse.json({ ok: true, picked: null });
  }
  const job = pick.data;

  // Claim the job — flip to running + bump attempts. If another
  // worker already ran, this UPDATE will still succeed but the
  // subsequent compose is idempotent (same output path).
  await supabaseAdmin
    .from("hammerex_site_editor_video_jobs")
    .update({
      status:     "running",
      attempts:   (job.attempts as number) + 1,
      ran_at:     new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);

  const result = await composeVideoJob({
    jobId:      String(job.id),
    inputUrl:   String(job.input_url),
    frameSlug:  String(job.frame_slug),
    overlays:   job.overlays_json as unknown as Parameters<typeof composeVideoJob>[0]["overlays"],
    paid:       Boolean(job.paid)
  });

  if (result.ok) {
    await supabaseAdmin
      .from("hammerex_site_editor_video_jobs")
      .update({
        status:              "done",
        output_url:          result.outputUrl,
        output_storage_path: result.storagePath,
        completed_at:        new Date().toISOString(),
        updated_at:          new Date().toISOString()
      })
      .eq("id", job.id);
    return NextResponse.json({ ok: true, picked: job.id, status: "done", output_url: result.outputUrl });
  }

  const finalStatus = (job.attempts as number) + 1 >= VIDEO_JOB_MAX_ATTEMPTS ? "failed" : "pending";
  await supabaseAdmin
    .from("hammerex_site_editor_video_jobs")
    .update({
      status:     finalStatus,
      error:      result.error.slice(0, 400),
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);
  return NextResponse.json({ ok: false, picked: job.id, status: finalStatus, error: result.error });
}

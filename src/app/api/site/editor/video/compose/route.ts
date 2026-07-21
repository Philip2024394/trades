// POST /api/site/editor/video/compose
//
// Client posts the current editor state + the previously-uploaded
// video URL. We insert a job row (status='pending'); a cron worker
// picks it up and runs ffmpeg to composite the overlays + watermark.
// Client polls GET /api/site/editor/video/[job_id] to know when the
// output is ready.
//
// Body:
//   {
//     input_url:        string,   (from /video/upload)
//     input_storage:    string,   (path returned by upload)
//     input_duration_s: number,
//     input_width:      number,
//     input_height:     number,
//     input_bytes:      number,
//     frame_slug:       string,
//     overlays:         ComposePayload (single-slide snapshot — see below)
//   }
//
// Response: { ok, job_id }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";
import { hasActiveSiteSubscription, hasBundlingTier } from "@/lib/siteAccess";
import { findFrame } from "@/lib/siteEditor/frames";
import type { ComposePayload } from "@/lib/siteEditor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  const emailCookie  = await readSiteBuyerEmailCookie();
  if (!merchantSlug && !emailCookie) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    input_url?:        unknown;
    input_storage?:    unknown;
    input_duration_s?: unknown;
    input_width?:      unknown;
    input_height?:     unknown;
    input_bytes?:      unknown;
    frame_slug?:       unknown;
    overlays?:         unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const inputUrl = typeof body.input_url === "string" ? body.input_url : "";
  const inputStorage = typeof body.input_storage === "string" ? body.input_storage : "";
  const duration = Number(body.input_duration_s);
  if (!inputUrl || !inputStorage || !Number.isFinite(duration) || duration <= 0 || duration > 60) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const frameSlug = typeof body.frame_slug === "string" ? body.frame_slug : "";
  if (!findFrame(frameSlug)) {
    return NextResponse.json({ ok: false, error: "invalid_frame" }, { status: 400 });
  }
  const overlays = body.overlays as ComposePayload | undefined;
  if (!overlays || typeof overlays !== "object" || overlays.version !== 1) {
    return NextResponse.json({ ok: false, error: "invalid_overlays" }, { status: 400 });
  }

  // Paid gate at compose time so the worker knows whether to burn
  // the watermark. Same rule the export endpoint uses for images.
  let paid = false;
  if (merchantSlug) {
    paid = (await hasActiveSiteSubscription(merchantSlug)) || (await hasBundlingTier(merchantSlug));
  }
  if (!paid && emailCookie) {
    const sub = await supabaseAdmin
      .from("hammerex_site_subscriptions")
      .select("id")
      .eq("buyer_email", emailCookie)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();
    if (sub.data) paid = true;
  }

  // Pull trim range from the overlays state's base slot. Worker
  // uses these to seek + trim inside ffmpeg. Defaults to full clip.
  const baseSlot = overlays.base ?? {};
  const trimFrom = typeof (baseSlot as { trimFrom?: number }).trimFrom === "number"
    ? (baseSlot as { trimFrom: number }).trimFrom : 0;
  const trimTo   = typeof (baseSlot as { trimTo?: number }).trimTo === "number"
    ? (baseSlot as { trimTo: number }).trimTo : duration;
  if (trimFrom < 0 || trimTo > duration + 0.1 || trimFrom >= trimTo) {
    return NextResponse.json({ ok: false, error: "invalid_trim" }, { status: 400 });
  }

  const ins = await supabaseAdmin
    .from("hammerex_site_editor_video_jobs")
    .insert({
      owner_merchant_slug: merchantSlug,
      owner_email:         emailCookie,
      input_storage_path:  inputStorage,
      input_url:           inputUrl,
      input_duration_s:    duration,
      input_width:         Number(body.input_width)  || null,
      input_height:        Number(body.input_height) || null,
      input_bytes:         Number(body.input_bytes)  || null,
      frame_slug:          frameSlug,
      overlays_json:       overlays as unknown as Record<string, unknown>,
      paid,
      status:              "pending"
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) {
    console.error("[video/compose] insert:", ins.error?.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, job_id: ins.data.id });
}

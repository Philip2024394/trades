// POST /api/videos/[id]/process-ai
// Runs the AI enrichment pipeline on a video row. Populates
// keywords, chapters, FAQs, tools/materials/products detected,
// regulations, safety notices, estimated time + cost, difficulty.
//
// v0.5: context-only enrichment (title + description + trade context).
// Phase 2 full will add Whisper transcript + Vision frame analysis.
//
// Called:
//   • Manually from the trade video library UI ("Re-run AI" button)
//   • Automatically on video create (POST /api/videos/create) — future
//   • As a background cron for videos with empty enrichment fields
//
// Auth: merchant session required. Admin can also trigger for any
// video (Phase 2 admin queue).

import { NextResponse } from "next/server";
import { getMerchantSlug } from "@/lib/merchantSession";
import { processVideoAI } from "@/lib/videos/aiEnrich";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;  // AI calls can take 30-60s

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });

  const { id: videoId } = await params;

  // Owner check — only the merchant who owns the video (or admin) can trigger
  const { data: v } = await supabaseAdmin
    .from("hammerex_videos")
    .select("merchant_slug")
    .eq("id", videoId)
    .maybeSingle();
  if (!v) return NextResponse.json({ ok: false, error: "video-not-found" }, { status: 404 });
  if (v.merchant_slug !== merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });
  }

  const result = await processVideoAI(videoId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, populated: result.populated });
}

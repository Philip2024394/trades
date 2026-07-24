// GET  /api/studio/social/posts?status=awaiting_approval  — list merchant's posts
// POST /api/studio/social/posts                           — create a draft (via Nex generator)

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { generateAndDraft, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/nex/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status");
  let q = supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*")
    .eq("merchant_slug", session.merchant.slug);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ ok: true, posts: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    platform?:    string;
    brief?:       string;
    image_hint?:  string;
    campaign_id?: string;
  } | null;
  if (!body?.platform || !body.brief) return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(body.platform)) return NextResponse.json({ ok: false, error: "unknown_platform" }, { status: 400 });

  try {
    const post = await generateAndDraft({
      merchantSlug: session.merchant.slug,
      platform:     body.platform as SocialPlatform,
      brief:        body.brief,
      imageHint:    body.image_hint,
      campaignId:   body.campaign_id,
      createdBy:    "merchant"
    });
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "create_failed" }, { status: 500 });
  }
}

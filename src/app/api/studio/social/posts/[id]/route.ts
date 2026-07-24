// POST /api/studio/social/posts/[id]
// Body: { action: "approve" | "reject" | "publish_now" | "schedule" | "edit", ... }

import { NextResponse, type NextRequest } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { transitionPost, readPost, publishPost, localToUtc, isValidTimezone } from "@/lib/nex/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    action:       "approve" | "reject" | "publish_now" | "schedule" | "edit";
    reason?:      string;
    schedule?:    { year: number; month: number; day: number; hour: number; minute: number; timezone: string };
    edits?:       { caption?: string; hashtags?: string[]; call_to_action?: string; headline?: string };
  } | null;
  if (!body?.action) return NextResponse.json({ ok: false, error: "missing_action" }, { status: 400 });

  const current = await readPost(id);
  if (!current) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (current.merchant_slug !== session.merchant.slug) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const actor = `merchant:${session.merchant.slug}`;

  try {
    switch (body.action) {
      case "approve": {
        const post = await transitionPost({
          postId: id, from: current.status, to: "approved", actor,
          patch: { approved_by: actor, approved_at: new Date().toISOString() }
        });
        return NextResponse.json({ ok: true, post });
      }
      case "reject": {
        const post = await transitionPost({
          postId: id, from: current.status, to: "rejected", actor, reason: body.reason
        });
        return NextResponse.json({ ok: true, post });
      }
      case "edit": {
        if (!body.edits) return NextResponse.json({ ok: false, error: "missing_edits" }, { status: 400 });
        const { data } = await supabaseAdmin
          .from("hammerex_nex_social_posts")
          .update({
            caption:        body.edits.caption        ?? current.caption,
            hashtags:       body.edits.hashtags       ?? current.hashtags,
            call_to_action: body.edits.call_to_action ?? current.call_to_action,
            headline:       body.edits.headline       ?? current.headline
          })
          .eq("id", id)
          .select("*")
          .single();
        return NextResponse.json({ ok: true, post: data });
      }
      case "schedule": {
        if (!body.schedule) return NextResponse.json({ ok: false, error: "missing_schedule" }, { status: 400 });
        if (!isValidTimezone(body.schedule.timezone)) return NextResponse.json({ ok: false, error: "invalid_timezone" }, { status: 400 });
        const utc = localToUtc(body.schedule);
        // Force through approved → scheduled.
        if (current.status !== "approved" && current.status !== "scheduled") {
          return NextResponse.json({ ok: false, error: "must_be_approved_first" }, { status: 409 });
        }
        const post = await transitionPost({
          postId: id, from: current.status, to: "scheduled", actor,
          patch:  { scheduled_for: utc.toISOString(), scheduled_tz: body.schedule.timezone }
        });
        return NextResponse.json({ ok: true, post });
      }
      case "publish_now": {
        if (current.status !== "approved") {
          return NextResponse.json({ ok: false, error: "must_be_approved_first" }, { status: 409 });
        }
        const res = await publishPost({ postId: id, actor });
        if (res.ok) return NextResponse.json({ ok: true, post: res.post });
        return NextResponse.json({ ok: false, error: res.reason, message: res.message, post: res.post }, { status: 409 });
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "action_failed" }, { status: 500 });
  }
}

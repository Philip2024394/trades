// POST /api/sitebook-invite/[token]/reply
//
// Public — trade posts an inline reply straight from the invite
// landing page. Authenticated by the invitation token itself, no
// cookie / signup required.
//
// Body: { postId: string, body: string }
//
// Server checks:
//   1. Invitation exists + status != revoked
//   2. Post exists AND belongs to a project in invitation.project_ids
//   3. Post visibility is 'all-trades' OR the trade's listing_id is in
//      hammerex_sitebook_post_members
//
// Insert into hammerex_sitebook_post_replies with author_type='trade'
// and author_listing_id from the invitation. Homeowner sees it next
// refresh of /sitebook.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadInvitationByToken } from "@/lib/homeowners/invitations";
import { trackLiquidity } from "@/lib/analytics/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => null) as { postId?: string; body?: string } | null;
  const replyBody = (body?.body ?? "").trim();
  const postId    = body?.postId ?? "";
  if (!postId || !replyBody) {
    return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });
  }

  const invitation = await loadInvitationByToken(token);
  if (!invitation)                    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  if (invitation.status === "revoked")return NextResponse.json({ ok: false, error: "invitation-revoked" }, { status: 403 });

  // Verify the post belongs to a project this invitation covers
  const postRes = await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .select("id, project_id, visibility")
    .eq("id", postId)
    .maybeSingle();
  const post = postRes.data as { id: string; project_id: string; visibility: string } | null;
  if (!post)                                          return NextResponse.json({ ok: false, error: "post-not-found" }, { status: 404 });
  if (!invitation.project_ids.includes(post.project_id))
    return NextResponse.json({ ok: false, error: "not-invited" }, { status: 403 });

  // If visibility=selected, the trade must be an explicit member
  if (post.visibility === "selected") {
    const memberRes = await supabaseAdmin
      .from("hammerex_sitebook_post_members")
      .select("post_id")
      .eq("post_id", post.id)
      .eq("listing_id", invitation.trade_listing_id)
      .maybeSingle();
    if (!memberRes.data) return NextResponse.json({ ok: false, error: "not-a-member" }, { status: 403 });
  }

  const ins = await supabaseAdmin
    .from("hammerex_sitebook_post_replies")
    .insert({
      post_id:              postId,
      author_type:          "trade",
      author_listing_id:    invitation.trade_listing_id,
      author_name:          invitation.trade_merchant_name || invitation.trade_merchant_slug || "Trade",
      body:                 replyBody.slice(0, 4000)
    })
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json({ ok: false, error: "insert-failed" }, { status: 500 });
  }

  const isFirstReply = invitation.status === "pending" || invitation.status === "unavailable";
  // Flip invitation to 'responded' if this is the first reply
  if (isFirstReply) {
    await supabaseAdmin
      .from("hammerex_sitebook_invitations")
      .update({ status: "responded", responded_at: new Date().toISOString() })
      .eq("id", invitation.id);
  }

  // Liquidity Engine · supply_responded — the core loop metric.
  // First-reply-latency (48h target) is measured from post-created
  // occurred_at to this event's occurred_at.
  void trackLiquidity({
    slug:           "sitebook.trade_replied",
    product:        "sitebook",
    lifecycleStage: "supply_responded",
    actorKind:      "trade",
    actorId:        invitation.trade_listing_id,
    actorDisplay:   invitation.trade_merchant_name || invitation.trade_merchant_slug || "Trade",
    targetKind:     "sitebook_post",
    targetId:       postId,
    metadata:       { is_first_reply: isFirstReply, invitation_id: invitation.id }
  });

  return NextResponse.json({ ok: true, replyId: ins.data.id });
}

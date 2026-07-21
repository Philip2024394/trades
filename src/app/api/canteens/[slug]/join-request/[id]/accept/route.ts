// POST /api/canteens/[slug]/join-request/[id]/accept
//
// Host-only. Accepts a pending join request → creates a member row →
// marks the request accepted → notifies the requester. Fires the
// `match_completed` liquidity event so the acceptance shows up in
// War Room + Network Health.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { trackLiquidity } from "@/lib/analytics/track";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug: canteenSlug, id: requestId } = await params;
  const viewer = await getMerchantSlug();
  if (!viewer) return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug, name")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (!canteen.data) return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  const devForceHost = process.env.NETWORK_SESSION_STUB === "1";
  const isHost = devForceHost || canteen.data.host_slug === viewer;
  if (!isHost) return NextResponse.json({ ok: false, error: "not-host" }, { status: 403 });

  const request = await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .select("id, canteen_id, requester_slug, requester_display_name, requester_trade_label, requester_avatar_url, requester_city, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request.data)                                return NextResponse.json({ ok: false, error: "request-not-found" }, { status: 404 });
  if (request.data.canteen_id !== canteen.data.id)  return NextResponse.json({ ok: false, error: "canteen-mismatch" }, { status: 400 });
  if (request.data.status !== "pending")            return NextResponse.json({ ok: false, error: "not-pending" }, { status: 400 });

  // Create member row + mark request accepted in sequence so a failure
  // to insert the member row doesn't consume the request.
  const insertMember = await supabaseAdmin
    .from("hammerex_canteen_members")
    .insert({
      canteen_id:   canteen.data.id,
      member_slug:  request.data.requester_slug,
      display_name: request.data.requester_display_name,
      trade_label:  request.data.requester_trade_label ?? "trade",
      city:         request.data.requester_city ?? null,
      avatar_url:   request.data.requester_avatar_url ?? null,
      role:         "member"
    })
    .select("id")
    .maybeSingle();
  if (insertMember.error && insertMember.error.code !== "23505") {
    return NextResponse.json({ ok: false, error: insertMember.error.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .update({ status: "accepted", resolved_at: new Date().toISOString(), resolved_by_slug: viewer })
    .eq("id", requestId);

  // Notify requester — welcome to the canteen. Fire-and-forget.
  void notify({
    to: {
      kind:    "trade",
      id:      request.data.requester_slug,
      display: request.data.requester_display_name
    },
    template: "canteen.join_accepted" as never,   // registered fallback if missing
    data:     { canteenName: canteen.data.name, canteenSlug },
    channels: ["in_app"],
    product:  "canteen",
    relatedTargetKind: "canteen",
    relatedTargetId:   canteen.data.id
  });

  void trackLiquidity({
    slug:           "canteen.join_accepted",
    product:        "canteen",
    actorKind:      "merchant",
    actorId:        viewer,
    lifecycleStage: "match_completed",
    targetKind:     "canteen",
    targetId:       canteen.data.id,
    metadata: {
      canteen_slug:   canteenSlug,
      requester_slug: request.data.requester_slug
    }
  });

  return NextResponse.json({ ok: true });
}

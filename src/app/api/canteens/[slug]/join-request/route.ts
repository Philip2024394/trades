// POST   /api/canteens/[slug]/join-request  — signed-in trade requests to join
// DELETE /api/canteens/[slug]/join-request  — requester withdraws their pending request
// GET    /api/canteens/[slug]/join-request  — host-only, returns pending queue for review
//
// Rate limit: max 5 outbound requests per requester per 24h (enforced
// on POST). Auto-decline for suspended requesters. Silent decline on
// duplicate — no error surfaced to the client, request just returns ok.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { trackLiquidity } from "@/lib/analytics/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_24H = 5;

// ─── POST — create join request ────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: canteenSlug } = await params;
  const requesterSlug = await getMerchantSlug();
  if (!requesterSlug) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { message?: string };
  const message = (body.message ?? "").trim().slice(0, 500) || null;

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (!canteen.data) return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  if (canteen.data.host_slug === requesterSlug) {
    return NextResponse.json({ ok: false, error: "cant-join-own-canteen" }, { status: 400 });
  }

  // Already a member? Silent ok (idempotent, no error surfaced).
  const existingMember = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("id")
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", requesterSlug)
    .maybeSingle();
  if (existingMember.data) return NextResponse.json({ ok: true, alreadyMember: true });

  // Rate limit — enforce max 5 outbound requests per requester per 24h.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recentCount = await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_slug", requesterSlug)
    .gte("requested_at", since);
  if ((recentCount.count ?? 0) >= MAX_REQUESTS_PER_24H) {
    return NextResponse.json({ ok: false, error: "rate-limited" }, { status: 429 });
  }

  // Resolve requester display fields from their trade listing (denormalised so
  // the review panel doesn't need a join later).
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, primary_trade, city, avatar_url, suspended_at")
    .eq("slug", requesterSlug)
    .maybeSingle();
  if (listing.data?.suspended_at) {
    // Silent auto-decline — return ok so the requester never learns they're
    // suspended via this endpoint (see admin dashboard instead).
    return NextResponse.json({ ok: true, silentDecline: true });
  }

  const insert = await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .insert({
      canteen_id:             canteen.data.id,
      canteen_slug:           canteenSlug,
      requester_slug:         requesterSlug,
      requester_display_name: listing.data?.display_name ?? requesterSlug,
      requester_trade_label:  listing.data?.primary_trade ?? null,
      requester_avatar_url:   listing.data?.avatar_url ?? null,
      requester_city:         listing.data?.city ?? null,
      message
    })
    .select("id")
    .maybeSingle();

  if (insert.error) {
    // Unique violation on (canteen, requester, pending) = already requested.
    // Silent ok — don't leak that they've already asked.
    if (insert.error.code === "23505") {
      return NextResponse.json({ ok: true, alreadyPending: true });
    }
    return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
  }

  void trackLiquidity({
    slug:           "canteen.join_requested",
    product:        "canteen",
    actorKind:      "merchant",
    actorId:        requesterSlug,
    lifecycleStage: "demand_created",
    targetKind:     "canteen",
    targetId:       canteen.data.id,
    metadata:       { canteen_slug: canteenSlug }
  });

  return NextResponse.json({ ok: true, id: insert.data?.id });
}

// ─── DELETE — withdraw own pending request ──────────────────────────

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: canteenSlug } = await params;
  const requesterSlug = await getMerchantSlug();
  if (!requesterSlug) return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (!canteen.data) return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });

  const upd = await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .update({ status: "withdrawn", resolved_at: new Date().toISOString(), resolved_by_slug: requesterSlug })
    .eq("canteen_id", canteen.data.id)
    .eq("requester_slug", requesterSlug)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  return NextResponse.json({ ok: true, withdrew: Boolean(upd.data) });
}

// ─── GET — host-only pending queue ──────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: canteenSlug } = await params;
  const viewer = await getMerchantSlug();
  if (!viewer) return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });

  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (!canteen.data) return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  const devForceHost = process.env.NETWORK_SESSION_STUB === "1";
  const isHost = devForceHost || canteen.data.host_slug === viewer;
  if (!isHost) return NextResponse.json({ ok: false, error: "not-host" }, { status: 403 });

  const rows = await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .select("id, requester_slug, requester_display_name, requester_trade_label, requester_avatar_url, requester_city, message, requested_at")
    .eq("canteen_id", canteen.data.id)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  return NextResponse.json({
    ok: true,
    requests: (rows.data ?? []).map((r) => ({
      id:                r.id,
      requesterSlug:     r.requester_slug,
      requesterName:     r.requester_display_name,
      requesterTrade:    r.requester_trade_label,
      requesterAvatarUrl: r.requester_avatar_url,
      requesterCity:     r.requester_city,
      message:           r.message,
      requestedAt:       r.requested_at
    }))
  });
}

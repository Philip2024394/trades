// POST /api/canteens/[slug]/join-request/[id]/decline
//
// Host-only. Silent decline — no notification is sent to the requester.
// Request row is preserved for audit but flagged status='declined' so
// the requester's next attempt (after 30-day expiry) starts fresh.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug: canteenSlug, id: requestId } = await params;
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

  const upd = await supabaseAdmin
    .from("hammerex_canteen_join_requests")
    .update({ status: "declined", resolved_at: new Date().toISOString(), resolved_by_slug: viewer })
    .eq("id", requestId)
    .eq("canteen_id", canteen.data.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  return NextResponse.json({ ok: true, declined: Boolean(upd.data) });
}

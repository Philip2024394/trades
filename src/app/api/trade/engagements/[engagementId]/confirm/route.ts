// POST /api/trade/engagements/[engagementId]/confirm  (body: { action: 'accept' | 'dispute' })
//
// Trade-side confirmation of an engagement. Accepting moves status to
// 'accepted' and stamps merchant_confirmed_at. Disputing flips to
// 'disputed' and audits the reason.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireTradeSession } from "@/lib/os/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { engagementId: string };

export async function POST(request: Request, ctx: { params: Promise<Params> }) {
  let trade;
  try {
    trade = await requireTradeSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const { engagementId } = await ctx.params;

  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select("id, business_id, status, hired_display_name, owner_entity_id")
    .eq("id", engagementId)
    .maybeSingle();

  if (!engagement || engagement.business_id !== trade.primaryListingId) {
    return NextResponse.json(
      { ok: false, error: "engagement_not_found" },
      { status: 404 }
    );
  }

  let body: { action?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const action = (body.action ?? "accept").trim();

  if (action === "accept") {
    if (!["pending", "accepted"].includes(engagement.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_state",
          detail: `Cannot accept from ${engagement.status}`
        },
        { status: 400 }
      );
    }
    await supabaseAdmin
      .from("os_site_engagements")
      .update({ status: "accepted" })
      .eq("id", engagementId);

    await supabaseAdmin.from("os_entity_audit_events").insert({
      entity_id: engagement.owner_entity_id,
      actor_party_id: trade.party.id,
      verb: "engagement.trade_accepted",
      after_state: {
        engagement_id: engagementId,
        by_business_id: trade.primaryListingId
      }
    });

    return NextResponse.json({ ok: true, status: "accepted" });
  }

  if (action === "dispute") {
    if (["signed_off", "cancelled"].includes(engagement.status)) {
      return NextResponse.json(
        { ok: false, error: "invalid_state" },
        { status: 400 }
      );
    }
    await supabaseAdmin
      .from("os_site_engagements")
      .update({ status: "disputed" })
      .eq("id", engagementId);

    await supabaseAdmin.from("os_entity_audit_events").insert({
      entity_id: engagement.owner_entity_id,
      actor_party_id: trade.party.id,
      verb: "engagement.trade_disputed",
      after_state: {
        engagement_id: engagementId,
        by_business_id: trade.primaryListingId,
        reason: body.reason ?? null
      }
    });

    return NextResponse.json({ ok: true, status: "disputed" });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}

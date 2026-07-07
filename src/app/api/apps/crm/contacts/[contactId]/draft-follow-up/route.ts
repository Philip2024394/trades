// GET /api/apps/crm/contacts/[contactId]/draft-follow-up
// Returns { message } — server-drafted follow-up based on last activity.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import {
  draftFollowUpMessage,
  loadContactSummary
} from "@/lib/crm/loadContactTimeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const summary = await loadContactSummary(contactId, merchantId);
  if (!summary) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const { data: merchant } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, trading_name")
    .eq("id", merchantId)
    .maybeSingle();
  const last = summary.timeline[0];
  const daysSince = last
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(last.occurredAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : 30;
  const message = draftFollowUpMessage({
    contactName: summary.contact.displayName,
    lastActivityKind: last?.kind || "manual",
    daysSince,
    merchantDisplayName:
      merchant?.trading_name || merchant?.display_name || "we",
    projectHint:
      typeof last?.headline === "string"
        ? last.headline.replace(/ render:.*/, "").toLowerCase()
        : null
  });
  return NextResponse.json({
    ok: true,
    message,
    lastActivity: last
      ? { kind: last.kind, occurredAt: last.occurredAt, daysSince }
      : null
  });
}

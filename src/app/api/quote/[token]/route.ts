// GET /api/quote/[token]  — public quote view (share link).
//
// Anyone with the token can read the quote. On first read, we record a
// 'viewed' event + notify the merchant on their dashboard. No login
// required — the token IS the credential.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (!token || token.length < 12) {
    return NextResponse.json({ ok: false, error: "Invalid link." }, { status: 400 });
  }
  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select(
      "id, title, status, currency, materials_pence, labour_pence, vat_pence, discount_pence, total_pence, deposit_pence, timeline_estimate, notes, expires_at, sent_at, first_viewed_at, accepted_at, rejected_at, merchant_id, project_id, property_id, specification_id"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Quote not found." }, { status: 404 });
  }

  const [items, merchant, project, render] = await Promise.all([
    supabaseAdmin
      .from("app_quote_workspace_quote_items")
      .select("position, kind, label, description, qty, unit, unit_price_pence, total_pence")
      .eq("quote_id", quote.id)
      .order("position"),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, display_name, trading_name, avatar_url, whatsapp, email, city, postcode_prefix")
      .eq("id", quote.merchant_id)
      .maybeSingle(),
    supabaseAdmin
      .from("os_projects")
      .select("title, leaf_slug")
      .eq("id", quote.project_id)
      .maybeSingle(),
    supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select("render_url, source_photo_url")
      .eq("specification_id", quote.specification_id || "")
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  // Record first view + fire quote.viewed event
  if (!quote.first_viewed_at) {
    await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .update({
        first_viewed_at: new Date().toISOString(),
        status: quote.status === "sent" ? "viewed" : quote.status
      })
      .eq("id", quote.id);
    await supabaseAdmin.from("app_quote_workspace_quote_events").insert({
      quote_id: quote.id,
      verb: "viewed" as const,
      actor_kind: "homeowner" as const
    });
    await recordTimelineEvent({
      propertyId: quote.property_id,
      projectId: quote.project_id,
      verb: "quote.viewed",
      subjectType: "quote",
      subjectId: quote.id,
      headline: `Quote viewed`,
      payload: { first_view: true }
    });
  }

  return NextResponse.json({
    ok: true,
    quote: {
      id: quote.id,
      title: quote.title,
      status: quote.status,
      currency: quote.currency,
      materialsPence: quote.materials_pence,
      labourPence: quote.labour_pence,
      vatPence: quote.vat_pence,
      discountPence: quote.discount_pence,
      totalPence: quote.total_pence,
      depositPence: quote.deposit_pence,
      timelineEstimate: quote.timeline_estimate,
      notes: quote.notes,
      expiresAt: quote.expires_at,
      sentAt: quote.sent_at,
      acceptedAt: quote.accepted_at,
      rejectedAt: quote.rejected_at
    },
    items: items.data || [],
    merchant: merchant.data,
    project: project.data,
    render: render.data
  });
}

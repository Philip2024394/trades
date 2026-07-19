// POST /api/merchant/sitebook/[projectId]/quote — merchant submits or
// updates their quote on a SiteBook project.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getListing() {
  const c    = await cookies();
  const slug = c.get("tn_merchant_slug")?.value;
  if (!slug) return null;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, business_name, slug, trade_type")
    .eq("slug", slug)
    .maybeSingle();
  return res.data as { id: string; business_name: string; slug: string; trade_type: string | null } | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const listing = await getListing();
  if (!listing) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const body = await req.json().catch(() => null) as { amount_gbp?: number; notes?: string | null } | null;
  if (!body || typeof body.amount_gbp !== "number" || body.amount_gbp <= 0) {
    return NextResponse.json({ ok: false, error: "invalid-amount" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const existing = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("listing_id", listing.id)
    .maybeSingle();

  // Quotes are only meaningful after accepting the invite
  if (!existing.data || (existing.data as { status: string }).status === "declined") {
    return NextResponse.json({ ok: false, error: "must-accept-first" }, { status: 400 });
  }

  await supabaseAdmin
    .from("hammerex_sitebook_members")
    .update({
      quote_amount_gbp: body.amount_gbp,
      quote_notes:      body.notes || null,
      quote_at:         now,
      status:           "quoting"
    })
    .eq("id", (existing.data as { id: string }).id);

  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id: projectId,
    event_type: "trade_quoted",
    actor_type: "trade",
    actor_id:   listing.id,
    actor_name: listing.business_name,
    metadata:   { amount_gbp: body.amount_gbp }
  });

  // Also post a system message to the SiteBook thread
  await supabaseAdmin.from("hammerex_sitebook_messages").insert({
    project_id:      projectId,
    author_type:     "system",
    author_name:     "SiteBook",
    body:            `${listing.business_name} submitted a quote: £${body.amount_gbp.toLocaleString()}${body.notes ? "\n\nNotes: " + body.notes : ""}`,
    attachment_kind: "quote"
  });

  return NextResponse.json({ ok: true });
}

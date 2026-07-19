// POST /api/merchant/sitebook/[projectId]/decline — merchant declines.

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
    .select("id, business_name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return res.data as { id: string; business_name: string; slug: string } | null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const listing = await getListing();
  if (!listing) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const now = new Date().toISOString();

  const existing = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("listing_id", listing.id)
    .maybeSingle();

  if (existing.data) {
    await supabaseAdmin
      .from("hammerex_sitebook_members")
      .update({ status: "declined", declined_at: now })
      .eq("id", (existing.data as { id: string }).id);
  } else {
    await supabaseAdmin.from("hammerex_sitebook_members").insert({
      project_id:    projectId,
      listing_id:    listing.id,
      merchant_slug: listing.slug,
      merchant_name: listing.business_name,
      member_role:   "sub",
      status:        "declined",
      declined_at:   now
    });
  }

  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id: projectId,
    event_type: "trade_declined",
    actor_type: "trade",
    actor_id:   listing.id,
    actor_name: listing.business_name
  });

  return NextResponse.json({ ok: true });
}

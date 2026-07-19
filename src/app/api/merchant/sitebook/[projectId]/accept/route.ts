// POST /api/merchant/sitebook/[projectId]/accept — merchant accepts a
// SiteBook invite. Creates a member row (or updates existing).

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

export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const listing = await getListing();
  if (!listing) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  const now = new Date().toISOString();

  // Check for existing member row (invited via beacon response OR admin)
  const existing = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("*")
    .eq("project_id", projectId)
    .eq("listing_id", listing.id)
    .maybeSingle();

  if (existing.data) {
    // Update status
    await supabaseAdmin
      .from("hammerex_sitebook_members")
      .update({ status: "accepted", accepted_at: now })
      .eq("id", (existing.data as { id: string }).id);
  } else {
    await supabaseAdmin.from("hammerex_sitebook_members").insert({
      project_id:     projectId,
      listing_id:     listing.id,
      merchant_slug:  listing.slug,
      merchant_name:  listing.business_name,
      trade_type:     listing.trade_type,
      member_role:    "sub",
      status:         "accepted",
      invited_at:     now,
      accepted_at:    now
    });
  }

  // Log
  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id:  projectId,
    event_type:  "trade_accepted",
    actor_type:  "trade",
    actor_id:    listing.id,
    actor_name:  listing.business_name
  });

  return NextResponse.json({ ok: true });
}

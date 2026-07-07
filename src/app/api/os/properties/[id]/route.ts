// GET /api/os/properties/[id]
//
// Returns full property with projects + timeline + documents. Access
// gated by an active claim from the calling homeowner session.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadTimeline } from "@/lib/os/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { id: propertyId } = await ctx.params;

  // Verify the caller has a live claim
  const { data: claim } = await supabaseAdmin
    .from("os_property_claims")
    .select("id, role, status")
    .eq("property_id", propertyId)
    .eq("party_id", party.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "Property not found." },
      { status: 404 }
    );
  }

  const [propertyRes, projectsRes, docsRes, timeline] = await Promise.all([
    supabaseAdmin
      .from("os_properties")
      .select("*")
      .eq("id", propertyId)
      .single(),
    supabaseAdmin
      .from("os_projects")
      .select(
        "id, title, leaf_slug, status, budget_pence_low, budget_pence_high, target_start_date, target_end_date, updated_at, primary_business_listing_id"
      )
      .eq("property_id", propertyId)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("os_documents")
      .select("id, kind, title, expires_at, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    loadTimeline(propertyId, { limit: 100 })
  ]);

  if (propertyRes.error || !propertyRes.data) {
    return NextResponse.json(
      { ok: false, error: "Property not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    property: propertyRes.data,
    claim,
    projects: projectsRes.data || [],
    documents: docsRes.data || [],
    timeline
  });
}

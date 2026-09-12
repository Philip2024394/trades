// src/app/api/nex/directory/[ref_id]/honesty/route.ts
//
// Founder Phase 28 · P28-1 · Truth-in-advertising audit endpoint.
//
// GET /api/nex/directory/[ref_id]/honesty
// Returns the honesty verdict for a listing's website.

import { NextResponse } from "next/server";
import { getListingDetail } from "@/lib/nex/directory";
import { auditWebsiteHonesty } from "@/lib/nex/directory/honesty-audit";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const { ref_id } = await ctx.params;
  const detail = await getListingDetail(decodeURIComponent(ref_id));
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!detail.website) return NextResponse.json({
    listing_ref: detail.ref_id,
    url: null,
    verdict: null,
    reason: "listing_has_no_website",
    doctrine_note: "Doctrine #6 · Truth or Unconfirmed · cannot audit a site that isn't listed. Honest UNKNOWN.",
  });
  const verdict = await auditWebsiteHonesty(detail.ref_id, detail.website);
  return NextResponse.json({
    listing_ref: detail.ref_id,
    verdict,
    doctrine_note: "Doctrine #6 · Truth or Unconfirmed · verdict traces to matched substrings on the live landing page. NEX never fabricates pricing claims.",
  });
}

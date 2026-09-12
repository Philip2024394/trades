// src/app/api/nex/directory/[ref_id]/route.ts
//
// Founder Phase 27 · P27-2 · Full listing detail with products.

import { NextResponse } from "next/server";
import { getListingDetail } from "@/lib/nex/directory";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const { ref_id } = await ctx.params;
  const detail = await getListingDetail(decodeURIComponent(ref_id));
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    detail,
    doctrine_note: "Doctrine #6 · Truth or Unconfirmed · products list reflects owner-declared and/or source-verified amenities. Website view opens the external site inside NEX with a persistent back button. External content is never treated as NEX evidence.",
  });
}

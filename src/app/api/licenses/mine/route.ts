// GET /api/licenses/mine
//
// List active licences for the calling merchant. Identity from
// x-merchant-id header (production would use Supabase auth).

import { NextResponse } from "next/server";
import { loadActiveLicensesForMerchant } from "@/lib/licenses/loader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const merchantId = request.headers.get("x-merchant-id");
  if (!merchantId) {
    return NextResponse.json(
      { licenses: [], detail: "no merchant session" },
      { status: 200 }
    );
  }
  const licenses = await loadActiveLicensesForMerchant(merchantId);
  return NextResponse.json({ licenses });
}

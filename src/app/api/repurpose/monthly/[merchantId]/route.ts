// POST /api/repurpose/monthly/[merchantId]
//
// Composes a monthly digest from recent feed posts. Returns the draft
// as JSON so a caller (cron, or the merchant clicking "Draft this
// month's newsletter") can review and send.

import { NextResponse } from "next/server";
import { composeMonthlyDigest } from "@/lib/repurpose/monthlyDigest";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const draft = await composeMonthlyDigest(merchantId);
  if (!draft) {
    return NextResponse.json(
      { error: "no eligible posts in the last 30 days" },
      { status: 404 }
    );
  }
  return NextResponse.json({ draft });
}

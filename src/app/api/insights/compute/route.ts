// POST /api/insights/compute
//
// Kicks off the trade-wide pattern computation. Intended for a weekly
// cron. Body optional (no merchant scoping — this is global).

import { NextResponse } from "next/server";
import { computeTradePatterns } from "@/lib/insights/tradePatterns";

export const runtime = "nodejs";

export async function POST() {
  const result = await computeTradePatterns();
  return NextResponse.json(result);
}

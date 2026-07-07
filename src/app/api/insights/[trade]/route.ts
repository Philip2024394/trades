// GET /api/insights/[trade]?channel=instagram
//
// Public read — merchant dashboards + the composer both consume it.
// No PII exposure: insights are anonymised aggregates.

import { NextResponse } from "next/server";
import { loadInsightsFor } from "@/lib/insights/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ trade: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { trade } = await context.params;
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel");
  const insights = await loadInsightsFor(trade, channel);
  return NextResponse.json({ trade, channel, insights });
}

// GET /api/activity/[merchantId] — merchant activity timeline with per-event projection outcomes.

import { NextResponse } from "next/server";
import { loadActivity } from "@/lib/activity/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const activity = await loadActivity(merchantId, limit);
  return NextResponse.json({ activity });
}

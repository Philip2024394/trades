// GET /api/story-arcs/[merchantId]?status=open|closed
//
// Lists story arcs for the merchant dashboard.

import { NextResponse } from "next/server";
import { loadRecentArcs } from "@/lib/story-arcs/loader";
import type { StoryArcStatus } from "@/lib/story-arcs/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "") as StoryArcStatus | "";
  const arcs = await loadRecentArcs(
    merchantId,
    status ? (status as StoryArcStatus) : undefined,
    Number(url.searchParams.get("limit") ?? "20")
  );
  return NextResponse.json({ arcs });
}

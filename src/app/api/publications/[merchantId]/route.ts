// GET /api/publications/[merchantId] — list recent publications.

import { NextResponse } from "next/server";
import { loadRecentPublications } from "@/lib/publications/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const publications = await loadRecentPublications(merchantId, limit);
  return NextResponse.json({ publications });
}

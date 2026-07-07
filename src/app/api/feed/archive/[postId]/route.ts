// POST /api/feed/archive/[postId] — merchant archives a post → hidden from public.

import { NextResponse } from "next/server";
import { archiveFeedPost } from "@/lib/feed/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ postId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { postId } = await context.params;
  const merchantId = request.headers.get("x-merchant-id");
  if (!merchantId) {
    return NextResponse.json(
      { error: "no merchant session" },
      { status: 401 }
    );
  }
  const ok = await archiveFeedPost(merchantId, postId);
  if (!ok) return NextResponse.json({ error: "archive failed" }, { status: 500 });
  return NextResponse.json({ ok });
}

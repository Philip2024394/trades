// POST /api/feed/hold/[postId]
//
// Merchant hits Hold on a scheduled post. Requires x-merchant-id
// header so we don't let one merchant hold another's post.

import { NextResponse } from "next/server";
import { holdFeedPost } from "@/lib/feed/loader";

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
  const ok = await holdFeedPost(merchantId, postId);
  if (!ok) return NextResponse.json({ error: "hold failed" }, { status: 500 });
  return NextResponse.json({ ok });
}

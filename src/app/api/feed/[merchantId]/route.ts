// GET /api/feed/[merchantId]?scope=public|merchant
//
// scope=public  → published posts only. This is what visitors + the
//                 <LiveFeedBlock> component consume.
// scope=merchant → published + scheduled + held. For the merchant's
//                  own dashboard / capture receipt.

import { NextResponse } from "next/server";
import {
  loadMerchantFeed,
  loadPublishedFeed
} from "@/lib/feed/loader";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "public";
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const posts =
    scope === "merchant"
      ? await loadMerchantFeed(merchantId, limit)
      : await loadPublishedFeed(merchantId, limit);
  return NextResponse.json({ posts });
}

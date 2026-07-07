import { NextResponse } from "next/server";
import { pinterestAuthStartUrl } from "@/lib/oauth/pinterest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const merchantId = new URL(request.url).searchParams.get("merchantId");
  if (!merchantId) {
    return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  }
  const url = pinterestAuthStartUrl(merchantId);
  if (!url) return NextResponse.json({ error: "pinterest_not_configured" }, { status: 503 });
  return NextResponse.redirect(url);
}

import { NextResponse } from "next/server";
import { tiktokAuthStartUrl } from "@/lib/oauth/tiktok";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const merchantId = new URL(request.url).searchParams.get("merchantId");
  if (!merchantId) return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  const url = tiktokAuthStartUrl(merchantId);
  if (!url) return NextResponse.json({ error: "tiktok_not_configured" }, { status: 503 });
  return NextResponse.redirect(url);
}

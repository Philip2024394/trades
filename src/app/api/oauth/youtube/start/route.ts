import { NextResponse } from "next/server";
import { youtubeAuthStartUrl } from "@/lib/oauth/youtube";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const merchantId = new URL(request.url).searchParams.get("merchantId");
  if (!merchantId) return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  const url = youtubeAuthStartUrl(merchantId);
  if (!url) return NextResponse.json({ error: "youtube_not_configured" }, { status: 503 });
  return NextResponse.redirect(url);
}

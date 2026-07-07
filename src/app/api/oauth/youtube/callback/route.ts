import { NextResponse } from "next/server";
import { youtubeExchangeCode } from "@/lib/oauth/youtube";
import { persistConnections } from "@/lib/oauth/persist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "code + state required" }, { status: 400 });
  }
  const result = await youtubeExchangeCode(code, state);
  if (!result) return NextResponse.json({ error: "youtube_oauth_failed" }, { status: 400 });
  await persistConnections([
    {
      merchantId: result.merchantId,
      channel: "youtube_shorts",
      externalAccountId: result.channelId || `yt_${result.merchantId.slice(0, 8)}`,
      displayName: result.channelTitle || "YouTube channel",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scopes: ["youtube.upload"],
      metadata: { channel_id: result.channelId }
    }
  ]);
  return NextResponse.redirect(
    new URL("/settings/channels?connected=youtube&count=1", request.url)
  );
}

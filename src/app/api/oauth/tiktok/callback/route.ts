import { NextResponse } from "next/server";
import { tiktokExchangeCode } from "@/lib/oauth/tiktok";
import { persistConnections } from "@/lib/oauth/persist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "code + state required" }, { status: 400 });
  }
  const result = await tiktokExchangeCode(code, state);
  if (!result) return NextResponse.json({ error: "tiktok_oauth_failed" }, { status: 400 });
  await persistConnections([
    {
      merchantId: result.merchantId,
      channel: "tiktok",
      externalAccountId: result.openId,
      displayName: result.displayName || `TikTok ${result.openId.slice(0, 6)}`,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scopes: ["user.info.basic", "video.upload", "video.publish"]
    }
  ]);
  return NextResponse.redirect(
    new URL("/settings/channels?connected=tiktok&count=1", request.url)
  );
}

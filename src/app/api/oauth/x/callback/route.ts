import { NextResponse } from "next/server";
import { xExchangeCode } from "@/lib/oauth/x";
import { persistConnections } from "@/lib/oauth/persist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "code + state required" }, { status: 400 });
  }
  const result = await xExchangeCode(code, state);
  if (!result) return NextResponse.json({ error: "x_oauth_failed" }, { status: 400 });
  await persistConnections([
    {
      merchantId: result.merchantId,
      channel: "x",
      externalAccountId: result.userId,
      displayName: result.username ? `@${result.username}` : `X user`,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"]
    }
  ]);
  return NextResponse.redirect(
    new URL("/settings/channels?connected=x&count=1", request.url)
  );
}

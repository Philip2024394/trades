import { NextResponse } from "next/server";
import { pinterestExchangeCode } from "@/lib/oauth/pinterest";
import { persistConnections } from "@/lib/oauth/persist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "code + state required" }, { status: 400 });
  }
  const result = await pinterestExchangeCode(code, state);
  if (!result) {
    return NextResponse.json({ error: "pinterest_oauth_failed" }, { status: 400 });
  }
  await persistConnections([
    {
      merchantId: result.merchantId,
      channel: "pinterest",
      externalAccountId: result.username || `pinterest_${result.merchantId.slice(0, 8)}`,
      displayName: result.username || "Pinterest account",
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scopes: ["pins:write", "boards:read", "boards:write"]
    }
  ]);
  return NextResponse.redirect(
    new URL("/settings/channels?connected=pinterest&count=1", request.url)
  );
}

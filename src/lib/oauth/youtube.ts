// YouTube OAuth 2.0 (via Google OAuth).
//
// Scopes: https://www.googleapis.com/auth/youtube.upload
// Auth: https://accounts.google.com/o/oauth2/v2/auth
// Token: https://oauth2.googleapis.com/token
// Channel: https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNEL_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true";
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

export function youtubeAuthStartUrl(merchantId: string): string | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirect = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !redirect) return null;
  const state = encodeURIComponent(
    Buffer.from(JSON.stringify({ merchantId, ts: Date.now() })).toString("base64url")
  );
  return `${AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirect
  )}&scope=${encodeURIComponent(SCOPES.join(" "))}&access_type=offline&prompt=consent&state=${state}`;
}

export type YoutubeCallbackResult = {
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  channelId: string;
  channelTitle: string;
};

export async function youtubeExchangeCode(
  code: string,
  state: string
): Promise<YoutubeCallbackResult | null> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirect = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect) return null;
  let merchantId = "";
  try {
    merchantId = (
      JSON.parse(Buffer.from(state, "base64url").toString("utf-8")) as {
        merchantId: string;
      }
    ).merchantId;
  } catch {
    return null;
  }
  if (!merchantId) return null;
  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
    grant_type: "authorization_code"
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token) return null;
  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000
  ).toISOString();

  const chRes = await fetch(CHANNEL_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  let channelId = "";
  let channelTitle = "";
  if (chRes.ok) {
    const ch = (await chRes.json()) as {
      items?: Array<{ id: string; snippet?: { title?: string } }>;
    };
    channelId = ch.items?.[0]?.id ?? "";
    channelTitle = ch.items?.[0]?.snippet?.title ?? "";
  }
  return {
    merchantId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? "",
    expiresAt,
    channelId,
    channelTitle
  };
}

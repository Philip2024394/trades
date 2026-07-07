// TikTok OAuth (Login Kit + Content Posting API).
//
// Scopes: video.publish, video.upload, user.info.basic.
// Auth: https://www.tiktok.com/v2/auth/authorize/
// Token: https://open.tiktokapis.com/v2/oauth/token/
// User: https://open.tiktokapis.com/v2/user/info/

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name";
const SCOPES = ["user.info.basic", "video.upload", "video.publish"];

export function tiktokAuthStartUrl(merchantId: string): string | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirect = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !redirect) return null;
  const state = encodeURIComponent(
    Buffer.from(JSON.stringify({ merchantId, ts: Date.now() })).toString("base64url")
  );
  return `${AUTH_URL}?client_key=${clientKey}&response_type=code&scope=${encodeURIComponent(
    SCOPES.join(",")
  )}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;
}

export type TiktokCallbackResult = {
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  openId: string;
  displayName: string;
};

export async function tiktokExchangeCode(
  code: string,
  state: string
): Promise<TiktokCallbackResult | null> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirect = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirect) return null;
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
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirect
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
    open_id?: string;
  };
  if (!tokenData.access_token || !tokenData.open_id) return null;
  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 24 * 60 * 60) * 1000
  ).toISOString();

  let displayName = "";
  const userRes = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (userRes.ok) {
    const user = (await userRes.json()) as {
      data?: { user?: { display_name?: string } };
    };
    displayName = user.data?.user?.display_name ?? "";
  }
  return {
    merchantId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? "",
    expiresAt,
    openId: tokenData.open_id,
    displayName
  };
}

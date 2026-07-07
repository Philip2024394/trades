// Pinterest OAuth 2.0 (v5).
//
// Scopes: pins:write, boards:read.
// Auth: https://www.pinterest.com/oauth/
// Token: https://api.pinterest.com/v5/oauth/token

const AUTH_URL = "https://www.pinterest.com/oauth/";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const ACCOUNTS_URL = "https://api.pinterest.com/v5/user_account";
const SCOPES = ["pins:write", "boards:read", "boards:write"];

export function pinterestAuthStartUrl(merchantId: string): string | null {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const redirect = process.env.PINTEREST_REDIRECT_URI;
  if (!clientId || !redirect) return null;
  const state = encodeURIComponent(
    Buffer.from(JSON.stringify({ merchantId, ts: Date.now() })).toString("base64url")
  );
  return `${AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirect
  )}&response_type=code&scope=${encodeURIComponent(SCOPES.join(","))}&state=${state}`;
}

export type PinterestCallbackResult = {
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  username: string;
};

export async function pinterestExchangeCode(
  code: string,
  state: string
): Promise<PinterestCallbackResult | null> {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  const redirect = process.env.PINTEREST_REDIRECT_URI;
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

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token || !tokenData.refresh_token) return null;
  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 30 * 24 * 60 * 60) * 1000
  ).toISOString();

  // Fetch account username.
  const accRes = await fetch(ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  let username = "";
  if (accRes.ok) {
    const acc = (await accRes.json()) as { username?: string };
    username = acc.username ?? "";
  }
  return {
    merchantId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    username
  };
}

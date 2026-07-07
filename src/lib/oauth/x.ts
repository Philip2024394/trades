// X / Twitter OAuth 2.0 with PKCE (v2 API).
//
// Scopes: tweet.read, tweet.write, users.read, offline.access.
// Auth: https://twitter.com/i/oauth2/authorize
// Token: https://api.twitter.com/2/oauth2/token
// Me: https://api.twitter.com/2/users/me

import crypto from "node:crypto";

const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";
const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

// PKCE verifiers must persist between start + callback. For MVP we
// stash in an in-memory Map keyed by state — production wants a
// short-lived DB row or signed cookie.
const verifiers = new Map<string, string>();

export function xAuthStartUrl(merchantId: string): string | null {
  const clientId = process.env.X_CLIENT_ID;
  const redirect = process.env.X_REDIRECT_URI;
  if (!clientId || !redirect) return null;
  const codeVerifier = crypto
    .randomBytes(48)
    .toString("base64url")
    .slice(0, 96);
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  const stateBundle = Buffer.from(
    JSON.stringify({ merchantId, ts: Date.now(), state })
  ).toString("base64url");
  verifiers.set(stateBundle, codeVerifier);
  // Simple GC — cap at 1000 entries.
  if (verifiers.size > 1000) {
    const first = verifiers.keys().next().value;
    if (first) verifiers.delete(first);
  }
  return `${AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirect
  )}&scope=${encodeURIComponent(SCOPES.join(" "))}&state=${stateBundle}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
}

export type XCallbackResult = {
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
  username: string;
};

export async function xExchangeCode(
  code: string,
  state: string
): Promise<XCallbackResult | null> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const redirect = process.env.X_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect) return null;
  const verifier = verifiers.get(state);
  if (!verifier) return null;
  verifiers.delete(state);
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
    code,
    grant_type: "authorization_code",
    redirect_uri: redirect,
    code_verifier: verifier,
    client_id: clientId
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
  if (!tokenData.access_token) return null;
  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 7200) * 1000
  ).toISOString();

  const meRes = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  let userId = "";
  let username = "";
  if (meRes.ok) {
    const me = (await meRes.json()) as {
      data?: { id: string; username: string };
    };
    userId = me.data?.id ?? "";
    username = me.data?.username ?? "";
  }
  return {
    merchantId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? "",
    expiresAt,
    userId,
    username
  };
}

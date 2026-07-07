// Meta OAuth (Facebook + Instagram Business).
//
// Shared flow — one OAuth grant covers both Facebook Page management
// and Instagram Business publishing (Instagram Business accounts are
// linked to Facebook Pages).
//
// Requires env:
//   META_APP_ID
//   META_APP_SECRET
//   META_REDIRECT_URI  (must match the URI registered in Meta App dashboard)
//
// Scopes we request:
//   pages_show_list, pages_manage_posts, pages_manage_metadata,
//   pages_read_engagement, instagram_basic, instagram_content_publish,
//   business_management

const META_OAUTH_BASE = "https://www.facebook.com/v22.0/dialog/oauth";
const META_TOKEN_URL = "https://graph.facebook.com/v22.0/oauth/access_token";
const GRAPH_URL = "https://graph.facebook.com/v22.0";

const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_manage_metadata",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management"
];

export function metaAuthStartUrl(merchantId: string): string | null {
  const appId = process.env.META_APP_ID;
  const redirect = process.env.META_REDIRECT_URI;
  if (!appId || !redirect) return null;
  const state = encodeURIComponent(
    Buffer.from(JSON.stringify({ merchantId, ts: Date.now() })).toString("base64url")
  );
  const scope = SCOPES.join(",");
  return `${META_OAUTH_BASE}?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirect
  )}&scope=${encodeURIComponent(scope)}&state=${state}&response_type=code`;
}

export type MetaCallbackResult = {
  merchantId: string;
  userAccessToken: string;
  pages: Array<{
    id: string;
    name: string;
    accessToken: string;
    instagramBusinessAccountId: string | null;
  }>;
};

export async function exchangeCodeAndFetchPages(
  code: string,
  state: string
): Promise<MetaCallbackResult | null> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirect = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirect) return null;

  let merchantId = "";
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    ) as { merchantId: string };
    merchantId = decoded.merchantId;
  } catch {
    return null;
  }
  if (!merchantId) return null;

  // 1. Exchange the short-lived code for a user access token.
  const tokenRes = await fetch(
    `${META_TOKEN_URL}?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirect
    )}&client_secret=${appSecret}&code=${code}`
  );
  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const shortToken = tokenData.access_token;
  if (!shortToken) return null;

  // 2. Exchange for a long-lived token (60 days).
  const longRes = await fetch(
    `${META_TOKEN_URL}?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
  );
  const longData = (await longRes.json()) as { access_token?: string };
  const userToken = longData.access_token ?? shortToken;

  // 3. Fetch the user's pages + linked Instagram business accounts.
  const pagesRes = await fetch(
    `${GRAPH_URL}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`
  );
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  };
  const pages = (pagesData.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    instagramBusinessAccountId: p.instagram_business_account?.id ?? null
  }));

  return { merchantId, userAccessToken: userToken, pages };
}

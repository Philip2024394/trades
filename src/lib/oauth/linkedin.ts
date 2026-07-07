// LinkedIn OAuth 2.0 (Marketing Developer Platform).
//
// Scopes: r_liteprofile, r_organization_social, w_organization_social.
// Auth: https://www.linkedin.com/oauth/v2/authorization
// Token: https://www.linkedin.com/oauth/v2/accessToken
// Orgs: GET https://api.linkedin.com/v2/organizationAcls?q=roleAssignee

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const ORGS_URL =
  "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName)))";
const SCOPES = ["r_liteprofile", "r_organization_social", "w_organization_social"];

export function linkedinAuthStartUrl(merchantId: string): string | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirect = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !redirect) return null;
  const state = encodeURIComponent(
    Buffer.from(JSON.stringify({ merchantId, ts: Date.now() })).toString("base64url")
  );
  return `${AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirect
  )}&scope=${encodeURIComponent(SCOPES.join(" "))}&state=${state}`;
}

export type LinkedinCallbackResult = {
  merchantId: string;
  accessToken: string;
  expiresAt: string;
  organisations: Array<{ id: string; name: string }>;
};

export async function linkedinExchangeCode(
  code: string,
  state: string
): Promise<LinkedinCallbackResult | null> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirect = process.env.LINKEDIN_REDIRECT_URI;
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
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
    client_id: clientId,
    client_secret: clientSecret
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const accessToken = tokenData.access_token;
  if (!accessToken) return null;
  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600 * 24 * 60) * 1000
  ).toISOString();

  // Fetch admin'd organisations.
  const orgRes = await fetch(ORGS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const orgs: Array<{ id: string; name: string }> = [];
  if (orgRes.ok) {
    const orgData = (await orgRes.json()) as {
      elements?: Array<{
        "organization~"?: { id: string; localizedName: string };
      }>;
    };
    for (const el of orgData.elements ?? []) {
      const o = el["organization~"];
      if (o) orgs.push({ id: String(o.id), name: o.localizedName });
    }
  }
  return { merchantId, accessToken, expiresAt, organisations: orgs };
}

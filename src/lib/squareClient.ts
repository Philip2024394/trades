// Square REST client — thin fetch-based wrapper.
//
// Why direct REST: the `square` npm SDK ships with a large surface we
// don't need. Fetch matches how we talk to Stripe/PayPal. Per-merchant
// access tokens are stored in payment_provider_data.square_access_token
// (encrypted at rest via Supabase — see migration note in the /save
// endpoint) and refreshed via the /oauth2/token endpoint before their
// 30-day expiry.

export const SQUARE_SCOPES = [
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
  "MERCHANT_PROFILE_READ",
  "ORDERS_READ",
  "ORDERS_WRITE"
];

export function squareBase(): string {
  const env = (process.env.SQUARE_ENV ?? "sandbox").toLowerCase();
  return env === "production" || env === "live"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function squareConfigured(): boolean {
  return (
    typeof process.env.SQUARE_APPLICATION_ID === "string" &&
    process.env.SQUARE_APPLICATION_ID.length > 0 &&
    typeof process.env.SQUARE_APPLICATION_SECRET === "string" &&
    process.env.SQUARE_APPLICATION_SECRET.length > 0
  );
}

/** Build the OAuth authorize URL that a merchant clicks into. Square's
 *  own page handles login + permission consent + redirect back with
 *  ?code=... query param. */
export function squareAuthorizeUrl(state: string, redirectUri: string): string {
  const appId = process.env.SQUARE_APPLICATION_ID;
  if (!appId) throw new Error("square_not_configured");
  const scope = SQUARE_SCOPES.join("+");
  const params = new URLSearchParams({
    client_id: appId,
    scope,
    session: "false",
    state,
    redirect_uri: redirectUri
  });
  return `${squareBase()}/oauth2/authorize?${params.toString()}`;
}

/** Exchange an OAuth authorization code for an access_token +
 *  refresh_token + merchant_id. Called from the /callback route. */
export async function squareExchangeCode(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  merchant_id: string;
  expires_at: string;
}> {
  const res = await fetch(`${squareBase()}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2025-06-18"
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`square_oauth_${res.status}: ${text}`);
  return JSON.parse(text);
}

/** Authenticated POST against Square using a MERCHANT'S access_token.
 *  Never uses the platform secret — that's only for the initial code
 *  exchange. */
export async function squarePost<T = unknown>(
  path: string,
  body: unknown,
  accessToken: string
): Promise<T> {
  const res = await fetch(`${squareBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-06-18"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`square_${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/** Authenticated GET against Square using a MERCHANT'S access_token. */
export async function squareGet<T = unknown>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${squareBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": "2025-06-18"
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`square_${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

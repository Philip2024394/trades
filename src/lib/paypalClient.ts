// PayPal Commerce Platform REST client — thin fetch-based wrapper.
//
// Why not @paypal/checkout-server-sdk: the official Node SDK is
// deprecated (PayPal recommends REST-direct). Fetch keeps our bundle
// clean and matches how Stripe/Square talk to us.
//
// Auth model: platform-level client_credentials OAuth token cached
// in-memory for 8h (PayPal tokens last 9h). Every request uses the
// platform token + optional PayPal-Partner-Attribution-Id header for
// revenue attribution reporting.

const CACHE: { token: string | null; expires_at: number } = {
  token: null,
  expires_at: 0
};

export function paypalBase(): string {
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  return env === "live" || env === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured(): boolean {
  return (
    typeof process.env.PAYPAL_CLIENT_ID === "string" &&
    process.env.PAYPAL_CLIENT_ID.length > 0 &&
    typeof process.env.PAYPAL_CLIENT_SECRET === "string" &&
    process.env.PAYPAL_CLIENT_SECRET.length > 0
  );
}

/** Fetch (or return cached) OAuth 2.0 access token for the platform. */
export async function getPlatformAccessToken(): Promise<string> {
  if (CACHE.token && Date.now() < CACHE.expires_at) return CACHE.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("paypal_not_configured");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error(`paypal_oauth_failed_${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  CACHE.token = j.access_token;
  // Cache for 90% of expires_in to be safe.
  CACHE.expires_at = Date.now() + j.expires_in * 900;
  return j.access_token;
}

/** Standard header set for authed PayPal calls. Includes BN Code for
 *  Partner Attribution when set. */
export async function paypalHeaders(): Promise<Record<string, string>> {
  const token = await getPlatformAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (process.env.PAYPAL_BN_CODE) {
    headers["PayPal-Partner-Attribution-Id"] = process.env.PAYPAL_BN_CODE;
  }
  return headers;
}

/** POST helper. Returns parsed JSON on 2xx, throws with body on error. */
export async function paypalPost<T = unknown>(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const h = await paypalHeaders();
  const res = await fetch(`${paypalBase()}${path}`, {
    method: "POST",
    headers: { ...h, ...extraHeaders },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`paypal_${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/** GET helper. */
export async function paypalGet<T = unknown>(path: string): Promise<T> {
  const h = await paypalHeaders();
  const res = await fetch(`${paypalBase()}${path}`, { headers: h });
  const text = await res.text();
  if (!res.ok) throw new Error(`paypal_${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

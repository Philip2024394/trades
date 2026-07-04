// Provider connection tests.
//
// Each function makes a low-impact API call to verify credentials are
// valid and the account is reachable. Returns { ok, info?, error? }.
// Merchants hit "Test connection" in /studio/payments before enabling.

import Stripe from "stripe";

export type ConnectionTestResult =
  | { ok: true; info: string }
  | { ok: false; error: string };

export async function testStripe(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const secretKey = credentials.secret_key as string | undefined;
  if (!secretKey) return { ok: false, error: "secret_key missing" };
  try {
    const stripe = new Stripe(secretKey);
    const account = await stripe.accounts.retrieve();
    const modeChip = secretKey.startsWith("sk_live_") ? "LIVE" : "TEST";
    return {
      ok: true,
      info: `${modeChip} · ${account.business_profile?.name ?? account.email ?? account.id}`
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "stripe-error" };
  }
}

export async function testPaypal(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const clientId = credentials.client_id as string | undefined;
  const secret = credentials.client_secret as string | undefined;
  const mode = ((credentials.mode as string | undefined) ?? "live").toLowerCase();
  if (!clientId || !secret) {
    return { ok: false, error: "client_id/client_secret missing" };
  }
  const base =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  try {
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { app_id?: string; scope?: string };
    return {
      ok: true,
      info: `${mode.toUpperCase()} · app ${json.app_id ?? "connected"}`
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "paypal-error" };
  }
}

export async function testMollie(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const apiKey = credentials.api_key as string | undefined;
  if (!apiKey) return { ok: false, error: "api_key missing" };
  try {
    const res = await fetch("https://api.mollie.com/v2/methods", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { count: number };
    const mode = apiKey.startsWith("live_") ? "LIVE" : "TEST";
    return { ok: true, info: `${mode} · ${json.count} methods available` };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "mollie-error" };
  }
}

export async function testRazorpay(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const keyId = credentials.key_id as string | undefined;
  const secret = credentials.key_secret as string | undefined;
  if (!keyId || !secret) return { ok: false, error: "keys missing" };
  try {
    const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`
      }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const mode = keyId.startsWith("rzp_live_") ? "LIVE" : "TEST";
    return { ok: true, info: `${mode} · Razorpay reachable` };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "razorpay-error" };
  }
}

export async function testAdyen(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const apiKey = credentials.api_key as string | undefined;
  const merchantAccount = credentials.merchant_account as string | undefined;
  const env = ((credentials.environment as string | undefined) ?? "live").toLowerCase();
  if (!apiKey || !merchantAccount) {
    return { ok: false, error: "credentials missing" };
  }
  const base =
    env === "test"
      ? "https://checkout-test.adyen.com/v71"
      : "https://checkout-live.adyen.com/checkout/v71";
  try {
    const res = await fetch(`${base}/paymentMethods`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ merchantAccount, amount: { value: 100, currency: "EUR" } })
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { paymentMethods?: unknown[] };
    return {
      ok: true,
      info: `${env.toUpperCase()} · ${json.paymentMethods?.length ?? 0} methods`
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "adyen-error" };
  }
}

export async function testKlarna(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const username = credentials.username as string | undefined;
  const password = credentials.password as string | undefined;
  const region = ((credentials.region as string | undefined) ?? "eu").toLowerCase();
  if (!username || !password) return { ok: false, error: "credentials missing" };
  const base =
    region === "na"
      ? "https://api-na.klarna.com"
      : region === "oc"
        ? "https://api-oc.klarna.com"
        : "https://api.klarna.com";
  // Klarna's cheapest live-test endpoint is /payments/v1/sessions — we
  // create a minimal session and expect a 200. Use test amount 100 EUR.
  try {
    const res = await fetch(`${base}/payments/v1/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        purchase_country: "GB",
        purchase_currency: "GBP",
        locale: "en-GB",
        order_amount: 100,
        order_lines: [
          {
            type: "physical",
            reference: "conn-test",
            name: "Connection test",
            quantity: 1,
            unit_price: 100,
            total_amount: 100,
            tax_rate: 0,
            total_tax_amount: 0
          }
        ]
      })
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, info: `${region.toUpperCase()} · session created` };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "klarna-error" };
  }
}

export async function testWise(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const token = credentials.api_token as string | undefined;
  const profileId = credentials.profile_id as string | undefined;
  if (!token || !profileId) return { ok: false, error: "credentials missing" };
  try {
    const res = await fetch(`https://api.wise.com/v1/profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { type?: string; details?: { name?: string } };
    return {
      ok: true,
      info: `${json.type ?? "profile"} · ${json.details?.name ?? "connected"}`
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "wise-error" };
  }
}

export async function testCoinbase(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const apiKey = credentials.api_key as string | undefined;
  if (!apiKey) return { ok: false, error: "api_key missing" };
  try {
    const res = await fetch("https://api.commerce.coinbase.com/charges?limit=1", {
      headers: { "X-CC-Api-Key": apiKey, "X-CC-Version": "2018-03-22" }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, info: "Coinbase Commerce reachable" };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "coinbase-error" };
  }
}

export async function testSquare(
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const token = credentials.access_token as string | undefined;
  if (!token) return { ok: false, error: "access_token missing" };
  try {
    const res = await fetch("https://connect.squareup.com/v2/locations", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Square-Version": "2024-01-17"
      }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { locations?: { name?: string }[] };
    return {
      ok: true,
      info: `${json.locations?.length ?? 0} location(s) · ${json.locations?.[0]?.name ?? ""}`
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "square-error" };
  }
}

/** Dispatch — pick the right tester per providerId. */
export async function testProvider(
  providerId: string,
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  switch (providerId) {
    case "stripe":
      return testStripe(credentials);
    case "paypal":
      return testPaypal(credentials);
    case "mollie":
      return testMollie(credentials);
    case "razorpay":
      return testRazorpay(credentials);
    case "adyen":
      return testAdyen(credentials);
    case "klarna":
      return testKlarna(credentials);
    case "wise":
      return testWise(credentials);
    case "coinbase":
      return testCoinbase(credentials);
    case "square":
    case "cash_app":
      return testSquare(credentials);
    case "cod":
    case "bank_transfer":
      // No API to test — as long as required credential fields are set
      // the config is valid.
      if (providerId === "bank_transfer") {
        if (
          !credentials.bank_name ||
          !credentials.account_number ||
          !credentials.account_holder
        ) {
          return { ok: false, error: "bank details missing" };
        }
      }
      return { ok: true, info: "Offline method — no API call needed" };
    default:
      return {
        ok: false,
        error: `${providerId} has no connection test — configuration alone is verified when you save credentials.`
      };
  }
}

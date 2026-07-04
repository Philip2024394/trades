// Studio payment provider config.
//
//   GET  /api/studio/payments
//     → { ok, configs: { providerId, enabled, hasCredentials, lastTestedAt, lastTestOk }[] }
//     Credentials are NEVER returned — masked "hasCredentials" only.
//
//   PUT  /api/studio/payments  { providerId, enabled?, credentials? }
//     Upsert a provider config. Credentials are merged (partial updates
//     supported) but the full object stays server-side.
//
//   POST /api/studio/payments/[providerId]/test
//     Reserved — actual test-connection lives per-provider in
//     src/app/api/pay/[provider]/… routes.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PAYMENT_PROVIDERS, getProvider } from "@/platform/buttons/payments/providers";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const res = await supabaseAdmin
    .from("studio_payment_providers")
    .select("provider_id, enabled, credentials, last_tested_at, last_test_ok, last_test_error")
    .eq("brand_id", session.brand.id);
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  // Merge with the full provider list so the merchant sees every
  // available provider — even the ones they haven't configured yet.
  const configuredByProvider = new Map<string, {
    enabled: boolean;
    credentials: Record<string, unknown>;
    last_tested_at: string | null;
    last_test_ok: boolean | null;
    last_test_error: string | null;
  }>();
  for (const row of res.data ?? []) {
    configuredByProvider.set(row.provider_id, {
      enabled: row.enabled,
      credentials: (row.credentials as Record<string, unknown>) ?? {},
      last_tested_at: row.last_tested_at,
      last_test_ok: row.last_test_ok,
      last_test_error: row.last_test_error
    });
  }
  const configs = PAYMENT_PROVIDERS.map((provider) => {
    const row = configuredByProvider.get(provider.id);
    const requiredKeys = provider.credentials.filter((c) => c.required).map((c) => c.key);
    const hasCredentials =
      row !== undefined &&
      requiredKeys.every((k) => {
        const v = row.credentials[k];
        return typeof v === "string" && v.length > 0;
      });
    // Mask credential presence per key so the UI can tick fields
    // without exposing values.
    const credentialPresence: Record<string, boolean> = {};
    for (const c of provider.credentials) {
      const v = row?.credentials?.[c.key];
      credentialPresence[c.key] = typeof v === "string" && v.length > 0;
    }
    return {
      providerId: provider.id,
      name: provider.name,
      region: provider.region,
      docsUrl: provider.docsUrl,
      variantKey: provider.variantKey,
      brandColour: provider.brandColour,
      enabled: row?.enabled ?? false,
      hasCredentials,
      credentialPresence,
      lastTestedAt: row?.last_tested_at ?? null,
      lastTestOk: row?.last_test_ok ?? null,
      lastTestError: row?.last_test_error ?? null,
      supportedCurrencies: provider.supportedCurrencies,
      credentialFields: provider.credentials,
      webhookEndpointHint: provider.webhookEndpointHint
    };
  });
  return NextResponse.json({ ok: true, configs });
}

type PutBody = {
  providerId: string;
  enabled?: boolean;
  credentials?: Record<string, unknown>;
};

export async function PUT(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  const provider = getProvider(body.providerId);
  if (!provider) {
    return NextResponse.json(
      { ok: false, error: "unknown-provider" },
      { status: 400 }
    );
  }

  // Load existing so we can merge credentials cleanly (partial update).
  const existing = await supabaseAdmin
    .from("studio_payment_providers")
    .select("id, credentials")
    .eq("brand_id", session.brand.id)
    .eq("provider_id", body.providerId)
    .maybeSingle();

  const currentCreds = (existing.data?.credentials as Record<string, unknown>) ?? {};
  const mergedCreds = body.credentials
    ? { ...currentCreds, ...body.credentials }
    : currentCreds;

  const payload = {
    brand_id: session.brand.id,
    provider_id: body.providerId,
    enabled: body.enabled ?? false,
    credentials: mergedCreds
  };

  if (existing.data) {
    const upd = await supabaseAdmin
      .from("studio_payment_providers")
      .update(payload)
      .eq("id", existing.data.id);
    if (upd.error) {
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
  } else {
    const ins = await supabaseAdmin
      .from("studio_payment_providers")
      .insert(payload);
    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, providerId: body.providerId });
}

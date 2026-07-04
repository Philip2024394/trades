// POST /api/studio/payments/[providerId]/test
//
// Test the merchant's stored credentials against the provider's API.
// Also updates last_tested_at / last_test_ok / last_test_error on the
// config row so the settings UI reflects state without a re-fetch.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { testProvider } from "@/platform/buttons/payments/connectionTest";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { providerId } = await params;

  const row = await supabaseAdmin
    .from("studio_payment_providers")
    .select("id, credentials")
    .eq("brand_id", session.brand.id)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json(
      { ok: false, error: "provider-not-configured" },
      { status: 404 }
    );
  }

  const result = await testProvider(
    providerId,
    (row.data.credentials as Record<string, unknown>) ?? {}
  );

  await supabaseAdmin
    .from("studio_payment_providers")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_ok: result.ok,
      last_test_error: result.ok ? null : result.error
    })
    .eq("id", row.data.id);

  return NextResponse.json({
    ok: true,
    result
  });
}

// POST /api/channels/connect-stub
//
// Dev-only endpoint that fabricates a channel connection row so the
// publications pipeline can be exercised without wiring real OAuth.
// Replace with real Meta / Google OAuth flows in later phases.
//
// Body: { merchantId, channel, externalAccountId?, displayName? }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = {
  merchantId?: string;
  channel?: string;
  externalAccountId?: string;
  displayName?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId || !body?.channel) {
    return NextResponse.json(
      { error: "merchantId + channel required" },
      { status: 400 }
    );
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "supabase unavailable" },
      { status: 503 }
    );
  }
  const c = createClient(url, key, { auth: { persistSession: false } });
  const externalAccountId =
    body.externalAccountId ?? `stub_${body.channel}_${body.merchantId.slice(0, 6)}`;
  const { data, error } = await c
    .from("merchant_channel_connections")
    .upsert(
      {
        merchant_id: body.merchantId,
        channel: body.channel,
        external_account_id: externalAccountId,
        display_name: body.displayName ?? `Stub ${body.channel} account`,
        status: "active",
        scopes: ["stub"],
        metadata: { stub: true }
      },
      { onConflict: "merchant_id,channel,external_account_id" }
    )
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { error: "connection upsert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ connectionId: data.id, channel: body.channel });
}

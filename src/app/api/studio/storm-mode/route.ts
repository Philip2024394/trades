// Studio storm-mode API.
//
//   GET  /api/studio/storm-mode → { ok, storm }
//   PUT  /api/studio/storm-mode
//     Body: { enabled, message, cta_label?, cta_href?, expires_at? }
//     → { ok }
//
// Enabled + expires-in-future means the banner renders. Expired rows
// left in place until the merchant next changes them — the public
// loader treats them as disabled.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type StormRow = {
  enabled: boolean;
  message: string | null;
  cta_label: string | null;
  cta_href: string | null;
  expires_at: string | null;
};

const DEFAULT: StormRow = {
  enabled: false,
  message: null,
  cta_label: null,
  cta_href: null,
  expires_at: null
};

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const res = await supabaseAdmin
    .from("studio_brand_storm_mode")
    .select("enabled, message, cta_label, cta_href, expires_at")
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  const storm = (res.data as StormRow | null) ?? DEFAULT;
  return NextResponse.json({ ok: true, storm });
}

type PutBody = Partial<{
  enabled: boolean;
  message: string | null;
  cta_label: string | null;
  cta_href: string | null;
  expires_at: string | null;
}>;

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

  const payload = {
    brand_id: session.brand.id,
    enabled: body.enabled ?? false,
    message: body.message ?? null,
    cta_label: body.cta_label ?? null,
    cta_href: body.cta_href ?? null,
    expires_at: body.expires_at ?? null
  };

  const upsert = await supabaseAdmin
    .from("studio_brand_storm_mode")
    .upsert(payload, { onConflict: "brand_id" });
  if (upsert.error) {
    return NextResponse.json(
      { ok: false, error: upsert.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

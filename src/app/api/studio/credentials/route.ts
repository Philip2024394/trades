// Merchant credential management.
//
//   GET  /api/studio/credentials → { ok, credentials }
//   POST /api/studio/credentials  Body: { scheme, number, display_label? }
//                                 → { ok, credential }
//
// POST is upsert-by-(brand_id, scheme, number). New rows default to
// status='unverified'. The daily verification cron (Lane 3) picks them
// up, hits the scheme's public register, and flips status to
// 'verified' / 'expired' / 'suspended'.
//
// No live verification here — a) some scheme endpoints rate-limit
// hard, b) this route is called from the wizard which must stay fast.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CREDENTIAL_SCHEMES } from "@/lib/studio/blueprints";
import type { CredentialScheme } from "@/lib/studio/blueprints";

export const runtime = "nodejs";

type CredentialRow = {
  id: string;
  scheme: string;
  number: string;
  status: string;
  verified_at: string | null;
  expires_at: string | null;
  display_label: string | null;
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
    .from("studio_brand_credentials")
    .select("id, scheme, number, status, verified_at, expires_at, display_label")
    .eq("brand_id", session.brand.id)
    .order("scheme", { ascending: true });
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    credentials: (res.data ?? []) as CredentialRow[]
  });
}

type PostBody = {
  scheme?: string;
  number?: string;
  display_label?: string | null;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  if (
    !body.scheme ||
    !(CREDENTIAL_SCHEMES as readonly string[]).includes(body.scheme)
  ) {
    return NextResponse.json(
      { ok: false, error: "unknown-scheme" },
      { status: 400 }
    );
  }
  if (!body.number || !body.number.trim()) {
    return NextResponse.json(
      { ok: false, error: "number-required" },
      { status: 400 }
    );
  }

  const scheme = body.scheme as CredentialScheme;
  const number = body.number.trim();

  const upsert = await supabaseAdmin
    .from("studio_brand_credentials")
    .upsert(
      {
        brand_id: session.brand.id,
        scheme,
        number,
        display_label: body.display_label ?? null,
        status: "unverified"
      },
      { onConflict: "brand_id,scheme,number" }
    )
    .select("id, scheme, number, status, verified_at, expires_at, display_label")
    .single();

  if (upsert.error) {
    return NextResponse.json(
      { ok: false, error: upsert.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, credential: upsert.data });
}

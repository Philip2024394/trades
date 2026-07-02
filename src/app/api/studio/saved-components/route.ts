// Studio saved components — merchant library persistence.
//
// POST /api/studio/saved-components
//   Body: { kind, name, sourceRegistrationId, config, tokenOverrides? }
//   → Inserts into studio_saved_components (schema from Module 0.1).
//
// GET /api/studio/saved-components
//   → Returns the merchant's saved components, newest first.
//   (Module 12 will render the library UI; the API ships here so the
//    Save modal from Module 9 has a real destination.)

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type CreateRequest = {
  kind: string;
  name: string;
  sourceRegistrationId?: string;
  config: Record<string, unknown>;
  tokenOverrides?: Record<string, unknown>;
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
    .from("studio_saved_components")
    .select(
      "id, kind, name, config_json, scope, thumbnail_url, usage_count, created_at"
    )
    .eq("merchant_id", session.merchant.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, items: res.data ?? [] });
}

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  let body: CreateRequest;
  try {
    body = (await req.json()) as CreateRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  if (
    typeof body.kind !== "string" ||
    !body.kind ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }
  const configJson = {
    registrationId: body.sourceRegistrationId ?? null,
    config: body.config ?? {},
    tokenOverrides: body.tokenOverrides ?? {}
  };
  const insert = await supabaseAdmin
    .from("studio_saved_components")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      kind: body.kind,
      name: body.name.trim(),
      config_json: configJson,
      scope: "personal"
    })
    .select("id, kind, name, created_at")
    .maybeSingle();
  if (insert.error || !insert.data) {
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, item: insert.data });
}

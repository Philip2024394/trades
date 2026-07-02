// Studio brand tokens API.
//
//   GET  /api/studio/tokens
//     → { ok, tokens: BrandTokens }
//
//   POST /api/studio/tokens  { kind, key, value }
//     → upserts one row into studio_brand_tokens.
//     → returns { ok, kind, key, value }
//
// Cookie-authenticated. Values are validated against per-kind rules
// (hex for color, [0..1000) for radius/spacing, string for font).

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isValidTokenKind,
  isValidTokenValue
} from "@/lib/studio/tokens";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const tokens = await loadBrandTokens(session.brand.id);
  return NextResponse.json({ ok: true, tokens });
}

type UpsertRequest = {
  kind: string;
  key: string;
  value: unknown;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: UpsertRequest;
  try {
    body = (await req.json()) as UpsertRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  if (!isValidTokenKind(body.kind)) {
    return NextResponse.json(
      { ok: false, error: "invalid-kind" },
      { status: 400 }
    );
  }
  if (typeof body.key !== "string" || !body.key || body.key.length > 60) {
    return NextResponse.json(
      { ok: false, error: "invalid-key" },
      { status: 400 }
    );
  }
  if (!isValidTokenValue(body.kind, body.value)) {
    return NextResponse.json(
      { ok: false, error: "invalid-value" },
      { status: 400 }
    );
  }

  const existing = await supabaseAdmin
    .from("studio_brand_tokens")
    .select("id")
    .eq("brand_id", session.brand.id)
    .eq("kind", body.kind)
    .eq("key", body.key)
    .maybeSingle();

  if (existing.data) {
    const res = await supabaseAdmin
      .from("studio_brand_tokens")
      .update({ value_json: body.value })
      .eq("id", existing.data.id);
    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }
  } else {
    const res = await supabaseAdmin.from("studio_brand_tokens").insert({
      brand_id: session.brand.id,
      kind: body.kind,
      key: body.key,
      value_json: body.value
    });
    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    kind: body.kind,
    key: body.key,
    value: body.value
  });
}

// Studio saved buttons — merchant's personal button library.
//
//   GET  /api/studio/saved-buttons
//     → { ok, items }
//
//   POST /api/studio/saved-buttons
//     Body: { name, variantKey, config, states?, motion?, shape? }
//     → inserts a personal saved button.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    .from("studio_saved_buttons")
    .select(
      "id, name, role, variant_key, config_json, states_json, motion_json, shape_json, usage_count, thumbnail_url, scope, created_at"
    )
    .eq("brand_id", session.brand.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    items: (res.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      variantKey: r.variant_key,
      config: r.config_json,
      states: r.states_json,
      motion: r.motion_json,
      shape: r.shape_json,
      usageCount: r.usage_count,
      thumbnailUrl: r.thumbnail_url,
      scope: r.scope,
      createdAt: r.created_at
    }))
  });
}

type PostBody = {
  name: string;
  variantKey: string;
  role: string;
  config: Record<string, unknown>;
  states?: Record<string, unknown>;
  motion?: Record<string, unknown>;
  shape?: Record<string, unknown>;
  scope?: string;
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
    typeof body.name !== "string" ||
    !body.name.trim() ||
    typeof body.variantKey !== "string" ||
    !body.variantKey ||
    typeof body.role !== "string" ||
    !body.role
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }
  const scope = body.scope === "team" ? "team" : "personal";
  const ins = await supabaseAdmin
    .from("studio_saved_buttons")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      name: body.name.trim().slice(0, 80),
      role: body.role,
      variant_key: body.variantKey,
      config_json: body.config ?? {},
      states_json: body.states ?? {},
      motion_json: body.motion ?? {},
      shape_json: body.shape ?? {},
      scope
    })
    .select("id, name, created_at")
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, item: ins.data });
}

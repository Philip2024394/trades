// Studio global buttons — brand-scoped defaults.
//
//   GET  /api/studio/global-buttons
//     → { ok, globals: { role, variantKey, config, states, motion, shape, size, version }[] }
//
//   PUT  /api/studio/global-buttons
//     Body: { role, variantKey, config, states, motion, shape, size }
//     → upserts (one per brand+role). Version bumps automatically.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "primary",
  "secondary",
  "outline",
  "ghost",
  "danger",
  "success",
  "cta"
]);

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const res = await supabaseAdmin
    .from("studio_global_buttons")
    .select("role, variant_key, config_json, states_json, motion_json, shape_json, size, version")
    .eq("brand_id", session.brand.id)
    .order("role");
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    globals: (res.data ?? []).map((r) => ({
      role: r.role,
      variantKey: r.variant_key,
      config: r.config_json,
      states: r.states_json,
      motion: r.motion_json,
      shape: r.shape_json,
      size: r.size,
      version: r.version
    }))
  });
}

type PutBody = {
  role: string;
  variantKey: string;
  config?: Record<string, unknown>;
  states?: Record<string, unknown>;
  motion?: Record<string, unknown>;
  shape?: Record<string, unknown>;
  size?: string;
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
  if (!ALLOWED_ROLES.has(body.role)) {
    return NextResponse.json(
      { ok: false, error: "invalid-role" },
      { status: 400 }
    );
  }
  if (typeof body.variantKey !== "string" || !body.variantKey) {
    return NextResponse.json(
      { ok: false, error: "invalid-variant" },
      { status: 400 }
    );
  }

  const existing = await supabaseAdmin
    .from("studio_global_buttons")
    .select("id")
    .eq("brand_id", session.brand.id)
    .eq("role", body.role)
    .maybeSingle();

  const payload = {
    brand_id: session.brand.id,
    role: body.role,
    variant_key: body.variantKey,
    config_json: body.config ?? {},
    states_json: body.states ?? {},
    motion_json: body.motion ?? {},
    shape_json: body.shape ?? {},
    size: body.size ?? null
  };

  if (existing.data) {
    const upd = await supabaseAdmin
      .from("studio_global_buttons")
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
      .from("studio_global_buttons")
      .insert(payload);
    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, role: body.role, variantKey: body.variantKey });
}

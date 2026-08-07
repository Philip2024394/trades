// PUT /api/nex/imports/session/{id}/mapping — override column mapping
//
// Body: { overrides: { "Column Name": "email"|"phone"|"name"|... }, apply_profile_id? }

import { NextResponse } from "next/server";
import { updateMapping } from "@/lib/nex/imports/runtime";
import type { MappingTarget } from "@/lib/nex/imports/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { overrides?: Record<string, MappingTarget>; apply_profile_id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const overrides = body.overrides ?? {};
  const source = body.apply_profile_id ? { profile_id: body.apply_profile_id } : "manual" as const;
  const session = updateMapping(id, overrides, source);
  if (!session) return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, session });
}

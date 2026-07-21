// DELETE /api/admin/site-editor/templates/[id]  — remove a template
// PATCH  /api/admin/site-editor/templates/[id]  — toggle active / reorder
//
// Admin-only. Companion to /api/admin/site-editor/templates (which
// handles list + create). Delete is a hard delete — templates are
// cheap to recreate from the authoring surface. PATCH accepts a
// subset of fields (active, display_order, min_tier) so the admin
// list page can flip visibility without opening the full editor.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TIERS = new Set(["app_trial", "app_paid", "verified"]);

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const res = await supabaseAdmin
    .from("hammerex_site_editor_templates")
    .delete()
    .eq("id", id);
  if (res.error) {
    console.error("[admin/templates/delete]", res.error.message);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  let body: { active?: unknown; display_order?: unknown; min_tier?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.active        === "boolean") patch.active        = body.active;
  if (typeof body.display_order === "number")  patch.display_order = body.display_order;
  if (body.min_tier === null || (typeof body.min_tier === "string" && VALID_TIERS.has(body.min_tier))) {
    patch.min_tier = body.min_tier;
  }

  const res = await supabaseAdmin
    .from("hammerex_site_editor_templates")
    .update(patch)
    .eq("id", id)
    .select("id")
    .single();
  if (res.error || !res.data) {
    console.error("[admin/templates/patch]", res.error?.message);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

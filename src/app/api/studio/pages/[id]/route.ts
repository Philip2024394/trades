// PATCH /api/studio/pages/[id]  { name?, description?, sort_order? }
//   rename / describe / re-order.
//
// DELETE /api/studio/pages/[id]
//   removes the page + its layouts (studio_layouts on-delete-cascade
//   from brand — but page_id is soft; the layouts stay unless we clean
//   them up here explicitly). Home page (is_home=true) is protected
//   because losing it would strand the merchant.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PatchBody = {
  name?: string;
  description?: string | null;
  sort_order?: number;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 80) {
      return NextResponse.json({ ok: false, error: "invalid-name" }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.description !== undefined) {
    patch.description = body.description ?? null;
  }
  if (typeof body.sort_order === "number") {
    if (!Number.isFinite(body.sort_order)) {
      return NextResponse.json({ ok: false, error: "invalid-order" }, { status: 400 });
    }
    patch.sort_order = Math.round(body.sort_order);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "empty-patch" }, { status: 400 });
  }
  const upd = await supabaseAdmin
    .from("studio_pages")
    .update(patch)
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .select("id, slug, name, description, sort_order, is_home")
    .maybeSingle();
  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }
  if (!upd.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, page: upd.data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;
  const pageRes = await supabaseAdmin
    .from("studio_pages")
    .select("id, slug, is_home")
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  if (!pageRes.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const page = pageRes.data as { slug: string; is_home: boolean };
  if (page.is_home) {
    return NextResponse.json(
      { ok: false, error: "cannot-delete-home" },
      { status: 400 }
    );
  }
  // Delete the page row first — this fails fast if the pages row is gone
  // already, and we don't want to be left with orphaned layouts.
  const del = await supabaseAdmin
    .from("studio_pages")
    .delete()
    .eq("id", id)
    .eq("brand_id", session.brand.id);
  if (del.error) {
    return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
  }
  // Clean up any layouts pinned to that slug for this brand — we
  // deliberately don't cascade at the schema level because layouts
  // outlive page renames in some flows.
  const delLayouts = await supabaseAdmin
    .from("studio_layouts")
    .delete()
    .eq("brand_id", session.brand.id)
    .eq("page_id", page.slug);
  if (delLayouts.error) {
    return NextResponse.json(
      { ok: false, error: delLayouts.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/hero-library/[id] — update a hero image.
// DELETE /api/admin/hero-library/[id] — delete a hero image.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ALLOWED_FIELDS = new Set([
  "image_url",
  "subject",
  "keywords_strict",
  "excluded_trades",
  "vibe",
  "text_zone",
  "theme_palette",
  "aspect_variants",
  "sibling_group_id",
  "hero_use_case",
  "burned_in_text",
  "worker_visible",
  "recommended_use",
  "notes"
]);

type ContextParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ContextParams) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Whitelist fields to update (id is not editable)
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No allowed fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hero_library")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, image: data });
}

export async function DELETE(_request: Request, context: ContextParams) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await supabaseAdmin
    .from("hero_library")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

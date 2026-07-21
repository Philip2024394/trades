// GET  /api/admin/site-editor/templates          — list all templates (admin)
// POST /api/admin/site-editor/templates          — create a template
//
// Admin-only CRUD for hammerex_site_editor_templates. The public GET
// (/api/site/editor/templates) filters by tier + active; this admin
// endpoint returns everything including drafts so the authoring
// surface can manage the full catalogue.
//
// Auth: verified admin cookie via isAdminAuthed(). Anything without
// admin returns 401 immediately.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveBody = {
  slug?:               unknown;
  label?:              unknown;
  category?:           unknown;
  frame_slug?:         unknown;
  state_json?:         unknown;
  thumbnail_url?:      unknown;
  min_tier?:           unknown;
  active?:             unknown;
  display_order?:      unknown;
  sibling_group_slug?: unknown;
};

const VALID_CATEGORIES = new Set([
  "quote", "before-after", "price-card", "promo",
  "testimonial", "announcement", "other"
]);
const VALID_TIERS = new Set(["app_trial", "app_paid", "verified"]);

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }
  const res = await supabaseAdmin
    .from("hammerex_site_editor_templates")
    .select("id, slug, label, category, frame_slug, state_json, thumbnail_url, min_tier, active, display_order, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (res.error) {
    console.error("[admin/templates] list failed:", res.error.message);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, templates: res.data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const slug     = typeof body.slug     === "string" ? body.slug.trim().toLowerCase() : "";
  const label    = typeof body.label    === "string" ? body.label.trim().slice(0, 120) : "";
  const category = typeof body.category === "string" && VALID_CATEGORIES.has(body.category) ? body.category : "other";
  const frameSlug = typeof body.frame_slug === "string" ? body.frame_slug.trim() : "";
  const stateJson = body.state_json;

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }
  if (!label || !frameSlug || !stateJson || typeof stateJson !== "object") {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const siblingGroupSlug =
    typeof body.sibling_group_slug === "string" && /^[a-z0-9-]+$/.test(body.sibling_group_slug)
      ? body.sibling_group_slug.trim().toLowerCase()
      : null;

  const row = {
    slug,
    label,
    category,
    frame_slug:         frameSlug,
    state_json:         stateJson as Record<string, unknown>,
    thumbnail_url:      typeof body.thumbnail_url === "string" ? body.thumbnail_url : null,
    min_tier:           typeof body.min_tier === "string" && VALID_TIERS.has(body.min_tier) ? body.min_tier : null,
    active:             body.active !== false,
    display_order:      typeof body.display_order === "number" ? body.display_order : 100,
    sibling_group_slug: siblingGroupSlug,
    updated_at:         new Date().toISOString()
  };

  // Upsert on slug — re-saving an existing template updates it in place
  // so admins can iterate without deleting first.
  const ins = await supabaseAdmin
    .from("hammerex_site_editor_templates")
    .upsert(row, { onConflict: "slug" })
    .select("id, slug")
    .single();
  if (ins.error || !ins.data) {
    console.error("[admin/templates] upsert failed:", ins.error?.message);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: ins.data.id, slug: ins.data.slug });
}

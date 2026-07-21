// GET /api/site/editor/template-backdrops
//
// Curated backdrop pool for the template-authoring flow. Returns
// the active list of backdrops the admin editor can pick as a
// template's default photo. Separate from the Site image library
// so template defaults never accidentally reference a merchant's
// deletable image.
//
// Query params:
//   q     — free-text search on label / tags
//   tag   — filter to backdrops carrying a specific tag
//   safe  — filter by text_safe_zone (top / bottom / centre / any)
//   limit / offset — pagination (default 40, max 100)

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TemplateBackdrop = {
  id:             string;
  slug:           string;
  label:          string;
  url:            string;
  width_px:       number;
  height_px:      number;
  text_safe_zone: "top" | "bottom" | "centre" | "left" | "right" | "any";
  tags:           string[];
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT     = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q      = (req.nextUrl.searchParams.get("q")    ?? "").trim().toLowerCase();
  const tag    = (req.nextUrl.searchParams.get("tag")  ?? "").trim().toLowerCase();
  const safe   = (req.nextUrl.searchParams.get("safe") ?? "").trim().toLowerCase();
  const limit  = Math.min(MAX_LIMIT, Math.max(1, Number(req.nextUrl.searchParams.get("limit")  ?? DEFAULT_LIMIT)));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));

  let sel = supabaseAdmin
    .from("hammerex_template_backdrops")
    .select("id, slug, label, url, width_px, height_px, text_safe_zone, tags")
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q)    sel = sel.ilike("label", `%${q}%`);
  if (tag)  sel = sel.contains("tags", [tag]);
  if (safe && ["top", "bottom", "centre", "left", "right", "any"].includes(safe)) {
    sel = sel.eq("text_safe_zone", safe);
  }

  const res = await sel;
  if (res.error) {
    console.error("[template-backdrops] list failed:", res.error.message);
    return NextResponse.json({ backdrops: [], hasMore: false });
  }

  const rows = res.data ?? [];
  const backdrops: TemplateBackdrop[] = rows.map((r) => ({
    id:             String(r.id),
    slug:           String(r.slug),
    label:          String(r.label),
    url:            String(r.url),
    width_px:       Number(r.width_px),
    height_px:      Number(r.height_px),
    text_safe_zone: r.text_safe_zone as TemplateBackdrop["text_safe_zone"],
    tags:           Array.isArray(r.tags) ? (r.tags as string[]) : []
  }));

  return NextResponse.json({
    backdrops,
    hasMore: rows.length === limit
  });
}

// GET /api/studio/versions?pageId=…&breakpoint=default
//
// Returns every published snapshot for the given page in reverse
// chronological order (highest version first). Excludes the full
// layout_json — the version list is browsable metadata; the actual
// layout is fetched lazily via /api/studio/versions/[id] when the
// merchant hovers a version or opens its preview.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type LayoutJson = {
  sections?: { instanceId: string }[];
  rows?: unknown[];
};

type Row = {
  id: string;
  version: number;
  published_at: string | null;
  parent_layout_id: string | null;
  layout_json: LayoutJson;
};

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId") ?? "home";
  const breakpoint = url.searchParams.get("breakpoint") ?? "default";

  const res = await supabaseAdmin
    .from("studio_layouts")
    .select("id, version, published_at, parent_layout_id, layout_json")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(200);
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  const rows = (res.data ?? []) as Row[];
  const versions = rows.map((r) => ({
    id: r.id,
    version: r.version,
    published_at: r.published_at,
    parent_layout_id: r.parent_layout_id,
    section_count: r.layout_json?.sections?.length ?? 0
  }));
  return NextResponse.json({ ok: true, versions });
}

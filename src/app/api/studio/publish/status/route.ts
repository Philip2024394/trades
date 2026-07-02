// GET /api/studio/publish/status?pageId=…  (single page)
// GET /api/studio/publish/status               (all pages for brand)
//
// Returns per-page publish state:
//   { pageId, name, hasDraft, hasPublished, latestPublishAt, pending }
// where `pending` is a diffLayouts() summary of what would ship if the
// merchant hit Publish now.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listPagesForBrand } from "@/lib/studio/pagesLoader";
import { diffLayouts } from "@/lib/studio/publish/diff";
import type { StudioLayoutJson } from "@/lib/studio/schema";

export const runtime = "nodejs";

type LayoutRow = {
  page_id: string;
  status: "draft" | "published";
  version: number;
  published_at: string | null;
  layout_json: StudioLayoutJson;
};

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const singlePage = url.searchParams.get("pageId");

  const [pages, layoutsRes] = await Promise.all([
    listPagesForBrand(session.brand.id),
    supabaseAdmin
      .from("studio_layouts")
      .select("page_id, status, version, published_at, layout_json")
      .eq("merchant_id", session.merchant.id)
      .eq("brand_id", session.brand.id)
      .eq("breakpoint", "default")
      .order("version", { ascending: false })
      .limit(500)
  ]);

  if (layoutsRes.error) {
    return NextResponse.json({ ok: false, error: layoutsRes.error.message }, { status: 500 });
  }
  const rows = (layoutsRes.data ?? []) as LayoutRow[];

  // Bucket rows: draft (unique per page) + latest published (highest version per page).
  type Bucket = {
    draft: LayoutRow | null;
    latestPublished: LayoutRow | null;
  };
  const byPage = new Map<string, Bucket>();
  const bucket = (id: string): Bucket => {
    let b = byPage.get(id);
    if (!b) {
      b = { draft: null, latestPublished: null };
      byPage.set(id, b);
    }
    return b;
  };
  for (const row of rows) {
    const b = bucket(row.page_id);
    if (row.status === "draft" && !b.draft) b.draft = row;
    if (row.status === "published" && !b.latestPublished) b.latestPublished = row;
  }

  const scope = singlePage
    ? pages.filter((p) => p.slug === singlePage)
    : pages;

  const statuses = scope.map((p) => {
    const b = byPage.get(p.slug) ?? { draft: null, latestPublished: null };
    const pending = b.draft
      ? diffLayouts(b.latestPublished?.layout_json ?? null, b.draft.layout_json)
      : null;
    return {
      pageId: p.slug,
      name: p.name,
      isHome: p.is_home,
      hasDraft: Boolean(b.draft),
      hasPublished: Boolean(b.latestPublished),
      latestPublishAt: b.latestPublished?.published_at ?? null,
      latestPublishedVersion: b.latestPublished?.version ?? null,
      pending: pending
        ? { summary: pending.summary, rowsChanged: pending.rowsChanged, changes: pending.changes }
        : null
    };
  });

  return NextResponse.json({ ok: true, pages: statuses });
}

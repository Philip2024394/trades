// POST /api/studio/ai/publish-pipeline
//
// Persists the assembled StudioLayoutJson-per-page from the Studio
// Builder pipeline directly to studio_layouts as published rows.
// Used by the "Accept & Publish" button on /studio/build.
//
// One insert per page. Each page's version increments on top of the
// previous published row for the same (merchant, brand, page_id,
// breakpoint) tuple so we keep an ancestry chain for rollback.
//
// The pipeline route never touches Supabase — this endpoint is the
// single point of persistence. That way the pipeline stays a pure
// composition step and publishing is a distinct, auditable action.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { StudioLayoutJson } from "@/lib/studio/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssembledLayoutMap = Record<string, StudioLayoutJson>;

type PostBody = {
  breakpoint?: "default" | "mobile" | "tablet";
  assembledLayouts?: AssembledLayoutMap;
};

type PagePublishResult = {
  pageId: string;
  ok: boolean;
  layoutId?: string;
  version?: number;
  publishedAt?: string;
  error?: string;
};

export async function POST(req: Request): Promise<Response> {
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

  const layouts = body.assembledLayouts;
  if (!layouts || typeof layouts !== "object") {
    return NextResponse.json(
      { ok: false, error: "no-layouts" },
      { status: 400 }
    );
  }

  const pageIds = Object.keys(layouts).filter(
    (k) => layouts[k] && Array.isArray(layouts[k].sections) && layouts[k].sections.length > 0
  );

  if (pageIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no-valid-pages" },
      { status: 400 }
    );
  }

  const breakpoint = body.breakpoint ?? "default";
  const publishedAt = new Date().toISOString();
  const results: PagePublishResult[] = [];

  // Per-page publish — sequential so version numbers don't race for
  // the same page across requests.
  for (const pageId of pageIds) {
    const layoutJson = layouts[pageId];

    // Find the previous highest-version published row for this page.
    const prev = await supabaseAdmin
      .from("studio_layouts")
      .select("id, version")
      .eq("merchant_id", session.merchant.id)
      .eq("brand_id", session.brand.id)
      .eq("page_id", pageId)
      .eq("breakpoint", breakpoint)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (prev.data?.version ?? 0) + 1;

    const ins = await supabaseAdmin
      .from("studio_layouts")
      .insert({
        merchant_id: session.merchant.id,
        brand_id: session.brand.id,
        page_id: pageId,
        breakpoint,
        layout_json: layoutJson,
        status: "published",
        version: nextVersion,
        parent_layout_id: prev.data?.id ?? null,
        published_at: publishedAt
      })
      .select("id, version, published_at")
      .maybeSingle();

    if (ins.error || !ins.data) {
      results.push({
        pageId,
        ok: false,
        error: ins.error?.message ?? "insert-failed"
      });
      continue;
    }

    results.push({
      pageId,
      ok: true,
      layoutId: ins.data.id,
      version: ins.data.version,
      publishedAt: ins.data.published_at
    });
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: okCount > 0,
    publishedCount: okCount,
    totalPages: pageIds.length,
    results
  });
}

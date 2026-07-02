// Studio publish — snapshots the current draft into a NEW immutable
// published row.
//
// Module 19: publish is now append-only. Every hit of this endpoint
// inserts a fresh row with an incremented version number and
// `parent_layout_id` pointing at the previous published version. Older
// versions are never mutated — they become the version history that
// powers rollback (POST /api/studio/versions/[id]/restore).
//
// The layout loader picks the highest-version published row as "live"
// (see layoutLoader.ts), so live traffic always sees the latest snapshot.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PublishRequest = {
  pageId: string;
  breakpoint?: string;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PublishRequest;
  try {
    body = (await req.json()) as PublishRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  if (typeof body.pageId !== "string" || !body.pageId) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }

  const breakpoint = body.breakpoint ?? "default";

  const draft = await supabaseAdmin
    .from("studio_layouts")
    .select("layout_json")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", body.pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "draft")
    .maybeSingle();

  if (!draft.data) {
    return NextResponse.json(
      { ok: false, error: "no-draft" },
      { status: 400 }
    );
  }

  // Find the previous highest-version published row so the new snapshot
  // links back as its child. This gives us a full ancestry chain for
  // future analytics / rollback UI.
  const prev = await supabaseAdmin
    .from("studio_layouts")
    .select("id, version")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", body.pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (prev.data?.version ?? 0) + 1;
  const publishedAt = new Date().toISOString();

  const ins = await supabaseAdmin
    .from("studio_layouts")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: body.pageId,
      breakpoint,
      layout_json: draft.data.layout_json,
      status: "published",
      version: nextVersion,
      parent_layout_id: prev.data?.id ?? null,
      published_at: publishedAt
    })
    .select("id, version, published_at")
    .maybeSingle();

  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    layoutId: ins.data.id,
    version: ins.data.version,
    publishedAt: ins.data.published_at
  });
}

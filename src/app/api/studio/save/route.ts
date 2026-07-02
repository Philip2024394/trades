// Studio autosave — upserts a merchant's draft layout for one page.
//
// Called by StudioLiveMirror on every layout mutation, debounced 500ms.
// Cookie-authenticated. The DB's `one draft per (merchant, brand,
// page, breakpoint)` partial-unique index (Module 0.1) means we upsert
// safely without needing a transaction.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { StudioLayoutJson } from "@/lib/studio/schema";

export const runtime = "nodejs";

type SaveRequest = {
  pageId: string;
  layoutJson: StudioLayoutJson;
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

  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  if (
    typeof body.pageId !== "string" ||
    !body.pageId ||
    typeof body.layoutJson !== "object" ||
    body.layoutJson === null
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }

  const breakpoint = body.breakpoint ?? "default";

  const existing = await supabaseAdmin
    .from("studio_layouts")
    .select("id, version")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", body.pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "draft")
    .maybeSingle();

  if (existing.data) {
    const res = await supabaseAdmin
      .from("studio_layouts")
      .update({
        layout_json: body.layoutJson,
        version: (existing.data.version ?? 1) + 1
      })
      .eq("id", existing.data.id)
      .select("id, version, updated_at")
      .maybeSingle();
    if (res.error || !res.data) {
      return NextResponse.json(
        { ok: false, error: res.error?.message ?? "update-failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      layoutId: res.data.id,
      version: res.data.version,
      savedAt: res.data.updated_at
    });
  }

  const res = await supabaseAdmin
    .from("studio_layouts")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: body.pageId,
      breakpoint,
      layout_json: body.layoutJson,
      status: "draft",
      version: 1
    })
    .select("id, version, updated_at")
    .maybeSingle();

  if (res.error || !res.data) {
    return NextResponse.json(
      { ok: false, error: res.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    layoutId: res.data.id,
    version: res.data.version,
    savedAt: res.data.updated_at
  });
}

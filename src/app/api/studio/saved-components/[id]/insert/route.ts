// POST /api/studio/saved-components/[id]/insert
//   Body: { pageId, breakpoint? }
//
// Appends the saved component as a new SectionInstance at the end of
// the merchant's draft layout for the specified page. Creates the
// draft row if none exists (uses defaultLayoutForPage as the starting
// canvas). Increments the row's version.
//
// Returns { ok, layoutId, instanceId, version } — the caller can
// deep-link into the page editor and land with the fresh section
// visible.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  defaultLayoutForPage
} from "@/lib/studio/layoutLoader";
import {
  studioId,
  type SectionInstance,
  type StudioLayoutJson
} from "@/lib/studio/schema";

export const runtime = "nodejs";

type InsertRequest = {
  pageId: string;
  breakpoint?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "missing-id" },
      { status: 400 }
    );
  }

  let body: InsertRequest;
  try {
    body = (await req.json()) as InsertRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  if (typeof body.pageId !== "string" || !body.pageId) {
    return NextResponse.json(
      { ok: false, error: "invalid-page" },
      { status: 400 }
    );
  }
  const breakpoint = body.breakpoint ?? "default";

  // ─── Load the saved component ───────────────────────────────
  const comp = await supabaseAdmin
    .from("studio_saved_components")
    .select("id, kind, name, config_json")
    .eq("id", id)
    .eq("merchant_id", session.merchant.id)
    .maybeSingle();
  if (!comp.data) {
    return NextResponse.json(
      { ok: false, error: "component-not-found" },
      { status: 404 }
    );
  }
  const saved = comp.data.config_json as {
    registrationId?: string | null;
    config?: Record<string, unknown>;
    tokenOverrides?: Record<string, unknown>;
  };
  const registrationId = saved.registrationId;
  if (!registrationId) {
    return NextResponse.json(
      { ok: false, error: "component-missing-registration" },
      { status: 400 }
    );
  }

  // Build the new SectionInstance.
  const newInstanceId = studioId("sec");
  const newRowId = studioId("row");
  const newInstance: SectionInstance = {
    instanceId: newInstanceId,
    key: registrationId,
    config: saved.config ?? {},
    ...(saved.tokenOverrides && Object.keys(saved.tokenOverrides).length > 0
      ? { tokenOverrides: saved.tokenOverrides }
      : {})
  };

  // ─── Load or seed the draft layout ──────────────────────────
  const existing = await supabaseAdmin
    .from("studio_layouts")
    .select("id, version, layout_json")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", body.pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "draft")
    .maybeSingle();

  const baseLayout: StudioLayoutJson =
    (existing.data?.layout_json as StudioLayoutJson | undefined) ??
    defaultLayoutForPage(body.pageId);

  const nextLayout: StudioLayoutJson = {
    sections: [...baseLayout.sections, newInstance],
    rows: [
      ...baseLayout.rows,
      { id: newRowId, columns: [newInstanceId] }
    ]
  };

  // ─── Upsert draft row ───────────────────────────────────────
  if (existing.data) {
    const upd = await supabaseAdmin
      .from("studio_layouts")
      .update({
        layout_json: nextLayout,
        version: (existing.data.version ?? 1) + 1
      })
      .eq("id", existing.data.id)
      .select("id, version")
      .maybeSingle();
    if (upd.error || !upd.data) {
      return NextResponse.json(
        { ok: false, error: upd.error?.message ?? "update-failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      layoutId: upd.data.id,
      instanceId: newInstanceId,
      version: upd.data.version
    });
  }

  const ins = await supabaseAdmin
    .from("studio_layouts")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: body.pageId,
      breakpoint,
      layout_json: nextLayout,
      status: "draft",
      version: 1
    })
    .select("id, version")
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  // Bump usage_count on the saved component so Live Component
  // Intelligence sees the adoption signal.
  void supabaseAdmin
    .from("studio_saved_components")
    .update({ usage_count: 1 })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    layoutId: ins.data.id,
    instanceId: newInstanceId,
    version: ins.data.version
  });
}

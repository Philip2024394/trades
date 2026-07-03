// POST /api/studio/templates/use
//   Body: { sectionId, pageId, breakpoint? }
//
// Adds a fresh instance of a Section Registry template to the
// current merchant's draft layout for the given page. Uses the
// section's `defaultConfig()` as starter config. Creates the draft
// row if none exists (via defaultLayoutForPage as the seed canvas).
//
// Returns { ok, layoutId, instanceId, version } so the caller can
// deep-link into the page editor with the fresh section already in
// place.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { defaultLayoutForPage } from "@/lib/studio/layoutLoader";
import {
  studioId,
  type SectionInstance,
  type StudioLayoutJson
} from "@/lib/studio/schema";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
// Side-effect: register every section before use so the id lookup
// always resolves.
import "@/lib/studio/sections";

export const runtime = "nodejs";

type UseTemplateBody = {
  sectionId?: string;
  pageId?: string;
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

  let body: UseTemplateBody;
  try {
    body = (await req.json()) as UseTemplateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const sectionId = typeof body.sectionId === "string" ? body.sectionId : "";
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const breakpoint = body.breakpoint ?? "default";

  if (!sectionId || !pageId) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }

  const reg = sectionRegistry.get(sectionId);
  if (!reg) {
    return NextResponse.json(
      { ok: false, error: "unknown-section" },
      { status: 404 }
    );
  }

  // Build the new SectionInstance with default config from the reg.
  const newInstanceId = studioId("sec");
  const newRowId = studioId("row");
  const newInstance: SectionInstance = {
    instanceId: newInstanceId,
    key: sectionId,
    config: reg.defaultConfig()
  };

  // Load existing draft OR seed a starter canvas.
  const existing = await supabaseAdmin
    .from("studio_layouts")
    .select("id, version, layout_json")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "draft")
    .maybeSingle();

  const baseLayout: StudioLayoutJson =
    (existing.data?.layout_json as StudioLayoutJson | undefined) ??
    defaultLayoutForPage(pageId);

  const nextLayout: StudioLayoutJson = {
    sections: [...baseLayout.sections, newInstance],
    rows: [...baseLayout.rows, { id: newRowId, columns: [newInstanceId] }]
  };

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
    // Fire-and-forget telemetry for Live Component Intelligence.
    void supabaseAdmin.from("studio_layout_events").insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: pageId,
      section_key: sectionId,
      layout_variant: null,
      event: "pick",
      payload_json: { source: "templates-library" }
    });
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
      page_id: pageId,
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

  void supabaseAdmin.from("studio_layout_events").insert({
    merchant_id: session.merchant.id,
    brand_id: session.brand.id,
    page_id: pageId,
    section_key: sectionId,
    layout_variant: null,
    event: "pick",
    payload_json: { source: "templates-library" }
  });

  return NextResponse.json({
    ok: true,
    layoutId: ins.data.id,
    instanceId: newInstanceId,
    version: ins.data.version
  });
}

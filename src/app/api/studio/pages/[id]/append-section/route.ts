// Append one section to a page's draft layout.
//
// POST /api/studio/pages/[id]/append-section  { sectionKey, config }
//
// Load current draft (or default) → append the new section instance →
// upsert draft. Server-side so the client doesn't need three round-
// trips (fetch → mutate → save).

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadLayoutForPage } from "@/lib/studio/layoutLoader";
import { studioId, type StudioLayoutJson } from "@/lib/studio/schema";

export const runtime = "nodejs";

type Body = {
  sectionKey: string;
  config: Record<string, unknown>;
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

  const { id: pageId } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  if (typeof body.sectionKey !== "string" || !body.sectionKey) {
    return NextResponse.json(
      { ok: false, error: "invalid-sectionKey" },
      { status: 400 }
    );
  }
  if (typeof body.config !== "object" || body.config === null) {
    return NextResponse.json(
      { ok: false, error: "invalid-config" },
      { status: 400 }
    );
  }

  // Confirm the page belongs to the merchant's brand. Prevents an
  // authenticated merchant from writing into another brand's page id.
  const pageRow = await supabaseAdmin
    .from("studio_pages")
    .select("id, name")
    .eq("id", pageId)
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  if (!pageRow.data) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }

  const current = await loadLayoutForPage({
    merchantId: session.merchant.id,
    brandId: session.brand.id,
    pageId,
    preferStatus: "draft"
  });

  const instanceId = studioId("sec");
  const rowId = studioId("row");
  const next: StudioLayoutJson = {
    sections: [
      ...current.sections,
      {
        key: body.sectionKey,
        config: body.config,
        instanceId
      }
    ],
    rows: [...current.rows, { id: rowId, columns: [instanceId] }]
  };

  // Upsert the draft — mirror the semantics of /api/studio/save.
  const breakpoint = "default";
  const existing = await supabaseAdmin
    .from("studio_layouts")
    .select("id, version")
    .eq("merchant_id", session.merchant.id)
    .eq("brand_id", session.brand.id)
    .eq("page_id", pageId)
    .eq("breakpoint", breakpoint)
    .eq("status", "draft")
    .maybeSingle();

  if (existing.data) {
    const res = await supabaseAdmin
      .from("studio_layouts")
      .update({
        layout_json: next,
        version: (existing.data.version ?? 1) + 1
      })
      .eq("id", existing.data.id);
    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }
  } else {
    const res = await supabaseAdmin.from("studio_layouts").insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: pageId,
      breakpoint,
      layout_json: next,
      status: "draft",
      version: 1
    });
    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    instanceId,
    pageName: pageRow.data.name
  });
}

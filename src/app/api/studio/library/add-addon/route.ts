// POST /api/studio/library/add-addon
//   Body: { pageId, addonSlug, breakpoint? }
//
// Installs an add-on section into the merchant's draft layout for the
// specified page. Creates the draft row if none exists (seeds it with
// defaultLayoutForPage). Appends the new section to a fresh row so the
// merchant can drag it later without disturbing existing rows.
//
// Returns { ok, layoutId, instanceId, version } — the caller can
// deep-link back to the page editor and the fresh addon is visible.

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
// Side-effect: ensures the registry has every add-on registration
// before we resolve one at request time.
import "@/lib/studio/sections";
import { getAddonBySlug } from "@/lib/xratedAddons";

export const runtime = "nodejs";

type AddAddonRequest = {
  pageId?: string;
  addonSlug?: string;
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

  let body: AddAddonRequest;
  try {
    body = (await req.json()) as AddAddonRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const addonSlug = typeof body.addonSlug === "string" ? body.addonSlug : "";
  const breakpoint = body.breakpoint ?? "default";

  if (!pageId || !addonSlug) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 }
    );
  }

  const addon = getAddonBySlug(addonSlug);
  if (!addon) {
    return NextResponse.json(
      { ok: false, error: "unknown-addon" },
      { status: 404 }
    );
  }

  const registrationId = `addon.${addonSlug}`;
  const reg = sectionRegistry.get(registrationId);
  if (!reg) {
    return NextResponse.json(
      {
        ok: false,
        error: "addon-not-wired-to-studio",
        detail:
          "This addon exists in the catalogue but hasn't been wrapped as a Studio section yet."
      },
      { status: 409 }
    );
  }

  const newInstanceId = studioId("sec");
  const newRowId = studioId("row");
  const newInstance: SectionInstance = {
    instanceId: newInstanceId,
    key: registrationId,
    config: reg.defaultConfig()
  };

  // Load-or-seed the draft layout.
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
    // Fire-and-forget telemetry — the pick event powers Live Component
    // Intelligence usage counts on the Add Library UI.
    void supabaseAdmin.from("studio_layout_events").insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      page_id: pageId,
      section_key: registrationId,
      layout_variant: null,
      event: "pick",
      payload_json: { source: "add-library", addon: addonSlug }
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
    section_key: registrationId,
    layout_variant: null,
    event: "pick",
    payload_json: { source: "add-library", addon: addonSlug }
  });

  return NextResponse.json({
    ok: true,
    layoutId: ins.data.id,
    instanceId: newInstanceId,
    version: ins.data.version
  });
}

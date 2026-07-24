// POST /api/nex/reload-brain
//
// Admin utility. Clears the in-memory Brain registry and forces a
// fresh reload from the filesystem drafts (or DB drafts if migration
// applied). Needed during content authoring so newly-appended facts
// become queryable without restarting the dev server.
//
// Body: { brain_slug: string }
// Returns: { ok, cleared, reloaded, item_counts }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainRegistry } from "@/lib/nex/brains/_loader";
import { exportPackFromDrafts } from "@/lib/nex/brains/_studio/_pack_exporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NEX_BRAIN_RUNTIME_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "brain_runtime_disabled" },
      { status: 503 }
    );
  }

  let body: { brain_slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const slug = typeof body.brain_slug === "string" ? body.brain_slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_brain_slug" }, { status: 400 });
  }

  // Reload registry — dev utility. In prod-with-team this would only
  // be callable by CTO after published pack export.
  brainRegistry.clear();

  const result = await exportPackFromDrafts(slug, "draft");
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      cleared: true,
      reloaded: false,
      error: `${result.reason} · ${result.detail}`
    }, { status: 500 });
  }

  brainRegistry.register(result.loaded);

  const b = result.loaded;
  return NextResponse.json({
    ok: true,
    cleared: true,
    reloaded: true,
    brain_slug: slug,
    version: b.manifest.version,
    item_counts: {
      facts:       b.craft.facts.length,
      glossary:    b.craft.glossary.length,
      regulations: b.regulations.regulations.length,
      materials:   b.materials.materials.length,
      defects:     b.defects.defects.length
    }
  });
}

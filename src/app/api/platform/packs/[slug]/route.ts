// GET /api/platform/packs/[slug]
//
// Single Pack manifest + install state, resolved apps (manifest
// snapshots for each App the Pack installs).

import { NextResponse } from "next/server";
import { packRegistry } from "@/platform/packs/registry";
import { appRegistry } from "@/platform/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";
import "@/platform/packs";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const { slug } = await params;
  const manifest = packRegistry.get(slug);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }

  const install = await platformRuntime.getInstalledPack(
    session.merchant.id,
    slug
  );

  // Resolve each App this pack installs — nulls for Apps not yet in
  // the registry (pre-Phase 9 state). The detail UI renders them as
  // "not yet available" without failing.
  const apps = manifest.apps.map((entry) => ({
    slug: entry.slug,
    manifest: appRegistry.get(entry.slug) ?? null
  }));

  return NextResponse.json({
    ok: true,
    manifest,
    install,
    apps
  });
}

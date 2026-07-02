// GET /api/platform/packs/installed
//
// Active Pack installs for the current merchant joined with their
// manifests.

import { NextResponse } from "next/server";
import { packRegistry } from "@/platform/packs/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";
import "@/platform/packs";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const installs = await platformRuntime.listActivePackInstalls(
    session.merchant.id
  );
  const items = installs.map((row) => ({
    install: row,
    manifest: packRegistry.get(row.pack_slug) ?? null
  }));
  return NextResponse.json({ ok: true, items });
}

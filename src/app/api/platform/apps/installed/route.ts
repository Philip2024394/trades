// GET /api/platform/apps/installed
//
// The current merchant's active App installs joined with each App's
// manifest. Powers Studio's "Your Apps" panel and the App Store's
// installed tab.

import { NextResponse } from "next/server";
import { appRegistry } from "@/platform/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";

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

  const installs = await platformRuntime.listActiveInstalls(session.merchant.id);

  const items = installs.map((row) => ({
    install: row,
    manifest: appRegistry.get(row.app_slug) ?? null
  }));

  return NextResponse.json({ ok: true, items });
}

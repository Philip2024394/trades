// POST /api/platform/packs/uninstall
//   { slug, purgeData? }
//
// Runs runtime.uninstallPack for the session merchant. Soft by
// default. Brand tokens + home layout are never reverted.

import { NextResponse } from "next/server";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";
import "@/platform/packs";

export const runtime = "nodejs";

type Body = { slug?: string; purgeData?: boolean };

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "missing-slug" },
      { status: 400 }
    );
  }

  const result = await platformRuntime.uninstallPack(slug, {
    merchantId: session.merchant.id,
    purgeData: !!body.purgeData
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    slug: result.slug,
    uninstalledApps: result.uninstalledApps,
    failedApps: result.failedApps,
    purged: result.purged
  });
}

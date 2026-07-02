// POST /api/platform/apps/install
//   { slug, config? }
//
// The single HTTP entry point for merchants installing an App from
// Studio. Delegates directly to runtime.installApp; the Runtime owns
// preflight, dependency resolution, page creation, and ledger writes.
// This route only translates HTTP ↔ Runtime.

import { NextResponse } from "next/server";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";

export const runtime = "nodejs";

type Body = { slug?: string; config?: Record<string, unknown> };

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

  const result = await platformRuntime.installApp(slug, {
    merchantId: session.merchant.id,
    brandId: session.brand.id,
    config: body.config
  });

  if (!result.ok) {
    const status = result.error.code === "unknown-app" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    installedApp: result.installedApp,
    createdPages: result.createdPages
  });
}

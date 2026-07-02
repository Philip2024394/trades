// POST /api/platform/packs/install
//   { slug }
//
// Runs runtime.installPack for the session merchant.

import { NextResponse } from "next/server";
import { runtime as platformRuntime } from "@/platform/runtime";
import { loadStudioSession } from "@/lib/studio/session";
import "@/platform/apps";
import "@/platform/packs";

export const runtime = "nodejs";

type Body = { slug?: string };

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

  const result = await platformRuntime.installPack(slug, {
    merchantId: session.merchant.id,
    brandId: session.brand.id
  });

  if (!result.ok) {
    const status = result.error.code === "unknown-pack" ? 404 : 400;
    return NextResponse.json(
      { ok: false, error: result.error },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    pack: result.pack,
    installedApps: result.installedApps,
    brandTokens: result.brandTokens,
    homeLayout: result.homeLayout
  });
}

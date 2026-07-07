// POST /api/studio/apps/[slug]/install
// Form-encoded: merchantId
//
// Installs the App for the merchant and redirects them back to the
// Studio home. Delegates all logic to the Runtime.

import { NextResponse } from "next/server";
import { installApp } from "@/platform/studio/runtime";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const form = await request.formData().catch(() => null);
  const merchantId = form?.get("merchantId")?.toString();
  if (!merchantId) {
    return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  }
  const result = await installApp(slug, merchantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason ?? "install failed" },
      { status: 400 }
    );
  }
  return NextResponse.redirect(new URL("/studio/apps?installed=" + slug, request.url));
}

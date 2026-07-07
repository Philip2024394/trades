import { NextResponse } from "next/server";
import { uninstallApp } from "@/platform/studio/runtime";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const form = await request.formData().catch(() => null);
  const merchantId = form?.get("merchantId")?.toString();
  if (!merchantId) {
    return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  }
  const result = await uninstallApp(slug, merchantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason ?? "uninstall failed" },
      { status: 400 }
    );
  }
  return NextResponse.redirect(new URL("/studio/apps?uninstalled=" + slug, request.url));
}

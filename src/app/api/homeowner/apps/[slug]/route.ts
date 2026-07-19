// POST   /api/homeowner/apps/[slug] — install the app for this homeowner
// DELETE /api/homeowner/apps/[slug] — uninstall (data survives)

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { installApp, uninstallApp } from "@/lib/homeowners/apps";
import type { SiteBookAppSlug } from "@/apps/sitebook/_shared/manifest";
import { SITEBOOK_APPS } from "@/apps/sitebook/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  const { slug } = await params;
  if (!SITEBOOK_APPS[slug as SiteBookAppSlug]) return NextResponse.json({ ok: false, error: "unknown-app" }, { status: 404 });
  const res = await installApp({ homeownerId: homeowner.id, slug: slug as SiteBookAppSlug });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  const { slug } = await params;
  if (!SITEBOOK_APPS[slug as SiteBookAppSlug]) return NextResponse.json({ ok: false, error: "unknown-app" }, { status: 404 });
  const res = await uninstallApp({ homeownerId: homeowner.id, slug: slug as SiteBookAppSlug });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

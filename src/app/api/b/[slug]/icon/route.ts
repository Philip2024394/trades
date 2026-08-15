// NEX Business PWA · GET /api/b/[slug]/icon (Philip 2026-08-14 · Phase 18).
//
// Per-business PWA icon · SVG generated from business identity + brand.
// If the Blueprint later carries a real logo URL we'll serve that instead;
// today we produce a clean initials tile so every business is installable
// out of the box without requiring an uploaded logo.

import { NextResponse } from "next/server";
import { ensureSeeded, getBusiness } from "@/lib/nex/business-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) return NextResponse.json({ error: "unknown-business" }, { status: 404 });

  const url = new URL(req.url);
  const size = clampSize(Number(url.searchParams.get("size") ?? "512"));
  const initial = biz.blueprint.identity.displayName.charAt(0).toUpperCase() || "N";
  const primary = biz.blueprint.brand.palette.primary;
  const onPrimary = biz.blueprint.brand.palette.onPrimary;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${escapeXml(primary)}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-weight="700" font-size="${Math.round(size * 0.5)}" fill="${escapeXml(onPrimary)}">${escapeXml(initial)}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=300"
    }
  });
}

function clampSize(n: number): number {
  if (!Number.isFinite(n)) return 512;
  return Math.min(1024, Math.max(48, Math.round(n)));
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" }[c] as string));
}

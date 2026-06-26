// GET /trade/<slug>/qr.png
// Server-rendered QR code that points to the public Trade Off profile.
// Cached for 24h at the edge — slug + URL never change after publish.
//
// Query flags:
//   ?download=1   adds a Content-Disposition: attachment header.

import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/seo";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const cleanSlug = slug.replace(/[^a-zA-Z0-9-]/g, "");
  if (!cleanSlug) {
    return NextResponse.json({ ok: false, error: "Bad slug" }, { status: 400 });
  }

  const url = `${siteUrl()}/trade/${cleanSlug}`;
  const png = await QRCode.toBuffer(url, {
    width: 800,
    margin: 2,
    color: { dark: "#0a0a0a", light: "#ffffff" },
    errorCorrectionLevel: "H"
  });

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable"
  };
  if (req.nextUrl.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="hammerex-trade-off-${cleanSlug}.png"`;
  }

  // Convert Node Buffer to Uint8Array view for the Response body — keeps
  // TypeScript happy under the Web Streams BodyInit type.
  return new Response(new Uint8Array(png), { headers });
}

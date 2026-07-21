// POST /api/site/editor/export
//
// The client flattens the Konva stage to a PNG data URL and posts
// the bytes here. Server-side we:
//   1. Determine entitlement — merchant on paid tier, active Site
//      sub, or bundling tier → no watermark. Otherwise burn the
//      standard "thenetworkers.app" mark into the bytes via sharp.
//   2. Return the final bytes with attachment headers so the browser
//      triggers a download.
//
// Why watermark server-side and not client-side? Because a client
// watermark can be edited out via devtools before submit. The server
// is the only trusted point to enforce the paid/unpaid split.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";
import { hasActiveSiteSubscription, hasBundlingTier } from "@/lib/siteAccess";
import { watermarkExport } from "@/lib/siteWatermark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

/** Detect whether the caller gets the clean, unwatermarked export.
 *  Blanket rules only — a per-image purchase doesn't grant a whole-
 *  composition export. */
async function callerIsPaid(): Promise<boolean> {
  const slug = await getMerchantSlug();
  if (slug) {
    if (await hasActiveSiteSubscription(slug)) return true;
    if (await hasBundlingTier(slug))            return true;
  }
  const email = await readSiteBuyerEmailCookie();
  if (email) {
    // Anonymous subs are keyed by email in hammerex_site_subscriptions.
    const res = await supabaseAdmin
      .from("hammerex_site_subscriptions")
      .select("id, status, current_period_end")
      .eq("buyer_email", email)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();
    if (res.data) return true;
  }
  return false;
}

function decodeDataUrl(input: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([\w./+-]+);base64,(.+)$/i.exec(input);
  if (!m) return null;
  try {
    return { mime: m[1], bytes: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { data_url?: unknown; filename?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.data_url !== "string" || body.data_url.length === 0) {
    return NextResponse.json({ error: "data_url_required" }, { status: 400 });
  }
  const decoded = decodeDataUrl(body.data_url);
  if (!decoded) return NextResponse.json({ error: "invalid_data_url" }, { status: 400 });
  if (decoded.bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const paid = await callerIsPaid();
  const finalBytes = paid ? decoded.bytes : await watermarkExport(decoded.bytes);

  const filenameRaw = typeof body.filename === "string" ? body.filename : "the-site-export";
  const filename = filenameRaw.replace(/[^a-zA-Z0-9-_.]/g, "-").slice(0, 100);
  const ext = decoded.mime.includes("jpeg") ? "jpg"
            : decoded.mime.includes("webp") ? "webp"
            : "png";

  return new NextResponse(new Uint8Array(finalBytes), {
    status: 200,
    headers: {
      "Content-Type":         decoded.mime,
      "Content-Disposition":  `attachment; filename="${filename}.${ext}"`,
      "Cache-Control":        "private, no-store",
      "X-Site-Export-Paid":   paid ? "1" : "0"
    }
  });
}

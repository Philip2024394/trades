// GET /api/assets/scan/[id]
//
// The endpoint every QR code on every printed asset resolves to.
// Logs a scan row (used for merchant + admin analytics) then 302s
// the scanner to the merchant's canteen page.
//
// Public (no auth) — anyone with a QR code can hit it. IP is
// hashed for GDPR; user-agent + referer + country + city are
// stored plaintext because they're non-personal.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashIp(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "0.0.0.0";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params;

  const { data: asset } = await supabaseAdmin
    .from("hammerex_merchant_assets")
    .select("id, merchant_slug, kind")
    .eq("id", id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.redirect(`${siteOrigin(req)}/?scan=missing`, { status: 302 });
  }

  // Fire-and-forget scan log — never blocks the redirect
  supabaseAdmin.from("hammerex_merchant_asset_scans").insert({
    asset_id:      asset.id,
    merchant_slug: asset.merchant_slug,
    user_agent:    req.headers.get("user-agent") ?? null,
    referer:       req.headers.get("referer")    ?? null,
    ip_hash:       hashIp(req),
    country_code:  req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? null,
    city:          req.headers.get("x-vercel-ip-city") ?? null
  }).then(() => {}, (e) => console.error("[assets/scan] log failed:", e));

  // Redirect straight to the merchant's canteen
  return NextResponse.redirect(`${siteOrigin(req)}/${asset.merchant_slug}?from=asset&kind=${asset.kind}`, { status: 302 });
}

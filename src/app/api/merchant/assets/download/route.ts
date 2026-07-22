// GET /api/merchant/assets/download?id=<uuid>&wa=<phone>&format=pdf
//
// Returns the asset as a downloadable PDF. Logs the opt-in row
// (asset_downloads) which powers the signup-magnet funnel: a
// WhatsApp number seen here that doesn't have a merchant listing
// gets routed into the join wizard later.
//
// The endpoint is authenticated by merchant session — merchants
// download their own assets. A future PUBLIC variant will accept
// a shared token so their customers can download review cards.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { TEMPLATES, renderAssetPdf, type AssetKind } from "@/lib/assetEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normaliseWa(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 15);
}

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

export async function GET(req: NextRequest): Promise<Response> {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const id     = params.get("id") ?? "";
  const wa     = normaliseWa(params.get("wa") ?? "");
  const format = params.get("format") ?? "pdf";

  const { data: asset } = await supabaseAdmin
    .from("hammerex_merchant_assets")
    .select("id, merchant_slug, kind, template_slug, headline, footer_removed_paid_at")
    .eq("id", id)
    .maybeSingle();

  if (!asset)                              return NextResponse.json({ ok: false, error: "not_found" },     { status: 404 });
  if (asset.merchant_slug !== slug)        return NextResponse.json({ ok: false, error: "not_owner" },    { status: 403 });

  const template = TEMPLATES.find((t) => t.slug === asset.template_slug && t.kind === asset.kind);
  if (!template) return NextResponse.json({ ok: false, error: "template_missing" }, { status: 500 });

  // Merchant identity — pulled from the listing row
  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, primary_trade, city, google_review_url, rating_count, rating_avg")
    .eq("slug", slug)
    .maybeSingle();

  const displayName = listing?.display_name ?? slug;
  const tradeLabel  = (listing?.primary_trade as string | null) ?? "Trade";
  const city        = (listing?.city as string | null) ?? null;

  // QR target: for site posters + business cards → scan handler
  // (logs then redirects to canteen). For Google review → straight
  // to their Google review URL if we have it, else scan handler.
  const scanUrl = `${siteOrigin(req)}/api/assets/scan/${asset.id}`;
  const qrTargetUrl =
    asset.kind === "google_review" && listing?.google_review_url
      ? String(listing.google_review_url)
      : scanUrl;

  const pdfBytes = await renderAssetPdf(template, {
    merchantSlug:    slug,
    displayName,
    tradeLabel,
    city,
    headline:        asset.headline ?? "",
    qrTargetUrl,
    footerRemoved:   !!asset.footer_removed_paid_at,
    googleReviewUrl: (listing?.google_review_url as string | null) ?? null,
    reviewCount:     (listing?.rating_count as number | null) ?? 0,
    reviewAvg:       (listing?.rating_avg   as number | null) ?? 0
  });

  // Log the download — used for admin analytics + signup-magnet funnel
  await supabaseAdmin.from("hammerex_merchant_asset_downloads").insert({
    asset_id:         asset.id,
    merchant_slug:    slug,
    downloaded_by_wa: wa || null,
    ip_hash:          hashIp(req),
    user_agent:       req.headers.get("user-agent") ?? null,
    format
  });

  const filename = `${slug}-${asset.kind}-v${asset.template_slug}.pdf`;

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store"
    }
  });
}

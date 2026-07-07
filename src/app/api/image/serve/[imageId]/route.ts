// GET /api/image/serve/[imageId]
//
// Serves a watermarked image based on the caller's licence.
//
//   No licence          → tier = "preview"  (visible URL + center chip
//                                              + metadata + steganography)
//   Standard/Extended   → tier = "standard" (metadata + steganography)
//   Full buyout owner   → tier = "clean"    (untouched original)
//
// The imageId maps to an entry in the hero-library or before-after
// library — we resolve the source URL, fetch bytes, run the pipeline,
// and stream back. Licence is looked up via the image_licenses table
// (added in Phase C); for Phase B we default everyone to "preview".
//
// Warm requests hit an in-memory LRU cache so repeat views on the
// same Node instance skip the Sharp pipeline entirely.

import { NextResponse } from "next/server";
import { runWatermarkPipeline } from "@/lib/watermark/pipeline";
import { registerImage } from "@/lib/watermark/registry";
import { cacheGet, cacheSet } from "@/lib/watermark/cache";
import type { WatermarkTier } from "@/lib/watermark/config";
import { allHeroImages } from "@/lib/hero-swap/library";
import { allBeforeAfterEntries } from "@/lib/before-after/library";
import {
  loadBestLicenseForMerchant,
  loadBestLicenseForEmail,
  loadFullBuyoutFor
} from "@/lib/licenses/loader";
import { licenseTierToWatermarkTier } from "@/lib/licenses/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ imageId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { imageId } = await context.params;
  if (!imageId) {
    return NextResponse.json({ error: "imageId required" }, { status: 400 });
  }

  // Resolve the source URL. First hero library, then before/after.
  const sourceUrl =
    allHeroImages().find((h) => h.id === imageId)?.image_url ??
    allBeforeAfterEntries().find((b) => b.id === imageId)?.image_url ??
    null;
  if (!sourceUrl) {
    return NextResponse.json({ error: "unknown imageId" }, { status: 404 });
  }

  const tier = await resolveTier(imageId, request);

  // Cache check — key by imageId + tier so tier changes invalidate.
  const cacheKey = `${imageId}::${tier}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Watermark-Tier": tier,
        "X-Watermark-Layers": cached.layers.join(","),
        "X-Cache": "HIT"
      }
    });
  }

  // Fetch the source image bytes.
  let srcBuffer: Buffer;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const arr = await res.arrayBuffer();
    srcBuffer = Buffer.from(arr);
  } catch (e) {
    return NextResponse.json(
      { error: "failed to fetch source", detail: String(e) },
      { status: 502 }
    );
  }

  // Run the pipeline for the requested tier.
  const result = await runWatermarkPipeline({
    imageBuffer: srcBuffer,
    imageId,
    tier
  });

  const contentType = tier === "clean" ? guessMime(sourceUrl) : "image/png";
  cacheSet(cacheKey, result.imageBuffer, contentType, result.appliedLayers);

  // Register / update the watermark row (fire-and-forget style — we
  // don't block the response if the DB is unreachable).
  registerImage(
    imageId,
    result.originalAHash,
    result.outputAHash,
    tier,
    result.appliedLayers
  ).catch(() => {});

  return new NextResponse(new Uint8Array(result.imageBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Watermark-Tier": tier,
      "X-Watermark-Layers": result.appliedLayers.join(","),
      "X-Cache": "MISS"
    }
  });
}

/** Tier resolution rules (in order):
 *
 *   1. If ANY active full_buyout exists on the image → clean for that
 *      buyer, still preview for everyone else (buyout removes the
 *      image from the catalogue for the general public).
 *   2. If the caller is a merchant (x-merchant-id header) and holds
 *      an active licence → map to the appropriate watermark tier.
 *   3. If the caller is an external buyer (email query param, e.g.
 *      arriving from an email download link) and holds an active
 *      licence → map to the appropriate watermark tier.
 *   4. Otherwise → preview (visible URL + steganography + metadata).
 */
async function resolveTier(
  imageId: string,
  request: Request
): Promise<WatermarkTier> {
  const url = new URL(request.url);
  // Merchant id: header (server-to-server) wins, then ?m= (browser
  // <img> tag can't set headers, so query string is required for the
  // public merchant view path).
  const merchantId =
    request.headers.get("x-merchant-id") ?? url.searchParams.get("m");
  const emailToken = url.searchParams.get("email");

  // Buyout check first — the buyer sees clean, everyone else sees
  // preview (the image is removed from the catalogue but the serve
  // endpoint still watermarks it for anyone who tries the URL).
  const buyout = await loadFullBuyoutFor(imageId);
  if (buyout) {
    if (
      (merchantId && buyout.buyerMerchantId === merchantId) ||
      (emailToken && buyout.buyerEmail === emailToken)
    ) {
      return "clean";
    }
    return "preview";
  }

  if (merchantId) {
    const merchantLicense = await loadBestLicenseForMerchant(
      imageId,
      merchantId
    );
    if (merchantLicense) {
      return licenseTierToWatermarkTier(merchantLicense.licenseTier);
    }
  }
  if (emailToken) {
    const emailLicense = await loadBestLicenseForEmail(imageId, emailToken);
    if (emailLicense) {
      return licenseTierToWatermarkTier(emailLicense.licenseTier);
    }
  }
  return "preview";
}

function guessMime(url: string): string {
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  if (/\.jpe?g(\?|$)/i.test(url)) return "image/jpeg";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  return "image/png";
}

// GET /api/store/download/[token]?item=<id>&variant=instagram|website|mobile|full
//
// Serve the full-res image (or a use-case crop) to a buyer. Reads the
// order by download_token, verifies paid + not expired, fetches the
// requested variant from ImageKit, pipes through the watermark
// pipeline (LSB stego with the buyer-specific URL + IPTC copyright),
// registers the aHash for repost detection, then streams the file back.
//
// Back-compat: accepts legacy `?size=web|print|full` — remapped by
// normaliseVariant() so old email links still work.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normaliseVariant, urlForVariant, filenameForVariant } from "@/lib/storeImageVariants";
import { runWatermarkPipeline } from "@/lib/watermark/pipeline";
import { registerImage } from "@/lib/watermark/registry";
import { embedPayload } from "@/lib/watermark/steganography";

export const runtime = "nodejs";        // sharp needs the node runtime
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ ok: false, error: "missing-token" }, { status: 400 });

  const url = new URL(req.url);
  const variant = normaliseVariant(url.searchParams.get("variant") ?? url.searchParams.get("size"));
  const itemId = url.searchParams.get("item") ?? null;

  const res = await supabaseAdmin
    .from("hammerex_store_orders")
    .select("id, item_url, item_id, items_json, pack_size, paid, download_expires_at, buyer_email")
    .eq("download_token", token)
    .maybeSingle();
  if (res.error || !res.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const order = res.data as {
    id:                  string;
    item_url:            string | null;
    item_id:             string | null;
    items_json:          Array<{ id: string; url: string; alt: string | null }> | null;
    pack_size:           number | null;
    paid:                boolean;
    download_expires_at: string;
    buyer_email:         string | null;
  };
  if (!order.paid) return NextResponse.json({ ok: false, error: "not-paid" }, { status: 402 });
  if (new Date(order.download_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 410 });
  }

  // Resolve target image
  let targetUrl: string | null = null;
  let targetId:  string | null = null;
  if (order.items_json && order.items_json.length > 0) {
    if (itemId) {
      const hit = order.items_json.find((i) => i.id === itemId);
      if (hit) { targetUrl = hit.url; targetId = hit.id; }
    } else if (order.items_json.length === 1) {
      targetUrl = order.items_json[0].url;
      targetId  = order.items_json[0].id;
    }
  }
  if (!targetUrl && order.item_url) {
    targetUrl = order.item_url;
    targetId  = order.item_id;
  }
  if (!targetUrl) {
    return NextResponse.json({ ok: false, error: "item-not-found", detail: "Provide ?item=<id> for pack downloads" }, { status: 400 });
  }

  const finalImgUrl = urlForVariant(targetUrl, variant);
  const filename    = filenameForVariant(targetId ?? order.id, variant);

  // Fetch → watermark → serve. `standard` tier = stego + IPTC copyright
  // only (no visible marks — the buyer paid for a clean image).
  try {
    const srcRes = await fetch(finalImgUrl);
    if (!srcRes.ok) {
      return NextResponse.json({ ok: false, error: "upstream-fetch", status: srcRes.status }, { status: 502 });
    }
    const srcBuf = Buffer.from(await srcRes.arrayBuffer());

    const pipe = await runWatermarkPipeline({
      imageBuffer: srcBuf,
      imageId:     targetId ?? order.id,
      tier:        "standard"
    });

    // Buyer-specific stego overlay: embed order+buyer so a leaked file
    // is traceable to the source. runWatermarkPipeline embedded the
    // canonical URL first; overwrite with a richer payload here.
    const buyerPayload = JSON.stringify({
      i: targetId ?? order.id,
      o: order.id,
      b: order.buyer_email ?? "unknown",
      t: Date.now()
    });
    const finalBuf = await embedPayload(pipe.imageBuffer, buyerPayload).catch(() => pipe.imageBuffer);

    // Register aHash so we can find reposts later. Best-effort — don't
    // fail the download if the registry write errors.
    registerImage(
      targetId ?? order.id,
      pipe.originalAHash,
      pipe.outputAHash,
      "standard",
      pipe.appliedLayers
    ).catch(() => {});

    return new NextResponse(new Uint8Array(finalBuf), {
      status: 200,
      headers: {
        "Content-Type":        "image/png",
        "Content-Length":      String(finalBuf.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "private, max-age=0, no-store"
      }
    });
  } catch (err) {
    console.error("[store/download] watermark pipeline failed:", err);
    // Fallback to the raw redirect so the buyer isn't blocked if
    // watermarking breaks. Trade-off: uncatalogued download.
    return NextResponse.redirect(finalImgUrl, {
      status: 302,
      headers: { "Content-Disposition": `attachment; filename="${filename}"` }
    });
  }
}

// GET /api/store/member-download?item=<id>&variant=instagram|website|mobile|full
//
// Members-only download endpoint (cookie-gated). Uses the same
// variant helper as the paid-order download and the same watermark
// pipeline — every member download is fingerprinted with the
// member's email so leaks trace back to the account.

import { NextResponse } from "next/server";
import { memberEmailFromRequest, isActiveMember } from "@/lib/storeMemberSession";
import { storeImageById } from "@/lib/storeLibrary.server";
import { normaliseVariant, urlForVariant, filenameForVariant } from "@/lib/storeImageVariants";
import { runWatermarkPipeline } from "@/lib/watermark/pipeline";
import { registerImage } from "@/lib/watermark/registry";
import { embedPayload } from "@/lib/watermark/steganography";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const itemId = url.searchParams.get("item");
  const variant = normaliseVariant(url.searchParams.get("variant") ?? url.searchParams.get("size"));
  if (!itemId) return NextResponse.json({ ok: false, error: "missing-item" }, { status: 400 });

  const email  = memberEmailFromRequest(req);
  if (!email)  return NextResponse.json({ ok: false, error: "not-member" }, { status: 401 });
  const active = await isActiveMember(email);
  if (!active) return NextResponse.json({ ok: false, error: "membership-inactive" }, { status: 403 });

  const img = await storeImageById(itemId);
  if (!img)    return NextResponse.json({ ok: false, error: "image-not-found" }, { status: 404 });

  const finalImgUrl = urlForVariant(img.url, variant);
  const filename    = filenameForVariant(img.id, variant);

  try {
    const srcRes = await fetch(finalImgUrl);
    if (!srcRes.ok) {
      return NextResponse.json({ ok: false, error: "upstream-fetch", status: srcRes.status }, { status: 502 });
    }
    const srcBuf = Buffer.from(await srcRes.arrayBuffer());

    const pipe = await runWatermarkPipeline({
      imageBuffer: srcBuf,
      imageId:     img.id,
      tier:        "standard"
    });

    const memberPayload = JSON.stringify({
      i: img.id,
      m: email,
      t: Date.now()
    });
    const finalBuf = await embedPayload(pipe.imageBuffer, memberPayload).catch(() => pipe.imageBuffer);

    registerImage(img.id, pipe.originalAHash, pipe.outputAHash, "standard", pipe.appliedLayers).catch(() => {});

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
    console.error("[store/member-download] watermark pipeline failed:", err);
    return NextResponse.redirect(finalImgUrl, {
      status: 302,
      headers: { "Content-Disposition": `attachment; filename="${filename}"` }
    });
  }
}

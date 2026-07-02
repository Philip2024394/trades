// GET /api/studio/media — the merchant's uploaded media, newest first.
//
// Cookie-authenticated. Returns { ok, items } where items is a plain
// array of StudioMediaItem — no pagination cursor yet (Module 7 caps
// at 200 which covers early-stage merchants easily; later modules can
// add cursor + search once real usage warrants).

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { listMerchantMedia } from "@/lib/studio/mediaLoader";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const items = await listMerchantMedia(session.merchant.id);
  return NextResponse.json({ ok: true, items });
}

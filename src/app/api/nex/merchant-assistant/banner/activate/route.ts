// POST /api/nex/merchant-assistant/banner/activate
//
// The UI's "Activate this banner version" button endpoint. Swaps
// which banner version is live on the offer. The DB unique partial
// index enforces one active banner per offer; this endpoint does the
// deactivate-then-activate swap explicitly to keep that constraint
// from firing on the write.
//
// Body: { banner_id }
// Returns:
//   200 { ok: true, banner_id }
//   401 not_authenticated · 400 missing_banner_id · 400 activation_failed

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadMerchantContextFromSession } from "@/lib/nex/merchant-assistant/contextLoader";
import { activateBannerVersion } from "@/lib/nex/merchant-assistant/bannerGenerator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await loadMerchantContextFromSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let body: { banner_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const bannerId =
    typeof body.banner_id === "string" ? body.banner_id.trim() : "";
  if (!bannerId) {
    return NextResponse.json(
      { ok: false, error: "missing_banner_id" },
      { status: 400 }
    );
  }

  const result = await activateBannerVersion(ctx, bannerId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, banner_id: result.bannerId });
}

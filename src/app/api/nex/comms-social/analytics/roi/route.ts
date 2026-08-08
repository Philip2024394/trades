// GET /api/nex/comms-social/analytics/roi?tenant_id=&model=&window_days=
//
// Merchant-facing ROI · reads existing Attribution machinery (S-XI) ·
// returns language_hint that the UI renders verbatim so the
// "£X had a social touchpoint" language discipline can't drift.
import { NextResponse } from "next/server";
import { computeSocialRoi } from "@/lib/nex/comms-social/analytics/roi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const model = (url.searchParams.get("model") ?? "last_touch") as "first_touch"|"last_touch"|"linear";
  const window_days = url.searchParams.get("window_days") ? Number(url.searchParams.get("window_days")) : undefined;
  try {
    const summary = await computeSocialRoi({ tenant_id, model, window_days });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

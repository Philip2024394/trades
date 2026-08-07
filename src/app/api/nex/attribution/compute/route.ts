// POST /api/nex/attribution/compute · run attribution
// Body: { conversion_id?: string, models?: AttributionModel[], touchpoint_types?: string[] }
// If conversion_id is omitted, computes for all pending conversions.
import { NextResponse } from "next/server";
import { computeAttribution, computePending } from "@/lib/nex/attribution/engine";
import type { AttributionModel } from "@/lib/nex/attribution/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { conversion_id?: string; models?: AttributionModel[]; touchpoint_types?: string[] } = {};
  try { body = await request.json() as typeof body; } catch { /* body optional */ }
  try {
    if (body.conversion_id) {
      const r = await computeAttribution(body.conversion_id, { models: body.models, touchpoint_types: body.touchpoint_types });
      if (!r) return NextResponse.json({ ok: false, error: "conversion_not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, ...r });
    }
    const pending = await computePending(body.models);
    return NextResponse.json({ ok: true, ...pending });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4) : undefined }, { status: 500 });
  }
}

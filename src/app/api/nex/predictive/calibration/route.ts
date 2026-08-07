// GET /api/nex/predictive/calibration?target=&model_version=&now=
// Read-only measurement pass over nex.predictions + nex.conversion_events.
// Writes to no table. Answers "does the prediction predict reality?"
import { NextResponse } from "next/server";
import { computeCalibration } from "@/lib/nex/predictive/calibration";
import type { PredictionTarget } from "@/lib/nex/predictive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = (url.searchParams.get("target") ?? "conversion_probability") as PredictionTarget;
  const model_version = url.searchParams.get("model_version") ?? undefined;
  const now = url.searchParams.get("now") ?? undefined;
  try {
    const report = await computeCalibration({ target, model_version, now });
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4) : undefined,
    }, { status: 500 });
  }
}

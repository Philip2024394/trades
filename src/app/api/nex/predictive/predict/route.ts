// POST /api/nex/predictive/predict · run inference for a target + contact
// Body: { target, contact_id, mode?, window_days?, correlation_id?, now? }
//
// v0.1 supports target='conversion_probability'. Additional targets land
// in later tickets under the same doctrine (invariant #15).
import { NextResponse } from "next/server";
import { predictConversionProbability, toRecommendation } from "@/lib/nex/predictive/engine";
import { getControls } from "@/lib/nex/predictive/controls";
import type { InferenceInput } from "@/lib/nex/predictive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: InferenceInput;
  try { body = await request.json() as InferenceInput; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.target) return NextResponse.json({ ok: false, error: "target required" }, { status: 400 });

  try {
    if (body.target === "conversion_probability") {
      if (!body.contact_id) return NextResponse.json({ ok: false, error: "contact_id required" }, { status: 400 });
      const pred = await predictConversionProbability(body);
      if (!pred) return NextResponse.json({ ok: false, error: "prediction_failed" }, { status: 500 });
      const controls = await getControls();
      return NextResponse.json({
        ok: true,
        prediction: pred,
        recommendation: toRecommendation(pred, controls.confidence_threshold),
        controls_snapshot: { paused: controls.paused, confidence_threshold: controls.confidence_threshold },
      });
    }
    return NextResponse.json({ ok: false, error: `target ${body.target} not implemented in v0.1` }, { status: 501 });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4) : undefined,
    }, { status: 500 });
  }
}

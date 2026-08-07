// GET  /api/nex/predictive/controls · read global kill switch + threshold
// POST /api/nex/predictive/controls · update kill switch / threshold
// Body: { paused?: boolean, paused_by?: string, paused_reason?: string, confidence_threshold?: number }
//
// Doctrine: invariant #15 · pausing the engine must NOT require a
// redeploy. When paused, no optimisation commands are emitted; predictions
// still run in shadow mode so calibration is not blinded.
import { NextResponse } from "next/server";
import { getControls, setControls } from "@/lib/nex/predictive/controls";
import type { SetControlsInput } from "@/lib/nex/predictive/controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const controls = await getControls();
  return NextResponse.json({ ok: true, controls });
}

export async function POST(request: Request) {
  let body: SetControlsInput;
  try { body = await request.json() as SetControlsInput; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const controls = await setControls(body);
  return NextResponse.json({ ok: true, controls });
}

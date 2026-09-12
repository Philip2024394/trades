// POST /api/nex/origin-canon/classify
// body: { utterance: string, session_id?: string }
//
// Runs the Origin Protection Classifier + Multi-Turn Tracker · returns the
// combined verdict PLUS the Golden Response Pattern semantic slots.
// Deterministic. Fails-closed. Never fabricates. Lab-internal for now.

import { NextResponse } from "next/server";
import { classifyForOriginExtraction } from "@/lib/nex-origin-canon/origin-protection-classifier";
import { observeTurn } from "@/lib/nex-origin-canon/multi-turn-tracker";
import { composeGoldenResponse } from "@/lib/nex-origin-canon/golden-response-pattern";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const utterance = typeof body.utterance === "string" ? body.utterance : "";
  const sessionId = typeof body.session_id === "string" && body.session_id.length > 0 ? body.session_id : "anonymous_session";
  if (!utterance) return NextResponse.json({ error: "missing_utterance" }, { status: 400 });

  const single = classifyForOriginExtraction(utterance);
  const multi = observeTurn(sessionId, utterance);

  const should_refuse = single.should_refuse || multi.should_refuse;
  const golden = should_refuse ? composeGoldenResponse(single, multi) : null;

  return NextResponse.json({
    utterance,
    session_id: sessionId,
    single_turn_verdict: single,
    multi_turn_verdict: multi,
    should_refuse,
    golden_response_pattern: golden,
    taught_by: "master_ai_engineer",
    at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

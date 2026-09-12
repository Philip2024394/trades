// POST /api/nex/integration/pipeline
// body: { utterance: string, session_id?: string }
// Runs the deterministic Integration Gate pipeline. TEST-ONLY.
// Never fabricates. IG-5 · no public UI exposure.

import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/nex-integration/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const utterance = typeof body.utterance === "string" ? body.utterance : "";
  const session_id = typeof body.session_id === "string" && body.session_id ? body.session_id : "test-session";
  if (!utterance) return NextResponse.json({ error: "missing_utterance" }, { status: 400 });
  const decision = runPipeline({ utterance, session_id });
  return NextResponse.json(decision, { headers: { "Cache-Control": "no-store" } });
}
